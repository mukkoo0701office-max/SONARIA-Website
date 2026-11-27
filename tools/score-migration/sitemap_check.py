#!/usr/bin/env python3
"""旧サイトの sitemap.xml の全ページを確認し、最初の移行（ハブからたどった巡回）で拾えていない PDF を探す（GitHub Actions 専用）。

- 会員限定・お問い合わせ・管理系など audit.py の EXCLUDE_PATTERNS に当たるページは開かない（運営者の指示）
- 前回の巡回（ci/score-audit の state.json）で開いたページは開き直さない
- robots.txt を守り、5 秒間隔で 1 ページずつ取得する。旧サイトのデータは変更しない
- 出力: report.json と同じ形の results（decision="new"）。held_review.py の入力にする
使い方: python sitemap_check.py --state state.json --report report.json --out new_links.json
"""
from __future__ import annotations

import argparse
import json
import os
import re
import sys
from urllib.parse import unquote, urljoin

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from audit import BASE, Fetcher, content_root, context_text, is_download, is_excluded, norm  # noqa: E402
from bs4 import BeautifulSoup  # noqa: E402


def dl_id(url: str) -> str:
    m = re.search(r"/app/download/(\d+)", url)
    return m.group(1) if m else norm(url)


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--state", required=True)
    ap.add_argument("--report", required=True)
    ap.add_argument("--out", required=True)
    a = ap.parse_args()
    state = json.load(open(a.state, encoding="utf-8"))
    report = json.load(open(a.report, encoding="utf-8"))["results"]
    known_ids = {dl_id(x["url"]) for x in report} | {dl_id(u) for u in state.get("pdfs", {})}
    visited = {norm(u).rstrip("/") for u in state.get("pages", {})}

    f = Fetcher()
    r = f.get(BASE + "/sitemap.xml")
    locs = re.findall(r"<loc>\s*([^<\s]+)\s*</loc>", r.text)
    out = {"sitemap_urls": len(locs), "checked": [], "skipped": [], "results": []}
    for loc in locs:
        u = norm(loc)
        if is_excluded(u):
            out["skipped"].append({"url": u, "reason": "対象外（会員限定・お問い合わせ・管理系など）"})
            continue
        if u.rstrip("/") in visited:
            continue
        if not f.allowed(u):
            out["skipped"].append({"url": u, "reason": "robots.txt で禁止"})
            continue
        resp = f.get(u)
        if resp.status_code != 200 or "html" not in resp.headers.get("content-type", ""):
            out["skipped"].append({"url": u, "reason": f"HTTP {resp.status_code}"})
            continue
        soup = BeautifulSoup(resp.text, "html.parser")
        h = soup.find(["h1", "h2"])
        heading = h.get_text(" ", strip=True)[:200] if h else ""
        found = 0
        for el in content_root(soup).find_all("a", href=True):
            href = urljoin(u, el["href"].strip())
            if not href.startswith("http") or not is_download(href):
                continue
            found += 1
            if dl_id(href) in known_ids:
                continue
            known_ids.add(dl_id(href))
            fname = unquote(href.split("?")[0].rsplit("/", 1)[-1])
            out["results"].append({"page": u, "heading": heading, "url": norm(href), "filename": fname, "decision": "new", "reasons": ["最初の巡回で見つからなかったページ"], "notes": [context_text(el)], "part": None, "sha256": None})
        out["checked"].append({"url": u, "heading": heading, "downloads": found})
        print(heading[:40], found, flush=True)
    json.dump(out, open(a.out, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    print(json.dumps({"sitemap": len(locs), "checked": len(out["checked"]), "new_pdfs": len(out["results"])}, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    sys.exit(main())
