#!/usr/bin/env python3
"""
視認性の数値で疑わしいファイルについて、いちばん悪いページの中央部分を拡大した画像（等倍で見える 150dpi）を作る。
人が目で見て、音符・臨時記号・スラーが読めるかを判断するための材料（GitHub Actions 専用）。

使い方: python legibility_crops.py --repo . --legibility legibility.json --out-dir crops/
"""
from __future__ import annotations

import argparse
import json
import os
import subprocess
import sys
import tempfile

from PIL import Image


def flagged(v: dict) -> bool:
    if v.get("vector") or "error" in v:
        return False
    return (v.get("scan_ppi") or 999) < 150 or v["contrast_median"] < 170 or v["sharpness_median"] < 2500 or v["ink_median"] > 0.3 or v["ink_median"] < 0.02


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--repo", required=True)
    ap.add_argument("--legibility", required=True)
    ap.add_argument("--out-dir", required=True)
    ap.add_argument("--tag", default="scores-v1")
    args = ap.parse_args()
    leg = json.load(open(args.legibility, encoding="utf-8"))
    os.makedirs(args.out_dir, exist_ok=True)
    tmp = tempfile.mkdtemp()
    index = []
    for key, v in sorted(leg.items()):
        if not flagged(v):
            continue
        pdf = os.path.join(tmp, v["filename"])
        subprocess.run(["gh", "release", "download", args.tag, "-p", v["filename"], "-O", pdf, "--clobber"], capture_output=True)
        page = v["worst_page"]
        stem = os.path.join(tmp, "page")
        subprocess.run(["pdftoppm", "-f", str(page), "-l", str(page), "-r", "150", "-gray", "-singlefile", "-png", pdf, stem], capture_output=True)
        if not os.path.exists(stem + ".png"):
            continue
        with Image.open(stem + ".png") as im:
            w, h = im.size
            cw, ch = min(900, w), min(650, h)
            box = ((w - cw) // 2, int(h * 0.30), (w - cw) // 2 + cw, int(h * 0.30) + ch)
            name = key.replace("/", "__") + ".jpg"
            im.crop(box).save(os.path.join(args.out_dir, name), quality=80)
        index.append({"key": key, "page": page, "image": name})
        os.remove(pdf)
    json.dump(index, open(os.path.join(args.out_dir, "index.json"), "w"), ensure_ascii=False, indent=1)
    print(len(index))
    return 0


if __name__ == "__main__":
    sys.exit(main())
