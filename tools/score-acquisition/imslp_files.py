"""IMSLP の作品ページから、版ごとのファイル一覧（総譜・パート譜の番号・ページ数）を取得する（GitHub Actions 専用）。

GPT のキューには候補ごとに 1 ファイル（多くは総譜）しか記録されていないことが多い。
キューの作品ページを IMSLP の API（api.php。robots.txt で許可されている経路）で読み、
GPT が選んだファイルと同じ版に属するパート譜を一覧にする。PDF はダウンロードしない。
1 リクエストごとに 3 秒あける。途中で止まっても出力から再開する。
使い方:
  python imslp_files.py --queue queue.json --out imslp_files.json         # 取得と解析
  python imslp_files.py --dump "String_Quartets,_Op.1_(Haydn,_Joseph)" --out dump.html  # 構造確認用
"""
from __future__ import annotations

import argparse
import json
import re
import sys
import time
import urllib.parse

import requests

API = "https://imslp.org/api.php"
UA = "SONARIA-score-library/1.0 (edition file listing for site owner's manual download; contact via site owner)"
DELAY = 3.0
_last = 0.0
session = requests.Session()
session.headers["User-Agent"] = UA


def parse_html(title: str) -> str:
    global _last
    wait = DELAY - (time.time() - _last)
    if wait > 0:
        time.sleep(wait)
    try:
        r = session.get(API, params={"action": "parse", "page": title, "prop": "text", "format": "json", "redirects": 1}, timeout=90)
        return (r.json().get("parse", {}).get("text", {}) or {}).get("*", "") if r.ok else ""
    except (requests.RequestException, ValueError):
        return ""
    finally:
        _last = time.time()


def title_of(url: str) -> str:
    return urllib.parse.unquote(url.split("/wiki/", 1)[1]) if "/wiki/" in (url or "") else ""


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--queue")
    ap.add_argument("--dump", action="append")
    ap.add_argument("--out", required=True)
    a = ap.parse_args()
    if a.dump:
        with open(a.out, "w", encoding="utf-8") as f:
            for t in a.dump:
                f.write(f"<!-- PAGE {t} -->\n{parse_html(t)}\n")
        return 0
    raise SystemExit("parser not implemented yet")


if __name__ == "__main__":
    sys.exit(main())
