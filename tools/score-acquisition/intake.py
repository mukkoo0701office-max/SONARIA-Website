"""管理人が手動で取得した楽譜 PDF の受け入れ検査（GPT キューの「Claude PDF checks」）。

IMSLP は robots.txt で自動ダウンロードを禁止しているため、Claude は PDF を取りに行かない。
管理人がブラウザで取得した PDF を、非公開の下書きリリース「score-intake」に添付すると、この検査が動く。
（下書きリリースはリポジトリの管理者にしか見えない。サイトにも公開リリースにも出ない）

検査すること（公開・権利ステータスの変更はしない）:
  1. ファイル名の IMSLP 番号（IMSLP64041-… など）から、キューのどの候補・どのパート／スコアかを特定
  2. PDF として開けるか、ページ数がキューの記録と合うか
  3. 同じ PDF がすでにサイトにある／受け入れ済みでないか（SHA-256。同一 PDF を重複保存しない）
  4. 1 ページ目の文字から、パート名（Violino I・Viola・Violoncello・Partitur など）が想定と合うか
  5. キューの scope に書かれた楽章の速度標語（Allegro・Menuetto など）が本文に見つかるか（目安。最終確認は人）
  6. 視認性（解像度・コントラスト・くっきり度・インク量。既存の legibility の基準を流用）
使い方: python intake.py --queue queue.json --files DIR --catalog catalog.json --prev results.json --out OUTDIR
"""
from __future__ import annotations

import argparse
import hashlib
import json
import os
import re
import subprocess
import sys
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "tools" / "score-migration"))
import legibility  # noqa: E402

# パート名の手がかり（独・伊・英・仏の表記）。1 ページ目の OCR／テキストで探す
PART_PATTERNS = {
    "violin_1": r"Violin[oe]?\s*(?:I(?![IV])|1\b|prim)|Violon\s*(?:I(?![IV])|1\b)|1\.?\s*Violin|Violino\s*primo",
    "violin_2": r"Violin[oe]?\s*(?:II(?!I)|2\b|second)|Violon\s*(?:II(?!I)|2\b)|2\.?\s*Violin|Violino\s*secondo",
    "violin": r"Violin[oe]?\b|Violon\b",
    "viola": r"Viola\b|Bratsche|Alto\b",
    "cello": r"Violoncell|Cello|Basso\b|Violoncelle",
    "piano": r"Pian(?:o|oforte)|Klavier|Cembalo",
    "full_score": r"Partitur|Score\b|Partition\b|Partitura",
}
# 「Finale」「Poco」は説明文にも普通に出るため、楽章の手がかりから外す
TEMPO_WORDS = ["Adagio", "Allegretto", "Allegro", "Andante", "Andantino", "Largo", "Larghetto", "Lento", "Grave", "Presto", "Prestissimo", "Vivace", "Moderato", "Menuetto", "Minuetto", "Menuet", "Scherzo", "Rondo", "Trio", "Tempo di Menuetto", "Siciliano", "Cantabile", "Maestoso", "Polacca", "Fuga"]
LANGS = "eng+deu+ita+fra"


def run(cmd: list[str], timeout: int = 300) -> str:
    try:
        return subprocess.run(cmd, capture_output=True, text=True, timeout=timeout).stdout
    except subprocess.TimeoutExpired:
        return ""


def sha256(path: str) -> str:
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()


def page_count(pdf: str) -> int | None:
    m = re.search(r"^Pages:\s+(\d+)", run(["pdfinfo", pdf]), re.M)
    return int(m.group(1)) if m else None


def text_of(pdf: str, page: int) -> str:
    """埋め込みテキストがあればそれを、無ければ OCR（スキャン譜はほぼ OCR になる）"""
    t = run(["pdftotext", "-f", str(page), "-l", str(page), "-layout", pdf, "-"])
    if len(t.strip()) > 40:
        return t
    with tempfile.TemporaryDirectory() as d:
        stem = os.path.join(d, "p")
        run(["pdftoppm", "-f", str(page), "-l", str(page), "-r", "200", "-gray", "-singlefile", "-png", pdf, stem])
        if not os.path.exists(stem + ".png"):
            return ""
        return run(["tesseract", stem + ".png", "-", "-l", LANGS, "--psm", "3"], timeout=180)


def preview(pdf: str, out_jpg: str) -> None:
    with tempfile.TemporaryDirectory() as d:
        stem = os.path.join(d, "p")
        run(["pdftoppm", "-f", "1", "-l", "1", "-r", "60", "-jpeg", "-singlefile", pdf, stem])
        if os.path.exists(stem + ".jpg"):
            os.replace(stem + ".jpg", out_jpg)


def imslp_id(filename: str) -> str | None:
    m = re.search(r"IMSLP(\d+)", filename, re.I) or re.match(r"(\d{3,7})\b", filename)
    return m.group(1) if m else None


def index_queue(queue: dict) -> dict[str, list[dict]]:
    """IMSLP 番号 → [{item_id, role, expected_pages, scope}]。キューの書式の揺れに備えて全体をたどる"""
    out: dict[str, list[dict]] = {}

    def add(fid, item, role, pages, scope):
        for v in re.findall(r"\d{3,7}", str(fid)):
            out.setdefault(v, []).append({"item_id": item["id"], "role": role, "expected_pages": pages, "scope": scope, "status": item.get("status")})

    def walk(o, item, role, scope):
        if isinstance(o, dict):
            sc = o.get("scope") or scope
            if "imslp_file_id" in o:
                add(o["imslp_file_id"], item, role, o.get("file_pages") or o.get("pages"), sc)
            for k in ("score_file_id",):
                if k in o:
                    add(o[k], item, "full_score", o.get("score_pages"), sc)
            if "parts_file_ids" in o:
                pf = o["parts_file_ids"]
                for k, v in (pf.items() if isinstance(pf, dict) else [("parts", pf)]):
                    add(v, item, k, None, sc)
            for k, v in o.items():
                if k in ("imslp_file_id", "score_file_id", "parts_file_ids"):
                    continue
                walk(v, item, k if k in PART_PATTERNS else role, sc)
        elif isinstance(o, list):
            for v in o:
                walk(v, item, role, scope)

    for item in queue.get("items", []):
        # 説明文中の「#39781 (6pp)」からもページ数を拾う（個別パートのページ数はここにしか無いことがある）
        text_pages = {m.group(1): int(m.group(2)) for m in re.finditer(r"#(\d{3,7})\s*\((\d+)\s*pp?\.?\)", json.dumps(item, ensure_ascii=False))}
        edition = item.get("edition") or {}
        default_role = "full_score" if len(item.get("score_parts") or []) > 1 and not item.get("score_parts_set") else "main"
        walk(edition, item, default_role, edition.get("scope", ""))
        walk(item.get("score_parts_set") or {}, item, "main", edition.get("scope", ""))
        for fid, recs in out.items():
            for rec in recs:
                if rec["item_id"] == item["id"] and not rec["expected_pages"] and fid in text_pages:
                    rec["expected_pages"] = text_pages[fid]
    return out


def detect_parts(text: str) -> list[str]:
    found = [k for k, rx in PART_PATTERNS.items() if re.search(rx, text, re.I)]
    if "violin_1" in found or "violin_2" in found:
        found = [f for f in found if f != "violin"]
    return found


def tempo_check(scope: str, pdf: str, pages: int) -> dict:
    expected = []
    for w in TEMPO_WORDS:
        if re.search(rf"\b{re.escape(w)}\b", scope or "", re.I) and w.lower() not in [e.lower() for e in expected]:
            expected.append(w)
    if not expected:
        return {"expected": [], "found": [], "note": "scope に速度標語が無いため未判定"}
    found_pages: dict[str, list[int]] = {}
    for p in range(1, min(pages, 60) + 1):
        t = text_of(pdf, p)
        for w in expected:
            if re.search(rf"\b{re.escape(w[:6])}", t, re.I):
                found_pages.setdefault(w, []).append(p)
    return {"expected": expected, "found": sorted(found_pages), "pages": found_pages, "missing": [w for w in expected if w not in found_pages]}


def legible_flag(v: dict) -> bool:
    # tools/score-migration/legibility_crops.py と同じ基準
    return (v.get("scan_ppi") or 999) < 150 or v["contrast_median"] < 170 or v["sharpness_median"] < 2500 or v["ink_median"] > 0.3 or v["ink_median"] < 0.02


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--queue", required=True)
    ap.add_argument("--files", required=True)
    ap.add_argument("--catalog", required=True)
    ap.add_argument("--prev", default="")
    ap.add_argument("--out", required=True)
    a = ap.parse_args()

    queue = json.loads(Path(a.queue).read_text(encoding="utf-8"))
    idx = index_queue(queue)
    catalog = json.loads(Path(a.catalog).read_text(encoding="utf-8"))
    site_sha = {}
    for w in catalog["works"] if isinstance(catalog, dict) else catalog:
        for e in w.get("editions", []):
            for s in e.get("assets", []):
                for k in ("sha256", "originalSha256"):
                    if s.get(k):
                        site_sha[s[k]] = w["id"]
    prev = json.loads(Path(a.prev).read_text(encoding="utf-8")) if a.prev and os.path.exists(a.prev) else {"files": {}}
    done = prev.get("files", {})  # 途中で止まっても、検査済み（同じ SHA-256）は再検査しない

    out_dir = Path(a.out)
    (out_dir / "previews").mkdir(parents=True, exist_ok=True)
    seen: dict[str, str] = {}
    files = sorted(p for p in Path(a.files).iterdir() if p.is_file())
    for p in files:
        digest = sha256(str(p))
        if digest in seen:
            done[p.name] = {"file": p.name, "sha256": digest, "verdict": "duplicate_upload", "notes": [f"{seen[digest]} と同一のファイル"]}
            continue
        seen[digest] = p.name
        if any(r.get("sha256") == digest and r.get("verdict") != "error" for r in done.values()):
            continue
        r: dict = {"file": p.name, "sha256": digest, "imslp_id": imslp_id(p.name), "notes": []}
        r["queue"] = idx.get(r["imslp_id"] or "", [])
        if digest in site_sha:
            r["verdict"] = "already_on_site"
            r["notes"].append(f"サイト掲載中の {site_sha[digest]} と同一の PDF")
            done[p.name] = r
            continue
        n = page_count(str(p))
        r["pages"] = n
        if not n:
            r["verdict"] = "not_pdf"
            done[p.name] = r
            continue
        if not r["queue"]:
            r["notes"].append("ファイル名の IMSLP 番号がキューに見つからない（ファイル名を変えずに添付してください）")
        exp = [q["expected_pages"] for q in r["queue"] if q.get("expected_pages")]
        r["pages_match"] = (int(exp[0]) == n) if exp and str(exp[0]).isdigit() else None
        if r["pages_match"] is False:
            r["notes"].append(f"ページ数がキューの記録（{exp[0]}）と違う: {n}")
        first = text_of(str(p), 1)
        r["detected_parts"] = detect_parts(first)
        roles = {q["role"] for q in r["queue"]}
        known = roles & set(PART_PATTERNS)
        r["part_match"] = (bool(known & set(r["detected_parts"])) or ("violin" in r["detected_parts"] and bool(known & {"violin_1", "violin_2"}))) if known else None
        if r["part_match"] is False:
            r["notes"].append(f"1 ページ目のパート名（{', '.join(r['detected_parts']) or '読めず'}）が想定（{', '.join(sorted(known))}）と合わない")
        scope = next((q["scope"] for q in r["queue"] if q.get("scope")), "")
        r["tempo"] = tempo_check(scope, str(p), n)
        if r["tempo"].get("missing"):
            r["notes"].append("見つからない速度標語: " + ", ".join(r["tempo"]["missing"]) + "（OCR の読み落としの可能性あり）")
        leg = legibility.inspect(str(p), n)
        r["legibility"] = leg
        r["legibility_flag"] = ("error" in leg) or legible_flag(leg)
        if r["legibility_flag"]:
            r["notes"].append("視認性の基準に満たない可能性（解像度・コントラスト・くっきり度・インク量）")
        preview(str(p), str(out_dir / "previews" / f"{digest[:12]}.jpg"))
        problems = [r["pages_match"] is False, r["part_match"] is False, bool(r["tempo"].get("missing")), r["legibility_flag"], not r["queue"]]
        r["verdict"] = "needs_review" if any(problems) else "checks_passed"
        done[p.name] = r
        print(p.name, r["verdict"], flush=True)
        (out_dir / "results.json").write_text(json.dumps({"files": done}, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")

    (out_dir / "results.json").write_text(json.dumps({"files": done}, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    label = {"checks_passed": "自動検査を通過", "needs_review": "要確認", "already_on_site": "サイト掲載済みと同一", "duplicate_upload": "重複アップロード", "not_pdf": "PDF ではない", "error": "エラー"}
    rows = sorted(done.values(), key=lambda r: (r.get("verdict", ""), r["file"]))
    lines = ["# 楽譜 PDF 受け入れ検査（Claude）", "", f"- 検査したファイル: {len(rows)} 件（下書きリリース score-intake の添付）", "- 自動検査を通過しても公開・権利承認はしていない。権利ステータスの承認は管理人が行う", ""]
    if not rows:
        lines.append("まだファイルがありません。`docs/score-acquisition-intake.md` の手順で PDF を添付してください。")
    else:
        lines += ["| 判定 | ファイル | キュー候補 / パート | ページ | 気になる点 |", "|---|---|---|---|---|"]
        for r in rows:
            q = "<br>".join(f"`{x['item_id']}` / {x['role']}" for x in r.get("queue", [])) or "—"
            lines.append(f"| {label.get(r.get('verdict'), r.get('verdict'))} | {r['file']} | {q} | {r.get('pages') or '—'} | {'<br>'.join(r.get('notes') or []) or '—'} |")
    (out_dir / "report.md").write_text("\n".join(lines) + "\n", encoding="utf-8")
    return 0


if __name__ == "__main__":
    sys.exit(main())
