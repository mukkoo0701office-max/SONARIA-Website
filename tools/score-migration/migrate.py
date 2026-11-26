#!/usr/bin/env python3
"""
権利確認済み（approved）の楽譜だけを旧サイトから取得し、リポジトリに保存してカタログを作る（GitHub Actions 専用）。

- 入力: tools/score-migration/approvals.json（運営者が承認した内容。approved 以外の版はファイルを保存しない）
- 検査（audit.py）で記録した SHA-256 と一致しないファイルは保存しない（差し替え・誤リンクの防止）
- 同じ内容（同じ SHA-256）のファイルは 1 つだけ保存する
- 出力: frontend/public/scores/<作品ID>/<ファイルID>.pdf、1 ページ目の画像（-p1.jpg）、frontend/src/data/scores/catalog.json
- 作曲家の情報は frontend/src/data/scores/composers.json（作曲家マスター）で管理し、作品は composerId で参照する
- 旧サイトのデータは読むだけで、変更・削除しない

使い方: python migrate.py --approvals approvals.json --repo <リポジトリのルート>
"""
from __future__ import annotations

import argparse
import hashlib
import json
import os
import re
import sys
import time
from datetime import datetime, timezone

import subprocess

import requests
from PIL import Image

USER_AGENT = "SONARIA-score-migration/1.0 (site owner's migration)"
DELAY_SECONDS = 3.0
ID_RE = re.compile(r"^[a-z0-9][a-z0-9-]{1,80}$")
PARTS = {"score", "violin1", "violin2", "violin", "viola", "cello", "bass", "piano", "solo", "other"}


def make_preview(pdf_path: str, jpg_path: str) -> dict | None:
    """1 ページ目の画像（幅 600px の JPEG）。作品ページの先頭表示と OGP 画像に使う（PDF 本体を読み込ませないため）"""
    stem = jpg_path[: -len(".jpg")]
    r = subprocess.run(["pdftoppm", "-f", "1", "-l", "1", "-singlefile", "-scale-to-x", "600", "-scale-to-y", "-1", "-jpeg", "-jpegopt", "quality=72", pdf_path, stem], capture_output=True)
    if r.returncode != 0 or not os.path.exists(jpg_path):
        return None
    with Image.open(jpg_path) as im:
        w, h = im.size
    return {"w": w, "h": h}


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--approvals", required=True)
    ap.add_argument("--repo", required=True)
    args = ap.parse_args()

    with open(args.approvals, encoding="utf-8") as f:
        approvals = json.load(f)

    public_dir = os.path.join(args.repo, "frontend", "public")
    catalog_path = os.path.join(args.repo, "frontend", "src", "data", "scores", "catalog.json")
    session = requests.Session()
    session.headers["User-Agent"] = USER_AGENT
    stored_by_hash: dict[str, str] = {}
    report = {"stored": 0, "reused": 0, "skipped_not_approved": 0, "failed": []}
    last = 0.0
    works_out = []

    for work in approvals["works"]:
        if not ID_RE.match(work["id"]):
            raise SystemExit(f"invalid work id: {work['id']}")
        editions_out = []
        for ed in work["editions"]:
            approved = ed["rights"]["status"] == "approved"
            assets_out = []
            for asset in ed["assets"]:
                if not approved:
                    report["skipped_not_approved"] += 1
                    continue
                if not ID_RE.match(asset["id"]):
                    raise SystemExit(f"invalid asset id: {asset['id']}")
                if asset["part"] not in PARTS:
                    raise SystemExit(f"invalid part: {asset['part']} ({asset['id']})")
                rel = f"/scores/{work['id']}/{asset['id']}.pdf"
                dest = os.path.join(public_dir, rel.lstrip("/"))
                expected = asset["sha256"]
                if expected in stored_by_hash:
                    rel = stored_by_hash[expected]
                    report["reused"] += 1
                elif os.path.exists(dest) and hashlib.sha256(open(dest, "rb").read()).hexdigest() == expected:
                    stored_by_hash[expected] = rel
                else:
                    wait = DELAY_SECONDS - (time.time() - last)
                    if wait > 0:
                        time.sleep(wait)
                    try:
                        r = session.get(asset["url"], timeout=120)
                    finally:
                        last = time.time()
                    data = r.content if r.status_code == 200 else b""
                    actual = hashlib.sha256(data).hexdigest()
                    if r.status_code != 200 or actual != expected or not data.startswith(b"%PDF-"):
                        report["failed"].append({"asset": asset["id"], "url": asset["url"], "status": r.status_code, "sha256": actual})
                        continue
                    os.makedirs(os.path.dirname(dest), exist_ok=True)
                    with open(dest, "wb") as f:
                        f.write(data)
                    stored_by_hash[expected] = rel
                    report["stored"] += 1
                pdf_abs = os.path.join(public_dir, rel.lstrip("/"))
                jpg_rel = rel[: -len(".pdf")] + "-p1.jpg"
                jpg_abs = os.path.join(public_dir, jpg_rel.lstrip("/"))
                dims = None
                if os.path.exists(jpg_abs):
                    with Image.open(jpg_abs) as im:
                        dims = {"w": im.size[0], "h": im.size[1]}
                else:
                    dims = make_preview(pdf_abs, jpg_abs)
                out = {
                    "id": asset["id"],
                    "part": asset["part"],
                    "file": rel,
                    "filename": asset["filename"],
                    "preview": {"file": jpg_rel, "width": dims["w"], "height": dims["h"]} if dims else None,
                    "sha256": expected,
                    "pages": asset["pages"],
                    "bytes": asset["bytes"],
                }
                if asset.get("label"):
                    out["label"] = asset["label"]
                assets_out.append(out)
            editions_out.append({k: v for k, v in ed.items() if k != "assets"} | {"assets": assets_out})
        works_out.append({k: v for k, v in work.items() if k != "editions"} | {"editions": editions_out})

    catalog = {"version": 1, "generatedAt": datetime.now(timezone.utc).isoformat(timespec="seconds"), "works": works_out}
    os.makedirs(os.path.dirname(catalog_path), exist_ok=True)
    with open(catalog_path, "w", encoding="utf-8") as f:
        json.dump(catalog, f, ensure_ascii=False, indent=1)
        f.write("\n")
    print(json.dumps(report, ensure_ascii=False, indent=1))
    return 1 if report["failed"] else 0


if __name__ == "__main__":
    sys.exit(main())
