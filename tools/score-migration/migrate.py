#!/usr/bin/env python3
"""
楽譜 PDF を GitHub のリリース（添付ファイル）に保存し、カタログを作る（GitHub Actions 専用）。

- 入力: tools/score-migration/approvals.json（analyze.py の出力。rights.status が rejected の版は扱わない）
- PDF は旧サイトから取得し、検査（audit.py）で記録した SHA-256 と一致するものだけを使う（差し替え・誤リンクの防止）
- 保存する PDF には統一した文書情報（タイトル・作曲者・件名・キーワード）を書き込み、
  統一ファイル名（naming.py。例: Beethoven_Violin-Sonata-No5-Op24_Violin.pdf）でリリースに置く
- 以前の名前（<作品ID>--<ファイルID>.pdf）で置いた添付ファイルは、取り直さずに文書情報を書き込んで統一名で置き直す。
  公開中のプレビューが以前の名前を参照しているあいだは以前の名前も残し、切り替え後に --drop-legacy で消す
- PDF 本体はリポジトリに入れない（合計約 1.5GB で GitHub Pages の上限 1GB を超えるため。リリースの添付は後から完全に削除・差し替えできる）
- 1 ページ目の画像（幅 600px の JPEG）は frontend/public/scores/<作品ID>/<ファイルID>-p1.jpg に保存する
- 出力: frontend/src/data/scores/catalog.json
- 旧サイトのデータは読むだけで、変更・削除しない。途中で止まっても、処理済みのファイルはやり直さない

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

import pikepdf
import requests
from PIL import Image

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from naming import doc_info, unique_names  # noqa: E402

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


def stamp(src: str, dst: str, info: dict[str, str]) -> None:
    """文書情報を書き込む（ページの中身は変えない）"""
    with pikepdf.open(src) as pdf:
        for k, v in info.items():
            pdf.docinfo[k] = v
        pdf.save(dst)


def sha256_of(path: str) -> str:
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--approvals", required=True)
    ap.add_argument("--repo", required=True)
    ap.add_argument("--release-tag", default="scores-v1")
    ap.add_argument("--time-budget", type=int, default=5 * 3600)
    ap.add_argument("--drop-legacy", dest="keep_legacy", action="store_false", help="以前の名前（<作品ID>--<ファイルID>.pdf）の添付ファイルを消す")
    args = ap.parse_args()
    deadline = time.time() + args.time_budget

    approvals = json.load(open(args.approvals, encoding="utf-8"))
    public_dir = os.path.join(args.repo, "frontend", "public")
    data_dir = os.path.join(args.repo, "frontend", "src", "data", "scores")
    catalog_path = os.path.join(data_dir, "catalog.json")
    composers = {c["id"]: c for c in json.load(open(os.path.join(data_dir, "composers.json"), encoding="utf-8"))}
    # 前回のカタログ（処理済みの判定と、書き込み済み PDF の SHA-256 を引き継ぐ）
    previous: dict[tuple[str, str], dict] = {}
    if os.path.exists(catalog_path):
        for w in json.load(open(catalog_path, encoding="utf-8")).get("works", []):
            for e in w["editions"]:
                for a in e["assets"]:
                    previous[(w["id"], a["id"])] = a
    names = unique_names([(w, composers[w["composerId"]], a) for w in approvals["works"] for e in w["editions"] if e["rights"]["status"] != "rejected" for a in e["assets"]])

    repo = os.environ["GITHUB_REPOSITORY"]
    tag = args.release_tag
    released = ensure_release(tag)
    session = requests.Session()
    session.headers["User-Agent"] = USER_AGENT
    report = {"from_old_site": 0, "renamed": 0, "unchanged": 0, "skipped_rejected": 0, "failed": [], "out_of_time": 0}
    last = 0.0
    works_out = []
    tmp = tempfile.mkdtemp()

    for work in approvals["works"]:
        if not ID_RE.match(work["id"]):
            raise SystemExit(f"invalid work id: {work['id']}")
        composer = composers[work["composerId"]]
        editions_out = []
        for ed in work["editions"]:
            if ed["rights"]["status"] == "rejected":
                report["skipped_rejected"] += len(ed["assets"])
                continue
            assets_out = []
            for asset in ed["assets"]:
                if not ID_RE.match(asset["id"]) or asset["part"] not in PARTS:
                    raise SystemExit(f"invalid asset: {asset['id']} / {asset['part']} ({work['id']})")
                original_sha = asset["sha256"]
                name = names[(work["id"], asset["id"])]
                old_name = f"{work['id']}--{asset['id']}.pdf"
                remote = f"https://github.com/{repo}/releases/download/{tag}/{name}"
                jpg_rel = f"/scores/{work['id']}/{asset['id']}-p1.jpg"
                jpg_abs = os.path.join(public_dir, jpg_rel.lstrip("/"))
                prev = previous.get((work["id"], asset["id"]), {})
                stamped = os.path.join(tmp, name)

                if name in released and prev.get("remote") == remote and prev.get("sha256") and os.path.exists(jpg_abs):
                    # 処理済み
                    sha, size = prev["sha256"], prev["bytes"]
                    report["unchanged"] += 1
                else:
                    if time.time() > deadline:
                        report["out_of_time"] += 1
                        continue
                    raw = os.path.join(tmp, "raw.pdf")
                    if old_name in released:
                        # 以前の名前で置いたファイルを取り出す（旧サイトにはアクセスしない）
                        gh("release", "download", tag, "-p", old_name, "-O", raw, "--clobber")
                        source = "release"
                    else:
                        wait = DELAY_SECONDS - (time.time() - last)
                        if wait > 0:
                            time.sleep(wait)
                        try:
                            r = session.get(asset["url"], timeout=(30, 600))  # 旧サイトの応答が遅いことがあるため読み込みは長めに待つ
                            data = r.content if r.status_code == 200 else b""
                            status = r.status_code
                        except requests.RequestException as ex:
                            data, status = b"", type(ex).__name__
                        finally:
                            last = time.time()
                        with open(raw, "wb") as f:
                            f.write(data)
                        source = f"old_site (HTTP {status})"
                    if sha256_of(raw) != original_sha:
                        report["failed"].append({"asset": f"{work['id']}/{asset['id']}", "source": source, "reason": "SHA-256 が検査時と違う"})
                        continue
                    stamp(raw, stamped, doc_info(work, composer, asset))
                    if not os.path.exists(jpg_abs):
                        make_preview(stamped, jpg_abs)
                    gh("release", "upload", tag, stamped, "--clobber")
                    released.add(name)
                    sha, size = sha256_of(stamped), os.path.getsize(stamped)
                    if args.keep_legacy and old_name != name and old_name not in released:
                        # 公開中のプレビューが以前の名前を参照しているあいだは、以前の名前のファイルも残す（--drop-legacy で消す）
                        legacy = os.path.join(tmp, old_name)
                        os.replace(stamped, legacy)
                        gh("release", "upload", tag, legacy, "--clobber")
                        released.add(old_name)
                        stamped = legacy
                    os.remove(stamped)
                    report["renamed" if source == "release" else "from_old_site"] += 1

                dims = None
                if os.path.exists(jpg_abs):
                    with Image.open(jpg_abs) as im:
                        dims = {"w": im.size[0], "h": im.size[1]}
                out = {
                    "id": asset["id"],
                    "part": asset["part"],
                    "file": f"/scores/{work['id']}/{name}",  # 本番（さくら）に置くときのパス
                    "remote": remote,  # リリースの添付ファイル（プレビューではここからダウンロードする）
                    "filename": name,
                    "preview": {"file": jpg_rel, "width": dims["w"], "height": dims["h"]} if dims else None,
                    "sha256": sha,  # 文書情報を書き込んだ後の値
                    "originalSha256": original_sha,  # 旧サイトの PDF の値（検査記録との照合用）
                    "pages": asset["pages"],
                    "bytes": size,
                }
                if asset.get("label"):
                    out["label"] = asset["label"]
                assets_out.append(out)
            if assets_out:
                editions_out.append({k: v for k, v in ed.items() if k != "assets"} | {"assets": assets_out})
        if editions_out:
            works_out.append({k: v for k, v in work.items() if k != "editions"} | {"editions": editions_out})

    if not args.keep_legacy:
        legacy_names = {f"{w['id']}--{a['id']}.pdf" for w in approvals["works"] for e in w["editions"] for a in e["assets"]}
        for n in sorted(released & legacy_names):
            if n not in set(names.values()):
                gh("release", "delete-asset", tag, n, "--yes")
                report.setdefault("legacy_deleted", 0)
                report["legacy_deleted"] += 1

    catalog = {"version": 1, "generatedAt": datetime.now(timezone.utc).isoformat(timespec="seconds"), "works": works_out}
    with open(catalog_path, "w", encoding="utf-8") as f:
        json.dump(catalog, f, ensure_ascii=False, indent=1)
        f.write("\n")
    print(json.dumps(report, ensure_ascii=False, indent=1))
    # 時間切れは次回の実行で続きから。取得失敗は記録して続行（無理に代替しない）
    return 0


if __name__ == "__main__":
    sys.exit(main())
