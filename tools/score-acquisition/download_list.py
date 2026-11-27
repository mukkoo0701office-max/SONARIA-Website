"""管理人がブラウザで PDF を取得するための一覧（作業リスト）を作る。

IMSLP の自動ダウンロードは robots.txt で禁止されているため、取得は管理人が行う。
キューに記録された作品ページ（edition_url / work_url）と IMSLP のファイル番号だけを並べる（URL を推測で作らない）。
サイトに掲載中の作品と重複する候補は、サイトに無い総譜などを足す場合だけ載せる。
使い方: python download_list.py <queue.json> <site_duplicates.json> <out.md>
"""
import json
import re
import sys
from pathlib import Path

PART_LABEL = {"full_score": "総譜", "violin_1": "Vn1", "violin_2": "Vn2", "violin": "Vn", "viola": "Va", "cello": "Vc", "piano": "Pf", "main": "本体"}


def files_of(item: dict) -> list[tuple[str, str, object]]:
    """[(役割, IMSLP 番号, ページ数)]"""
    out = []
    comps = (item.get("score_parts_set") or {}).get("components") or {}
    for role, c in comps.items():
        if isinstance(c, dict) and c.get("imslp_file_id"):
            out.append((role, str(c["imslp_file_id"]), c.get("file_pages")))
    e = item.get("edition") or {}
    if not out and e.get("imslp_file_id"):
        out.append(("main", str(e["imslp_file_id"]), e.get("file_pages")))
    text_pages = {m.group(1): m.group(2) for m in re.finditer(r"#(\d{3,7})\s*\((\d+)\s*pp?\.?\)", json.dumps(item, ensure_ascii=False))}
    return [(r, f, p or text_pages.get(f)) for r, f, p in out]


def main(queue_path: str, dup_path: str, out_md: str) -> None:
    queue = json.loads(Path(queue_path).read_text(encoding="utf-8"))
    dup = {r["id"]: r for r in json.loads(Path(dup_path).read_text(encoding="utf-8"))["results"]}
    order = [t["composer"].lower() for t in queue.get("target_order", [])]
    rows = []
    for i, item in enumerate(queue["items"]):
        if item.get("status") == "held":
            continue
        d = dup.get(item["id"], {})
        files = files_of(item)
        if not files:
            continue
        if d.get("verdict") == "duplicate_published":
            # サイトはパート譜だけのことが多い。総譜だけを取得対象にする（パートの重複取得はしない）
            files = [f for f in files if f[0] == "full_score"]
            if not files:
                continue
            note = "サイト掲載中。総譜の追加用"
        else:
            note = ""
        cid = d.get("composer_id", "")
        rank = order.index(cid) if cid in order else len(order)
        rows.append((rank, i, item, files, note))
    rows.sort(key=lambda r: (r[0], r[1]))

    lines = ["# PDF 取得リスト（管理人がブラウザで取得）", "", f"- 対象: {len(rows)} 候補（キュー {len(queue['items'])} 件から、保留・番号なしを除く）", "- 作品ページを開き、表の番号（#）のファイルを保存して、ファイル名を変えずに下書きリリース「score-intake」に添付してください", "- 優先順はキューの target_order（作曲家）→ キューの登録順", ""]
    current = None
    for rank, _, item, files, note in rows:
        comp = item.get("composer", "").split("(")[0].strip()
        if comp != current:
            lines += ["", f"## {comp}", "", "| 候補 | 作品ページ | ファイル（#番号・ページ数） | メモ |", "|---|---|---|---|"]
            current = comp
        url = item.get("edition_url") or item.get("work_url") or ""
        fs = "<br>".join(f"{PART_LABEL.get(r, r)} #{f}" + (f"（{p}p）" if p else "") for r, f, p in files)
        title = f"{item.get('work_title', '')} {item.get('opus_catalog', '')}".strip()
        lines.append(f"| {title}<br>`{item['id']}` | [IMSLP]({url}) | {fs} | {note} |")
    Path(out_md).write_text("\n".join(lines) + "\n", encoding="utf-8")
    print(len(rows), "candidates")


if __name__ == "__main__":
    main(*sys.argv[1:4])
