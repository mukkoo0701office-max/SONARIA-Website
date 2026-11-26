#!/usr/bin/env python3
"""
楽譜 PDF を旧サイトから取得し、GitHub のリリース（添付ファイル）に保存してカタログを作る（GitHub Actions 専用）。

- 入力: tools/score-migration/approvals.json（analyze.py の出力。rights.status が rejected の版は扱わない）
- 検査（audit.py）で記録した SHA-256 と一致しないファイルは保存しない（差し替え・誤リンクの防止）
- 同じ内容（同じ SHA-256）のファイルは 1 つだけ保存する
- PDF 本体はリポジトリに入れず、リリース（--release-tag）の添付ファイルにする
  （合計約 1.7GB で GitHub Pages の上限 1GB を超えるため。リリースの添付は後から完全に削除・差し替えできる）
- 1 ページ目の画像（幅 600px の JPEG）は frontend/public/scores/<作品ID>/<ファイルID>-p1.jpg に保存する
- 出力: frontend/src/data/scores/catalog.json（各ファイルに、本番用のパス file と、リリースの URL remote を記録）
- 作曲家の情報は frontend/src/data/scores/composers.json（作曲家マスター）で管理し、作品は composerId で参照する
- 旧サイトのデータは読むだけで、変更・削除しない。途中で止まっても、保存済みのファイルは取り直さない

使い方: python migrate.py --approvals approvals.json --repo <リポジトリのルート> --release-tag scores-v1
環境変数: GH_TOKEN（リリースへの書き込み）、GITHUB_REPOSITORY（owner/repo）
"""
from __future__ import annotations

import argparse
import hashlib
import json
import os
import re
import subprocess
import sys
import tempfile
import time
from datetime import datetime, timezone

import requests
from PIL import Image

USER_AGENT = "SONARIA-score-migration/1.0 (site owner's migration)"
DELAY_SECONDS = 5.0  # 旧サイトの robots.txt の Crawl-Delay に合わせる
ID_RE = re.compile(r"^[a-z0-9][a-z0-9-]{1,80}$")
PARTS = {"score", "violin1", "violin2", "violin", "viola", "cello", "bass", "piano", "solo", "other"}


def gh(*args: str) -> str:
    r = subprocess.run(["gh", *args], capture_output=True, text=True)
    if r.returncode != 0:
        raise RuntimeError(f"gh {' '.join(args[:3])} failed: {r.stderr.strip()[:300]}")
    return r.stdout


def ensure_release(tag: str) -> set[str]:
    """リリースが無ければ作る。既存の添付ファイル名を返す"""
    try:
        out = gh("release", "view", tag, "--json", "assets")
    except RuntimeError:
        gh(
            "release", "create", tag,
            "--title", "楽譜 PDF（旧サイトから移行・権利確認前）",
            "--notes", "SONARIA 楽譜ライブラリの PDF。旧サイトから移行したもので、運営者が公開前に権利を確認し、必要に応じて差し替え・削除する。",
            "--prerelease",
            "--target", os.environ.get("GITHUB_SHA", "HEAD"),
        )
        out = gh("release", "view", tag, "--json", "assets")
    return {a["name"] for a in json.loads(out)["assets"]}


def make_preview(pdf_path: str, jpg_path: str) -> None:
    """1 ページ目の画像。作品ページの先頭表示と OGP 画像に使う（PDF 本体を読み込ませないため）"""
    os.makedirs(os.path.dirname(jpg_path), exist_ok=True)
    stem = jpg_path[: -len(".jpg")]
    subprocess.run(["pdftoppm", "-f", "1", "-l", "1", "-singlefile", "-scale-to-x", "600", "-scale-to-y", "-1", "-jpeg", "-jpegopt", "quality=72", pdf_path, stem], capture_output=True)


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--approvals", required=True)
    ap.add_argument("--repo", required=True)
    ap.add_argument("--release-tag", default="scores-v1")
    ap.add_argument("--time-budget", type=int, default=5 * 3600)
    args = ap.parse_args()
    deadline = time.time() + args.time_budget

    approvals = json.load(open(args.approvals, encoding="utf-8"))
    public_dir = os.path.join(args.repo, "frontend", "public")
    catalog_path = os.path.join(args.repo, "frontend", "src", "data", "scores", "catalog.json")
    repo = os.environ["GITHUB_REPOSITORY"]
    released = ensure_release(args.release_tag)
    session = requests.Session()
    session.headers["User-Agent"] = USER_AGENT
    remote_by_hash: dict[str, str] = {}
    report = {"downloaded": 0, "already_released": 0, "reused_same_content": 0, "skipped_rejected": 0, "failed": [], "out_of_time": 0}
    last = 0.0
    works_out = []
    tmp = tempfile.mkdtemp()

    for work in approvals["works"]:
        if not ID_RE.match(work["id"]):
            raise SystemExit(f"invalid work id: {work['id']}")
        editions_out = []
        for ed in work["editions"]:
            if ed["rights"]["status"] == "rejected":
                report["skipped_rejected"] += len(ed["assets"])
                continue
            assets_out = []
            for asset in ed["assets"]:
                if not ID_RE.match(asset["id"]) or asset["part"] not in PARTS:
                    raise SystemExit(f"invalid asset: {asset['id']} / {asset['part']} ({work['id']})")
                expected = asset["sha256"]
                name = f"{work['id']}--{asset['id']}.pdf"
                jpg_rel = f"/scores/{work['id']}/{asset['id']}-p1.jpg"
                jpg_abs = os.path.join(public_dir, jpg_rel.lstrip("/"))
                remote = remote_by_hash.get(expected)
                if remote:
                    report["reused_same_content"] += 1
                    if not os.path.exists(jpg_abs):
                        # 同じ内容の画像を別の作品でも使えるよう複製する
                        src = next((p for h, p in preview_by_hash.items() if h == expected), None)
                        if src and os.path.exists(src):
                            os.makedirs(os.path.dirname(jpg_abs), exist_ok=True)
                            with open(src, "rb") as fi, open(jpg_abs, "wb") as fo:
                                fo.write(fi.read())
                elif name in released and os.path.exists(jpg_abs):
                    remote = f"https://github.com/{repo}/releases/download/{args.release_tag}/{name}"
                    report["already_released"] += 1
                else:
                    if time.time() > deadline:
                        report["out_of_time"] += 1
                        continue
                    wait = DELAY_SECONDS - (time.time() - last)
                    if wait > 0:
                        time.sleep(wait)
                    try:
                        r = session.get(asset["url"], timeout=180)
                        data = r.content if r.status_code == 200 else b""
                        status = r.status_code
                    except requests.RequestException as ex:
                        data, status = b"", type(ex).__name__
                    finally:
                        last = time.time()
                    actual = hashlib.sha256(data).hexdigest()
                    if actual != expected or not data.startswith(b"%PDF-"):
                        report["failed"].append({"asset": f"{work['id']}/{asset['id']}", "url": asset["url"], "status": status, "sha256": actual})
                        continue
                    pdf_path = os.path.join(tmp, name)
                    with open(pdf_path, "wb") as f:
                        f.write(data)
                    make_preview(pdf_path, jpg_abs)
                    if name not in released:
                        gh("release", "upload", args.release_tag, pdf_path, "--clobber")
                        released.add(name)
                    os.remove(pdf_path)
                    remote = f"https://github.com/{repo}/releases/download/{args.release_tag}/{name}"
                    report["downloaded"] += 1
                remote_by_hash.setdefault(expected, remote)
                preview_by_hash.setdefault(expected, jpg_abs)
                dims = None
                if os.path.exists(jpg_abs):
                    with Image.open(jpg_abs) as im:
                        dims = {"w": im.size[0], "h": im.size[1]}
                out = {
                    "id": asset["id"],
                    "part": asset["part"],
                    "file": f"/scores/{work['id']}/{asset['id']}.pdf",  # 本番（さくら）に置くときのパス
                    "remote": remote,  # リリースの添付ファイル（プレビューではここからダウンロードする）
                    "filename": asset["filename"],
                    "preview": {"file": jpg_rel, "width": dims["w"], "height": dims["h"]} if dims else None,
                    "sha256": expected,
                    "pages": asset["pages"],
                    "bytes": asset["bytes"],
                }
                if asset.get("label"):
                    out["label"] = asset["label"]
                assets_out.append(out)
            if assets_out:
                editions_out.append({k: v for k, v in ed.items() if k != "assets"} | {"assets": assets_out})
        if editions_out:
            works_out.append({k: v for k, v in work.items() if k != "editions"} | {"editions": editions_out})

    catalog = {"version": 1, "generatedAt": datetime.now(timezone.utc).isoformat(timespec="seconds"), "works": works_out}
    os.makedirs(os.path.dirname(catalog_path), exist_ok=True)
    with open(catalog_path, "w", encoding="utf-8") as f:
        json.dump(catalog, f, ensure_ascii=False, indent=1)
        f.write("\n")
    print(json.dumps(report, ensure_ascii=False, indent=1))
    # 時間切れは次回の実行で続きから。取得失敗は記録して続行（無理に代替しない）
    return 0


preview_by_hash: dict[str, str] = {}

if __name__ == "__main__":
    sys.exit(main())
