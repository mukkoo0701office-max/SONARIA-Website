"""管理人がブラウザで PDF を取得するための一覧（作業リスト）を作る。

IMSLP の自動ダウンロードは robots.txt で禁止されているため、取得は管理人が行う。
imslp_sets.json（imslp_files.py の出力。IMSLP の作品ページから選んだ「総譜＋パート譜」の組）があればそれを使い、
無ければ GPT のキューに記録された番号を使う。URL は作品ページだけを載せ、推測で作らない。
同じファイルを複数の候補が使う（曲集など）場合は 1 回だけ載せる。
使い方: python download_list.py <queue.json> <site_duplicates.json> <out.md> [imslp_sets.json]
"""
import json
import os
import sys
import urllib.parse
from pathlib import Path

LABEL = {"full_score": "総譜", "violin_1": "Vn1", "violin_2": "Vn2", "violin": "Vn", "viola": "Va", "cello": "Vc", "piano": "Pf", "main": "本体", "violin_1_vol": "Vn1（別冊）", "violin_2_vol": "Vn2（別冊）", "viola_vol": "Va（別冊）", "cello_vol": "Vc（別冊）", "violin_vol": "Vn（別冊）"}


def main(queue_path: str, dup_path: str, out_md: str, sets_path: str = "") -> None:
    queue = json.loads(Path(queue_path).read_text(encoding="utf-8"))
    dup = {r["id"]: r for r in json.loads(Path(dup_path).read_text(encoding="utf-8"))["results"]}
    sets = {r["id"]: r for r in json.loads(Path(sets_path).read_text(encoding="utf-8"))["results"]} if sets_path and os.path.exists(sets_path) else {}
    order = [t["composer"].lower() for t in queue.get("target_order", [])]

    # ファイル番号 → {役割, ページ数, 作品ページ, 使う候補}
    files: dict[str, dict] = {}
    held = []
    for i, item in enumerate(queue["items"]):
        s = sets.get(item["id"])
        d = dup.get(item["id"], {})
        if item.get("status") == "held" or not s or s.get("status") != "complete_set":
            held.append((item, (s or {}).get("status", "no_listing") if item.get("status") != "held" else "queue_held"))
            continue
        chosen = []
        if s.get("score"):
            chosen.append(("full_score", s["score"]["id"], s["score"]["pages"], s["score"].get("page"), s["score"]["publisher"]))
        if s.get("parts") and d.get("verdict") != "duplicate_published":
            # サイト掲載中の作品はパート譜がそろっているので、総譜だけを取得する
            for role, f in s["parts"]["files"].items():
                chosen.append((role, f["id"], f["pages"], s["parts"].get("page"), s["parts"]["publisher"]))
            for f in s["parts"].get("split_volumes", []):
                chosen.append((f["role"] + "_vol", f["id"], f["pages"], s["parts"].get("page"), s["parts"]["publisher"]))
        cid = d.get("composer_id", "")
        rank = (order.index(cid) if cid in order else len(order), i)
        for role, fid, pages, page, pub in chosen:
            rec = files.setdefault(fid, {"roles": set(), "pages": pages, "page": page, "publisher": pub, "items": [], "rank": rank})
            rec["roles"].add(role)
            rec["items"].append(f"{item.get('work_title', '')} {item.get('opus_catalog', '')}".strip())
            rec["rank"] = min(rec["rank"], rank)

    lines = ["# PDF 取得リスト（管理人がブラウザで取得）", "",
             f"- 保存するファイル: **{len(files)} 個**（総譜とパート譜。曲集のように複数の曲で使うファイルは 1 回だけ）",
             "- 作品ページを開き、表の番号（#）のファイルを保存して、**ファイル名を変えずに**下書きリリース「score-intake」に添付してください",
             "- 並びは作曲家の優先順（キューの target_order）→ キューの登録順。上から少しずつで大丈夫です",
             "- 総譜とパート譜の組は、IMSLP の作品ページの全ファイルから Claude が選んだもの（imslp_sets.md）", ""]
    by_page: dict[str, list[tuple[str, dict]]] = {}
    for fid, rec in sorted(files.items(), key=lambda kv: kv[1]["rank"]):
        by_page.setdefault(rec["page"] or "", []).append((fid, rec))
    lines += ["| 作品ページ | 保存するファイル（#番号・内容・ページ数） | 使う曲 |", "|---|---|---|"]
    for page, recs in sorted(by_page.items(), key=lambda kv: min(r["rank"] for _, r in kv[1])):
        url = f"https://imslp.org/wiki/{urllib.parse.quote(page)}" if page else ""
        name = page.replace("_", " ")
        fs = "<br>".join(f"#{fid} {'・'.join(LABEL.get(r, r) for r in sorted(rec['roles']))}（{rec['pages']}p）" for fid, rec in recs)
        works = sorted({w for _, rec in recs for w in rec["items"]})
        lines.append(f"| [{name}]({url}) | {fs} | {'<br>'.join(works[:8])}{'<br>…' if len(works) > 8 else ''} |")
    if held:
        why = {"nothing_usable": "使える版なし（近年の校訂版のみ等）", "score_only": "パート譜がない", "parts_only": "総譜がない", "queue_held": "GPT が保留", "no_listing": "IMSLP の一覧が未取得", "page_error": "ページ取得失敗"}
        lines += ["", f"## 保留（取得しない）: {len(held)} 件", ""] + [f"- `{it['id']}` — {why.get(r, r)}" for it, r in held]
    Path(out_md).write_text("\n".join(lines) + "\n", encoding="utf-8")
    print(len(files), "files", len(held), "held")


if __name__ == "__main__":
    main(*sys.argv[1:5])
