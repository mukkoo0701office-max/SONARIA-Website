#!/usr/bin/env python3
"""目視確認用に、指定したファイルの全ページを読める大きさで並べた画像を作る（GitHub Actions 専用）。
ページ欠落の疑い・小さすぎるスキャンなどの確認に使う。旧サイトへは 5 秒間隔で取得する。
使い方: python detail_sheets.py --index index.json --keys detail_keys.json --out DIR
"""
import argparse
import json
import os
import subprocess
import sys
import tempfile

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from audit import Fetcher  # noqa: E402
from PIL import Image  # noqa: E402


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--index", required=True)
    ap.add_argument("--keys", required=True)
    ap.add_argument("--out", required=True)
    a = ap.parse_args()
    index = json.load(open(a.index, encoding="utf-8"))
    f = Fetcher()
    for key in json.load(open(a.keys)):
        rec = index[key]
        out = os.path.join(a.out, f"{key}-detail.jpg")
        if os.path.exists(out):
            continue
        r = f.get(rec["url"])
        with tempfile.TemporaryDirectory() as d:
            pdf = os.path.join(d, "x.pdf")
            open(pdf, "wb").write(r.content)
            subprocess.run(["pdftoppm", "-r", "45", "-gray", "-png", pdf, os.path.join(d, "p")], capture_output=True, timeout=600)
            ims = [Image.open(os.path.join(d, x)) for x in sorted(os.listdir(d)) if x.startswith("p")]
            if not ims:
                continue
            w = max(i.width for i in ims)
            h = max(i.height for i in ims)
            cols = 4
            rows = (len(ims) + cols - 1) // cols
            sheet = Image.new("L", (w * cols, h * rows), 255)
            for k, i in enumerate(ims):
                sheet.paste(i, ((k % cols) * w, (k // cols) * h))
            sheet.save(out, quality=55)
        print(key, rec["filename"], flush=True)
    return 0


if __name__ == "__main__":
    sys.exit(main())
