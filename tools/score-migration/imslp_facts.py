#!/usr/bin/env python3
"""
作品情報（調性・作曲年・楽章・献呈・初版・編成）を IMSLP の作品ページから取得する（GitHub Actions 専用）。

- 入力: frontend/src/data/scores/catalog.json（作品）と composers.json（作曲家）
- IMSLP（MediaWiki）の検索で候補ページを探し、作曲者名と作品番号（Op./K./BWV/RV/D.）が一致するページだけを採用する。
  一致しない・見つからない作品は「未確認」として記録し、推測で埋めない
- 出力: imslp_facts.json（作品 ID → ページ URL と取り出した項目。人が確認してから catalog に反映する）
- IMSLP への負荷を避けるため、1 リクエストごとに 3 秒あける。途中で止まっても出力から再開する

使い方: python imslp_facts.py --repo . --out imslp_facts.json
"""
from __future__ import annotations

import argparse
import json
import os
import re
import sys
import time
import unicodedata

import requests

API = "https://imslp.org/api.php"
UA = "SONARIA-score-library/1.0 (catalog metadata check; contact via site owner)"
DELAY = 3.0
FIELDS = {
    "Work Title": "title",
    "Alternative Title": "alt_title",
    "Opus/Catalogue Number": "catalog",
    "Key": "key",
    "Movements/Sections": "movements",
    "Year/Date of Composition": "composed",
    "First Publication": "first_publication",
    "First Performance": "first_performance",
    "Dedication": "dedication",
    "Librettist": "librettist",
    "Instrumentation": "instrumentation",
    "Piece Style": "style",
    "Average Duration": "duration",
    "Number of Movements/Sections": "movement_count",
    "Movements Header": "movements_header",
}

last = 0.0
session = requests.Session()
session.headers["User-Agent"] = UA


def get(params: dict) -> dict:
    global last
    wait = DELAY - (time.time() - last)
    if wait > 0:
        time.sleep(wait)
    try:
        r = session.get(API, params={**params, "format": "json"}, timeout=60)
        return r.json() if r.ok else {}
    except (requests.RequestException, ValueError):
        return {}
    finally:
        last = time.time()


def fold(s: str) -> str:
    return unicodedata.normalize("NFKD", s or "").encode("ascii", "ignore").decode().lower()


def catalog_tokens(work: dict) -> list[str]:
    """作品番号を IMSLP の書き方に近い形で（Op.24 / K.525 / BWV 1068 / RV 269 / D.581）"""
    out = []
    for c in work.get("catalog", []):
        v = c["value"].split("|")[0]
        first = re.split(r"[,–-]", v)[0].strip()
        sub = re.findall(r"-(\d+)", v)
        t = c["type"]
        if t == "op":
            out.append(f"Op.{first}" + (f" No.{sub[0]}" if sub else ""))
        elif t == "k":
            out.append(f"K.{first}")
        elif t == "bwv":
            out.append(f"BWV {first}")
        elif t == "rv":
            out.append(f"RV {first}")
        elif t == "d":
            out.append(f"D.{first}")
    return out


def catalog_matches(work: dict, text: str) -> bool:
    t = fold(text).replace(" ", "")
    ok = False
    for c in work.get("catalog", []):
        v = c["value"].split("|")[0]
        nums = re.findall(r"\d+", v)
        if not nums:
            continue
        first = nums[0]
        prefix = {"op": "op.", "k": "k.", "bwv": "bwv", "rv": "rv", "d": "d."}.get(c["type"])
        if not prefix:
            continue
        if re.search(re.escape(prefix) + first + r"(?!\d)", t) or (c["type"] == "k" and re.search(r"k\." + first + r"(?!\d)|kv" + first + r"(?!\d)", t)):
            ok = True
            # 番号付き（Op.18-4 など）は下位番号も確かめる
            if len(nums) > 1 and c["type"] == "op" and not re.search(r"no\.?" + nums[1] + r"(?!\d)", t):
                ok = False
        if ok:
            return True
    return False


def parse_fields(wikitext: str) -> dict:
    out = {}
    for label, key in FIELDS.items():
        # 「=」の後は改行をまたがない（空欄のとき次の項目を取り込まないため）
        m = re.search(r"\n\|[ \t]*" + re.escape(label) + r"[ \t]*=[ \t]*(.*?)(?=\n\|[ \t]*[A-Za-z*][^=\n]*=|\n\}\})", wikitext, re.S)
        if m:
            v = m.group(1).strip()
            if v:
                out[key] = v[:1500]
    return out


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--repo", required=True)
    ap.add_argument("--out", required=True)
    args = ap.parse_args()
    catalog = json.load(open(os.path.join(args.repo, "frontend/src/data/scores/catalog.json"), encoding="utf-8"))
    composers = {c["id"]: c for c in json.load(open(os.path.join(args.repo, "frontend/src/data/scores/composers.json"), encoding="utf-8"))}
    out = json.load(open(args.out, encoding="utf-8")) if os.path.exists(args.out) else {}

    for w in catalog["works"]:
        if w["id"] in out and out[w["id"]].get("status") in ("matched", "not_found", "no_catalog"):
            continue
        c = composers[w["composerId"]]
        surname = fold(c["name"]["en"].split()[-1])
        tokens = catalog_tokens(w)
        rec: dict = {"status": "not_found", "candidates": []}
        queries = [f"{c['name']['en'].split()[-1]} {w['title']['en'].split('(')[0]} {' '.join(tokens[:1])}".strip()]
        if tokens:
            queries.append(f"{c['name']['en'].split()[-1]} {tokens[0]}")
        seen = set()
        for q in queries:
            res = get({"action": "query", "list": "search", "srsearch": q, "srnamespace": 0, "srlimit": 8})
            for hit in (res.get("query") or {}).get("search", []):
                title = hit["title"]
                if title in seen or surname not in fold(title):
                    continue
                seen.add(title)
                rec["candidates"].append(title)
                if not w.get("catalog"):
                    continue
                if not catalog_matches(w, title):
                    # タイトルに番号が無い場合は本文の作品番号で確かめる
                    pass
                page = get({"action": "parse", "page": title, "prop": "wikitext"})
                wt = ((page.get("parse") or {}).get("wikitext") or {}).get("*", "")
                fields = parse_fields(wt)
                # 編曲・トランスクリプションのページ（括弧内が別の作曲者）は採用しない
                if catalog_matches(w, title + " " + fields.get("catalog", "")) and f"({surname}" in fold(title):
                    i = wt.find("WORK INFO")
                    raw = wt[i : i + 6000] if i >= 0 else wt[:6000]
                    rec = {"status": "matched", "page": title, "url": "https://imslp.org/wiki/" + title.replace(" ", "_"), "fields": fields, "raw": raw, "candidates": rec["candidates"]}
                    break
            if rec["status"] == "matched":
                break
        if rec["status"] != "matched" and not w.get("catalog"):
            rec["status"] = "no_catalog"  # 作品番号が無い作品は機械的に照合しない（人が確認する）
        out[w["id"]] = rec
        with open(args.out, "w", encoding="utf-8") as f:
            json.dump(out, f, ensure_ascii=False, indent=1)
    summary = {}
    for v in out.values():
        summary[v["status"]] = summary.get(v["status"], 0) + 1
    print(json.dumps(summary))
    return 0


if __name__ == "__main__":
    sys.exit(main())
