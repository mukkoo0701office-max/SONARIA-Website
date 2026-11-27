#!/usr/bin/env python3
"""
掲載中の楽譜 PDF の視認性（読みやすさ）を数値で調べる（GitHub Actions 専用）。

対象: frontend/src/data/scores/catalog.json の全ファイル（リリース scores-v1 から取得。旧サイトにはアクセスしない）
調べること（ページを最大 8 枚、均等に抜き出して測る）:
  - scan_ppi   … 埋め込み画像の解像度（スキャン譜の細かさ）。低いと音符・臨時記号がつぶれる
  - sharpness  … 輪郭のくっきり度（150dpi で描画した画像のエッジの分散）。低いとぼやけている
  - contrast   … 濃淡の差（明るい側 95% 点と暗い側 5% 点の差）。低いと薄い・かすれている
  - ink        … 黒い画素の割合。極端に少ない／多いと、白飛び・黒つぶれ・白紙の疑い
  - vector     … 文字・図形として描かれた PDF（浄書譜）か。浄書譜は拡大してもつぶれない
出力: legibility.json（作品 ID/ファイル ID → 指標）。判定は analyze 側で行い、疑わしいものは人が画像で確認する

使い方: python legibility.py --repo . --out legibility.json
"""
from __future__ import annotations

import argparse
import json
import os
import re
import statistics
import subprocess
import sys
import tempfile
from concurrent.futures import ThreadPoolExecutor

from PIL import Image, ImageFilter, ImageStat


def run(cmd: list[str]) -> str:
    return subprocess.run(cmd, capture_output=True, text=True, timeout=300).stdout


def pages_to_check(n: int, k: int = 8) -> list[int]:
    if n <= k:
        return list(range(1, n + 1))
    return sorted({1 + round(i * (n - 1) / (k - 1)) for i in range(k)})


def measure_page(pdf: str, page: int, tmp: str) -> dict:
    stem = os.path.join(tmp, f"p{page}")
    run(["pdftoppm", "-f", str(page), "-l", str(page), "-r", "150", "-gray", "-singlefile", "-png", pdf, stem])
    path = stem + ".png"
    if not os.path.exists(path):
        return {}
    with Image.open(path) as im:
        im = im.convert("L")
        hist = im.histogram()
        total = sum(hist)
        acc, p5, p95 = 0, 0, 255
        for v, c in enumerate(hist):
            acc += c
            if acc <= total * 0.05:
                p5 = v
            if acc <= total * 0.95:
                p95 = v
        ink = sum(hist[:128]) / total
        edges = im.filter(ImageFilter.FIND_EDGES)
        sharp = ImageStat.Stat(edges).var[0]
    os.remove(path)
    return {"page": page, "contrast": p95 - p5, "ink": round(ink, 4), "sharpness": round(sharp, 1)}


def scan_ppi(pdf: str) -> float | None:
    """pdfimages -list の x-ppi/y-ppi のうち、ページごとの最大画像の小さいほうを集め、その中央値"""
    out = run(["pdfimages", "-list", pdf])
    per_page: dict[int, float] = {}
    for line in out.splitlines()[2:]:
        cols = line.split()
        if len(cols) < 14:
            continue
        try:
            page, w, h, xppi, yppi = int(cols[0]), int(cols[3]), int(cols[4]), float(cols[12]), float(cols[13])
        except ValueError:
            continue
        if w * h < 200_000:  # 小さな画像（ロゴ・装飾）は除く
            continue
        per_page[page] = max(per_page.get(page, 0), min(xppi, yppi))
    return round(statistics.median(per_page.values()), 1) if per_page else None


def inspect(pdf: str, pages: int) -> dict:
    fonts = run(["pdffonts", pdf])
    vector = len(fonts.strip().splitlines()) > 2 and scan_ppi(pdf) is None
    tmp = tempfile.mkdtemp()
    with ThreadPoolExecutor(max_workers=4) as ex:
        ms = [m for m in ex.map(lambda p: measure_page(pdf, p, tmp), pages_to_check(pages)) if m]
    if not ms:
        return {"error": "描画できない"}
    return {
        "vector": vector,
        "scan_ppi": scan_ppi(pdf),
        "contrast_min": min(m["contrast"] for m in ms),
        "contrast_median": statistics.median(m["contrast"] for m in ms),
        "sharpness_median": round(statistics.median(m["sharpness"] for m in ms), 1),
        "sharpness_min": min(m["sharpness"] for m in ms),
        "ink_median": round(statistics.median(m["ink"] for m in ms), 4),
        "ink_max": max(m["ink"] for m in ms),
        "ink_min": min(m["ink"] for m in ms),
        "pages_checked": [m["page"] for m in ms],
        "worst_page": min(ms, key=lambda m: (m["contrast"], m["sharpness"]))["page"],
    }


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--repo", required=True)
    ap.add_argument("--out", required=True)
    ap.add_argument("--tag", default="scores-v1")
    args = ap.parse_args()
    catalog = json.load(open(os.path.join(args.repo, "frontend/src/data/scores/catalog.json"), encoding="utf-8"))
    out = json.load(open(args.out, encoding="utf-8")) if os.path.exists(args.out) else {}
    work_dir = tempfile.mkdtemp()
    for w in catalog["works"]:
        for e in w["editions"]:
            for a in e["assets"]:
                key = f"{w['id']}/{a['id']}"
                if key in out:
                    continue
                name = a["remote"].rsplit("/", 1)[-1]
                pdf = os.path.join(work_dir, name)
                r = subprocess.run(["gh", "release", "download", args.tag, "-p", name, "-O", pdf, "--clobber"], capture_output=True, text=True)
                if r.returncode != 0 or not os.path.exists(pdf):
                    out[key] = {"error": "取得失敗: " + r.stderr.strip()[:120]}
                    continue
                try:
                    out[key] = inspect(pdf, a["pages"]) | {"filename": name, "pages": a["pages"]}
                except Exception as ex:  # 1 件の失敗で全体を止めない
                    out[key] = {"error": f"{type(ex).__name__}: {ex}"[:200]}
                os.remove(pdf)
                with open(args.out, "w", encoding="utf-8") as f:
                    json.dump(out, f, ensure_ascii=False, indent=1)
    print(json.dumps({"files": len(out)}))
    return 0


if __name__ == "__main__":
    sys.exit(main())
