#!/usr/bin/env python3
"""移行で保留にした旧サイトの PDF を取り直し、人が目で確認するための画像を作る（GitHub Actions 専用）。

- 対象: report.json で decision=hold のファイルと、取得に失敗したファイル
- 旧サイトへは audit.py の Fetcher（robots.txt を守る・5 秒間隔）で 1 件ずつ取得する。旧サイトのデータは変更しない
- ZIP（PDF ではない）は中身を一覧し、入っている PDF も確認用の画像にする
- 出力（--out）: index.json（ファイルごとの SHA-256・ページ数・1 ページ目の文字）と、
  各ファイルの 1 ページ目（幅 700px）と全ページの縮小一覧（contact sheet）
- 途中で止まっても、出力済みのファイルは取り直さない
使い方: python held_review.py --report report.json --out DIR
"""
from __future__ import annotations

import argparse
import hashlib
import io
import json
import os
import re
import subprocess
import sys
import tempfile
import zipfile

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from audit import Fetcher  # noqa: E402
from PIL import Image  # noqa: E402


def run(cmd: list[str]) -> str:
    return subprocess.run(cmd, capture_output=True, text=True, timeout=300).stdout


def pages_of(pdf: str) -> int:
    m = re.search(r"^Pages:\s+(\d+)", run(["pdfinfo", pdf]), re.M)
    return int(m.group(1)) if m else 0


def render(pdf: str, out_prefix: str) -> dict:
    n = pages_of(pdf)
    info = {"pages": n}
    if not n:
        return info
    with tempfile.TemporaryDirectory() as d:
        run(["pdftoppm", "-f", "1", "-l", "1", "-r", "90", "-gray", "-singlefile", "-png", pdf, os.path.join(d, "p1")])
        if os.path.exists(os.path.join(d, "p1.png")):
            im = Image.open(os.path.join(d, "p1.png"))
            im.thumbnail((700, 1000))
            im.save(out_prefix + "-p1.jpg", quality=70)
        # 全ページの縮小一覧（最大 24 ページ）
        last = min(n, 24)
        run(["pdftoppm", "-f", "1", "-l", str(last), "-r", "22", "-gray", "-png", pdf, os.path.join(d, "s")])
        thumbs = sorted(f for f in os.listdir(d) if f.startswith("s"))
        if thumbs:
            ims = [Image.open(os.path.join(d, f)) for f in thumbs]
            w = max(i.width for i in ims)
            h = max(i.height for i in ims)
            cols = 6
            rows = (len(ims) + cols - 1) // cols
            sheet = Image.new("L", (w * cols, h * rows), 255)
            for k, i in enumerate(ims):
                sheet.paste(i, ((k % cols) * w, (k // cols) * h))
            sheet.save(out_prefix + "-sheet.jpg", quality=60)
    info["text_p1"] = run(["pdftotext", "-f", "1", "-l", "1", "-layout", pdf, "-"])[:600]
    return info


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--report", required=True, action="append")
    ap.add_argument("--out", required=True)
    a = ap.parse_args()
    report = []
    for path in a.report:
        if os.path.exists(path):
            report += json.load(open(path, encoding="utf-8"))["results"]
    targets = [x for x in report if x.get("decision") != "migrate"]
    os.makedirs(a.out, exist_ok=True)
    idx_path = os.path.join(a.out, "index.json")
    index = json.load(open(idx_path, encoding="utf-8")) if os.path.exists(idx_path) else {}
    f = Fetcher()
    for k, x in enumerate(targets, 1):
        key = hashlib.sha1(x["url"].encode()).hexdigest()[:12]
        if key in index and index[key].get("status") in ("ok", "zip", "not_pdf"):
            index[key]["decision"] = x.get("decision")
            continue
        rec = {"key": key, "heading": x["heading"], "page": x["page"], "url": x["url"], "filename": x.get("filename"), "part": x.get("part"), "reasons": x.get("reasons", []), "report_sha256": x.get("sha256"), "decision": x.get("decision")}
        if not f.allowed(x["url"]):
            rec["status"] = "robots_disallowed"
            index[key] = rec
            continue
        r = f.get(x["url"])
        data = r.content if r.status_code == 200 else b""
        rec["http"] = r.status_code
        rec["sha256"] = hashlib.sha256(data).hexdigest() if data else None
        rec["bytes"] = len(data)
        rec["sha_matches_report"] = bool(data) and rec["sha256"] == x.get("sha256")
        prefix = os.path.join(a.out, key)
        if not data:
            rec["status"] = "download_failed"
        elif data[:4] == b"%PDF":
            tmp = prefix + ".pdf"
            open(tmp, "wb").write(data)
            rec.update(render(tmp, prefix))
            os.remove(tmp)
            rec["status"] = "ok"
        elif data[:2] == b"PK":
            rec["status"] = "zip"
            rec["zip"] = []
            with zipfile.ZipFile(io.BytesIO(data)) as z:
                for i, info in enumerate(z.infolist()):
                    name = info.filename.encode("cp437", "replace").decode("cp932", "replace") if not info.flag_bits & 0x800 else info.filename
                    ent = {"name": name, "size": info.file_size}
                    if name.lower().endswith(".pdf") and not name.startswith("__MACOSX"):
                        body = z.read(info)
                        ent["sha256"] = hashlib.sha256(body).hexdigest()
                        tmp = f"{prefix}-z{i}.pdf"
                        open(tmp, "wb").write(body)
                        ent.update(render(tmp, f"{prefix}-z{i}"))
                        os.remove(tmp)
                        ent["image_prefix"] = f"{key}-z{i}"
                    rec["zip"].append(ent)
        else:
            rec["status"] = "not_pdf"
            rec["head"] = data[:16].hex()
        index[key] = rec
        json.dump(index, open(idx_path, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
        print(k, len(targets), rec["status"], x["heading"][:30], flush=True)
    json.dump(index, open(idx_path, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    return 0


if __name__ == "__main__":
    sys.exit(main())
