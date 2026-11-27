#!/usr/bin/env python3
"""最初の巡回の記録（state.json）に、sitemap 確認で見つかった記事と PDF（held_review.py の index.json）を足して、
analyze.py の入力を作る。旧サイトにはアクセスしない。
使い方: python merge_review_state.py --state state.json --index index.json --new new_links.json --out state_merged.json
"""
import argparse
import json


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--state", required=True)
    ap.add_argument("--index", required=True)
    ap.add_argument("--new", required=True)
    ap.add_argument("--out", required=True)
    a = ap.parse_args()
    state = json.load(open(a.state, encoding="utf-8"))
    index = {v["url"]: v for v in json.load(open(a.index, encoding="utf-8")).values()}
    new = json.load(open(a.new, encoding="utf-8"))
    for r in new["results"]:
        rec = index.get(r["url"], {})
        page = state["pages"].setdefault(r["page"], {"status": "ok", "heading": r["heading"], "title": r["heading"], "downloads": [], "links": [], "found_by": "sitemap"})
        if r["url"] not in page["downloads"]:
            page["downloads"].append(r["url"])
        status = {"ok": "downloaded", "not_pdf": "not_pdf", "zip": "not_pdf"}.get(rec.get("status"), "download_failed")
        state["pdfs"][r["url"]] = {
            "found_on": [r["page"]],
            "link_texts": [{"page": r["page"], "text": "", "context": " ".join(r.get("notes") or [])}],
            "status": status,
            "filename": r["filename"],
            "sha256": rec.get("sha256"),
            "pages": rec.get("pages"),
            "bytes": rec.get("bytes"),
            "href_original": r["url"],
            "text_first": rec.get("text_p1", ""),
            "pdfinfo_ok": True,
            "found_by": "sitemap",
        }
    json.dump(state, open(a.out, "w", encoding="utf-8"), ensure_ascii=False)
    print(len(new["results"]), "links merged")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
