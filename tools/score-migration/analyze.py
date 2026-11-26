#!/usr/bin/env python3
"""
検査結果（state.json・deep.json）を突き合わせ、旧サイトの PDF リンクを 1 件ずつ「移行」「保留」に分類する。

- 品質（移行の仕様）で落ちたものは保留: 破損・PDF 以外・誤リンク・ページ欠落の疑い・パート不一致・
  作曲者を中身で確認できない・必要なパートの不足
- 権利は運営者の指示（2026-11-26「いったん権利は気にせず反映。公開前にチェックして差し替える」）により判定しない。
  移行したものは rights.status = "pending"（権利確認前）とし、本番ビルドには出さない（プレビューだけに表示）。
  権利の判断材料（著作権表記・出版社・作成者など）は notes として残す
- 同じ内容（SHA-256）の PDF は 1 つだけ保存する

出力:
  approvals.json  … migrate.py の入力（移行する作品・版・ファイル）
  report.json     … すべてのリンクの判定結果と集計
  report.md       … 人が読む一覧（移行した楽譜・保留した楽譜・数値）

使い方: python analyze.py --state state.json --deep deep.json --out-dir out/
"""
from __future__ import annotations

import argparse
import collections
import difflib
import json
import os
import re
import sys
import unicodedata

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from works_meta import MIXED_PAGES, W  # noqa: E402

REPO_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
COMPOSERS = json.load(open(os.path.join(REPO_ROOT, "frontend", "src", "data", "scores", "composers.json"), encoding="utf-8"))
COMPOSER_BY_ID = {c["id"]: c for c in COMPOSERS}

# 編成ごとに必要なパート（スコアが無い場合に、これがそろっていなければ「パート不足」）
REQUIRED = {
    "string-quartet": {"violin1", "violin2", "viola", "cello"},
    "string-trio": {"violin", "viola", "cello"},
    "piano-trio": {"violin", "cello", "piano"},
    "piano-quartet": {"violin", "viola", "cello", "piano"},
    "violin-piano": {"violin", "piano"},
    "viola-piano": {"viola", "piano"},
    "cello-piano": {"cello", "piano"},
    "violin-duo": {"violin1", "violin2"},
}

# 権利の判断材料として記録するだけの、第三者の浄書・配布元の目印
THIRD_PARTY_HINTS = re.compile(r"free-?scores|lilypond|dvips|musescore|finale|sibelius|mutopia", re.I)


def norm(s: str) -> str:
    return unicodedata.normalize("NFKC", s or "").lower()


def key(url: str) -> str:
    return re.sub(r"^https?://", "", url)


def part_of(filename: str) -> tuple[str, str | None]:
    """ファイル名からパートを読む。(part, 補足ラベル)"""
    f = norm(os.path.splitext(filename)[0])
    f = f.replace("＃", "#")
    tail = re.split(r"[#_]", f)[-1] if re.search(r"[#_]", f) else f
    t = tail.replace("譜", "").replace(" ", "")
    rules = [
        (r"^(スコア|score|full|全パート)", "score"),
        (r"(cembalo|continuo|チェンバロ)", "other"),
        (r"(vnソロ|vnsolo|solo|ソロ)", "solo"),
        (r"(vn1|violin1|1stvn|第1)", "violin1"),
        (r"(vn2|violin2|2ndvn|第2)", "violin2"),
        (r"^(va|vla|viola)", "viola"),
        (r"^(vc&cb)", "other"),
        (r"^(vc|cello)", "cello"),
        (r"^(cb|cbass|contrabass|bass)", "bass"),
        (r"(pf|piano|ピアノ)", "piano"),
        (r"^(vn|violin)", "violin"),
    ]
    for rx, p in rules:
        if re.search(rx, t):
            return p, None
    # 区切りの無いファイル名（VIOLIN 1.pdf など）
    for rx, p in [(r"violin ?1", "violin1"), (r"violin ?2", "violin2"), (r"viola", "viola"), (r"cello", "cello"), (r"c ?bass", "bass"), (r"スコア", "score")]:
        if re.search(rx, f):
            return p, None
    return "other", None


def volume_label(filename: str) -> str | None:
    """曲集の記事で、ファイルごとの曲番号・巻を読む（表示用のラベル）"""
    f = norm(filename)
    for rx, fmt in [
        (r"bwv\.?\s*(\d{3,4})", "BWV {}"),
        (r"book\s*(\d)", "Book {}"),
        (r"bk\.?\s*(\d)", "Book {}"),
        (r"(\d)巻", "第{}巻"),
        (r"第\s*(\d+)\s*番", "第{}番"),
        (r"no\.?\s*(\d+)", "No.{}"),
        (r"op\.?\s*(\d+(?:-\d+)?)", "Op.{}"),
        (r"k\.?404a-(\d)", "第{}曲"),
    ]:
        m = re.search(rx, f)
        if m:
            return fmt.format(m.group(1))
    return None


def composer_seen(text: str, composer_id: str) -> bool:
    """1 ページ目の文字（OCR を含む）に作曲者名が出てくるか。OCR の読み違いを少し許す"""
    c = COMPOSER_BY_ID.get(composer_id)
    if not c:
        return False
    t = norm(text)
    names = {norm(c["short"]["en"]), norm(c["name"]["original"]).split()[-1], norm(c["name"]["en"]).split()[-1], *[norm(a) for a in c.get("aliases", []) if a.isascii()]}
    names = {re.sub(r"[^a-zß-ÿ]", "", unicodedata.normalize("NFKD", n).encode("ascii", "ignore").decode() or n) for n in names}
    words = re.findall(r"[a-z]{3,}", unicodedata.normalize("NFKD", t).encode("ascii", "ignore").decode())
    for n in names:
        if len(n) < 3:
            continue
        if n in "".join(words) or any(difflib.SequenceMatcher(None, n, w).ratio() >= 0.8 for w in words):
            return True
    # 日本語の表記
    for n in [c["short"]["ja"], *[a for a in c.get("aliases", []) if not a.isascii()]]:
        if n and n in text:
            return True
    return False


PART_WORDS = {"violin1": "violin1", "violin2": "violin2", "viola": "viola", "cello": "cello", "bass": "bass", "piano": "piano", "score": "score", "violin": "violin"}


def part_conflict(file_part: str, labels: list[str]) -> bool:
    """中身のパート表記がファイル名のパートと明らかに食い違うか（表記が無い・複数あるときは食い違いとしない）"""
    if not labels or file_part in ("score", "other", "solo"):
        return False
    labels = [l for l in labels if l not in ("score",)]
    if len(labels) != 1:
        return False
    l = labels[0]
    compat = {
        "violin": {"violin", "violin1", "violin2"},
        "violin1": {"violin1", "violin"},
        "violin2": {"violin2", "violin"},
        "viola": {"viola"},
        "cello": {"cello"},
        "bass": {"bass", "cello"},
        "piano": {"piano", "violin", "cello", "viola"},  # ピアノ譜には独奏の段も載る
    }
    return l not in compat.get(file_part, {l})


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--state", required=True)
    ap.add_argument("--deep", required=True)
    ap.add_argument("--out-dir", required=True)
    args = ap.parse_args()
    state = json.load(open(args.state, encoding="utf-8"))
    deep = json.load(open(args.deep, encoding="utf-8")) if os.path.exists(args.deep) else {}
    os.makedirs(args.out_dir, exist_ok=True)

    # ---- リンクの重複（http / https）をまとめる ----
    links: dict[str, dict] = {}
    for url, e in state["pdfs"].items():
        k = key(url)
        if k not in links or links[k]["status"] != "downloaded":
            links[k] = e | {"_url": url}
    pages: dict[str, dict] = {}
    for url, p in state["pages"].items():
        k = key(url)
        if k not in pages or (p.get("downloads") and not pages[k].get("downloads")):
            pages[k] = p | {"_url": url}
    article_pages = {k: p for k, p in pages.items() if p.get("downloads")}

    results = []  # リンクごとの判定
    works: dict[str, dict] = {}  # 作品 ID → 作品データ
    seen_hash_asset: dict[str, str] = {}
    held_work_reasons: dict[str, list[str]] = collections.defaultdict(list)

    for pk, page in sorted(article_pages.items()):
        heading = page.get("heading") or ""
        meta = W.get(heading)
        link_keys = []
        for d in page["downloads"]:
            if key(d) not in link_keys:
                link_keys.append(key(d))
        for lk in link_keys:
            e = links.get(lk)
            r = {"page": page["_url"], "heading": heading, "url": e["_url"] if e else lk, "filename": (e or {}).get("filename"), "decision": None, "reasons": [], "notes": []}
            results.append(r)
            if not e:
                r["decision"], r["reasons"] = "hold", ["検査記録なし"]
                continue
            if heading in MIXED_PAGES or not meta:
                r["decision"] = "hold"
                r["reasons"].append("作品を特定できない（複数の作曲者の楽譜が混在するページ、または作品情報が未登録）")
                continue
            if e["status"] != "downloaded":
                r["decision"] = "hold"
                r["reasons"].append({"not_pdf": "PDF ではない（ZIP など）", "download_failed": "取得失敗", "skipped": "取得対象外"}.get(e["status"], e["status"]) + (f"（{e.get('reason')}）" if e.get("reason") else ""))
                continue
            d = deep.get(e["sha256"], {})
            wid, ja, en, cid, scoring, genre, cat = meta
            part, _ = part_of(e["filename"] or "")
            r["part"] = part
            # 1) 破損
            if e.get("qpdf_exit") == 2 or not e.get("pdfinfo_ok", True):  # qpdf の終了コード 3 は警告のみ（開ける）
                r["reasons"].append("PDF が壊れている")
            if d.get("status") == "failed_permanent":
                r["reasons"].append("詳細検査でエラー（" + (d.get("reason") or "")[:60] + "）")
            if d.get("status") == "changed":
                r["reasons"].append("旧サイトの PDF が 1 回目の検査後に変わった")
            # 2) 誤リンク: ファイル名の作品番号がページの作品番号と違う
            fn_ops = set(re.findall(r"op\.?\s*(\d+)", norm(e["filename"])))
            hd_ops = set(re.findall(r"op\.?\s*(\d+)", norm(heading)))
            if fn_ops and hd_ops and not (fn_ops & hd_ops):
                r["reasons"].append(f"誤リンク（ファイル名は Op.{'/'.join(sorted(fn_ops))}、掲載ページは Op.{'/'.join(sorted(hd_ops))}）")
            # 3) 中身の確認（作曲者名）
            head = " ".join([d.get("page1_head", ""), e.get("text_first") or "", e.get("ocr_first") or ""])
            if not composer_seen(head, cid):
                r["reasons"].append("中身（1 ページ目）で作曲者を確認できない")
            # 4) パート
            if part_conflict(part, d.get("part_label") or []):
                r["reasons"].append(f"パート不一致（ファイル名: {part}、中身の表記: {', '.join(d.get('part_label'))}）")
            # 5) ページ欠落
            seq = (d.get("sequence") or {}).get("result")
            if seq == "gap_suspected":
                jumps = d["sequence"].get("jumps", [])
                r["reasons"].append("ページ欠落の疑い（ページ番号の飛び: " + ", ".join(f"{j['page']}ページ目" for j in jumps[:3]) + "）")
            if not d:
                r["reasons"].append("詳細検査が未実施")
            # 権利の判断材料（判定には使わない）
            marks = d.get("marks") or {}
            if marks.get("copyright"):
                r["notes"].append("著作権表記: " + " / ".join((d.get("copyright_snippets") or marks["copyright"])[:2]))
            if marks.get("publisher"):
                r["notes"].append("出版社: " + ", ".join(marks["publisher"][:3]))
            if marks.get("editor"):
                r["notes"].append("校訂・編曲の表記: " + ", ".join(marks["editor"][:3]))
            meta_src = " ".join(filter(None, [e.get("author"), e.get("creator"), e.get("producer"), e.get("filename")]))
            if THIRD_PARTY_HINTS.search(meta_src) or (e.get("author") and not re.search(r"向山", e.get("author") or "") and e.get("author") not in ("X", "user")):
                r["notes"].append(f"PDF の作成情報: {e.get('author') or '-'} / {e.get('creator') or '-'}")
            if e.get("imslp_id"):
                r["notes"].append(f"IMSLP #{e['imslp_id']}")
            if seq in ("unknown", None) and (e.get("pages") or 0) > 2:
                r["notes"].append("ページ番号を読み取れず、欠落の有無は未確認")
            if d.get("blank_pages"):
                r["notes"].append("白紙ページ: " + ", ".join(map(str, d["blank_pages"][:5])))

            r["decision"] = "hold" if r["reasons"] else "migrate"
            r["sha256"] = e["sha256"]
            if r["decision"] != "migrate":
                continue

            # ---- 移行する作品・ファイル ----
            w = works.setdefault(
                wid,
                {
                    "id": wid,
                    "composerId": cid,
                    "title": {"ja": ja, "en": en},
                    "catalog": [{"type": t, "value": v} for t, v in (x.split(":", 1) for x in cat.split("|") if x)] if cat else [],
                    "scoring": scoring,
                    "players": {"violin": 1, "viola": 1, "cello": 1, "piano": 1, "violin-piano": 2, "viola-piano": 2, "cello-piano": 2, "violin-duo": 2, "string-duo": 2, "string-trio": 3, "piano-trio": 3, "string-quartet": 4, "piano-quartet": 4}.get(scoring, 5),
                    "instruments": [],
                    "genre": genre,
                    "era": COMPOSER_BY_ID[cid]["era"],
                    "publishedAt": "2026-11-27",
                    "updatedAt": "2026-11-27",
                    "_page": page["_url"],
                    "_assets": [],
                },
            )
            w["_assets"].append({"r": r, "e": e, "part": part})

    # ---- 作品単位の検査（パート不足）と、ファイル ID・ラベルの付与 ----
    approvals = {"version": 1, "note": "rights.status=pending は権利確認前（運営者が公開前に確認する）。本番ビルドには表示しない", "works": []}
    for wid, w in sorted(works.items()):
        assets = w.pop("_assets")
        page_url = w.pop("_page")
        parts = {a["part"] for a in assets}
        need = REQUIRED.get(w["scoring"])
        if need and "score" not in parts:
            have = set(parts)
            if w["scoring"] in ("string-trio", "piano-trio", "piano-quartet", "violin-piano") and "violin1" in have:
                have.add("violin")
            missing = need - have
            if missing and len(assets) > 0 and not any(volume_label(a["e"]["filename"]) for a in assets if len({x["part"] for x in assets}) < len(assets)):
                for a in assets:
                    a["r"]["decision"] = "hold"
                    a["r"]["reasons"].append("パート不足（スコアが無く、" + "・".join(sorted(missing)) + " が無い）")
                continue
        # ファイル ID（作品内で一意）とラベル
        used = collections.Counter()
        out_assets = []
        multi_same_part = collections.Counter(a["part"] for a in assets)
        for a in assets:
            e = a["e"]
            if e["sha256"] in seen_hash_asset and seen_hash_asset[e["sha256"]].startswith(wid + "/"):
                a["r"]["notes"].append("同じ内容の PDF を重複して保存しない（同じ作品内）")
                continue
            vol = volume_label(e["filename"]) if multi_same_part[a["part"]] > 1 else None
            base = a["part"] + ("-" + re.sub(r"[^a-z0-9]+", "-", norm(vol)).strip("-") if vol else "")
            used[base] += 1
            aid = base if used[base] == 1 else f"{base}-{used[base]}"
            seen_hash_asset.setdefault(e["sha256"], f"{wid}/{aid}")
            a["r"]["asset"] = f"{wid}/{aid}"
            out_assets.append(
                {
                    "id": aid,
                    "part": a["part"],
                    **({"label": {"ja": vol, "en": vol}} if vol else {}),
                    "url": e.get("href_original") or e["_url"],
                    "filename": e["filename"],
                    "sha256": e["sha256"],
                    "pages": e["pages"],
                    "bytes": e["bytes"],
                }
            )
        if not out_assets:
            continue
        instruments = sorted({p for p in parts if p in ("violin", "viola", "cello", "piano", "bass")} | ({"violin"} if parts & {"violin1", "violin2", "solo"} else set()))
        w["instruments"] = instruments
        notes = sorted({n for a in assets for n in a["r"]["notes"]})
        w["editions"] = [
            {
                "id": "old-site",
                "label": {"ja": "旧サイト掲載の楽譜", "en": "Score from the former SONARIA site"},
                "source": {"type": "other", "note": "旧サイト（向山弦楽器塾）の無料楽譜ライブラリから移行"},
                "rights": {"status": "pending", "basis": "権利確認前（運営者が公開前に確認する）。判断材料: " + (" | ".join(notes)[:600] if notes else "記録なし")},
                "assets": out_assets,
                "oldSiteUrl": page_url,
            }
        ]
        approvals["works"].append(w)

    # ---- 集計 ----
    downloaded_links = [l for l in links.values() if l["status"] == "downloaded"]
    migrated = [r for r in results if r["decision"] == "migrate" and r.get("asset")]
    held = [r for r in results if r["decision"] == "hold"]
    stored_hashes = {r["sha256"] for r in migrated}
    summary = {
        "発見した楽譜ページ数": len(article_pages),
        "発見したPDFリンク数": len(links),
        "ダウンロード成功数": len(downloaded_links),
        "検査合格数": len([r for r in results if r["decision"] == "migrate"]),
        "保留数": len(held),
        "移行する作品数": len(approvals["works"]),
        "移行するPDF（内容の重複を除く）": len(stored_hashes),
        "巡回できなかったページ": [{"url": u, "status": p.get("status"), "reason": p.get("reason") or p.get("http_status")} for u, p in state["pages"].items() if p.get("status") not in ("ok",)],
    }
    unassigned = set(links) - {key(r["url"]) for r in results}
    for lk in sorted(unassigned):
        e = links[lk]
        results.append({"page": e.get("found_on"), "heading": None, "url": e["_url"], "filename": e.get("filename"), "decision": "hold", "reasons": ["掲載ページを特定できない"], "notes": []})
    # 同じリンクが複数のページに載っている場合、どこかで移行できればそのリンクは「移行」
    link_decision: dict[str, str] = {}
    for r in results:
        k = key(r["url"])
        if r["decision"] == "migrate" and r.get("asset"):
            link_decision[k] = "migrate"
        else:
            link_decision.setdefault(k, "hold")
    summary["検査合格数"] = sum(1 for v in link_decision.values() if v == "migrate")
    summary["保留数"] = sum(1 for v in link_decision.values() if v == "hold")
    summary["判定済みリンク数"] = len(link_decision)

    json.dump(approvals, open(os.path.join(args.out_dir, "approvals.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    json.dump({"summary": summary, "results": results}, open(os.path.join(args.out_dir, "report.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=1)

    # 人が読む一覧
    lines = ["# 楽譜移行レポート", "", "## 数値", ""]
    for k, v in summary.items():
        if not isinstance(v, list):
            lines.append(f"- {k}: {v}")
    lines += ["", "## 移行した楽譜（権利確認前・プレビューのみ表示）", "", "| 作品 | 作曲者 | ファイル |", "|---|---|---|"]
    for w in approvals["works"]:
        c = COMPOSER_BY_ID[w["composerId"]]
        lines.append(f"| {w['title']['ja']} | {c['short']['ja']} | {len(w['editions'][0]['assets'])} |")
    lines += ["", "## 保留した楽譜", "", "| 掲載ページ | ファイル | 理由 |", "|---|---|---|"]
    for r in results:
        if r["decision"] == "hold":
            lines.append(f"| {r.get('heading') or '-'} | {r.get('filename') or r['url']} | {' / '.join(r['reasons'])} |")
    open(os.path.join(args.out_dir, "report.md"), "w", encoding="utf-8").write("\n".join(lines) + "\n")
    print(json.dumps({k: v for k, v in summary.items() if not isinstance(v, list)}, ensure_ascii=False, indent=1))
    return 0


if __name__ == "__main__":
    sys.exit(main())
