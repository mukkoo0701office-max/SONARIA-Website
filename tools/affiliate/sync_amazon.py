#!/usr/bin/env python3
"""
GPT の Amazon 関連商品調査キュー（docs/affiliate-research/queue.json）から、
サイトに載せてよい商品だけを frontend/src/data/affiliate/amazon.json に書き出す。

載せる条件（すべて満たすもの。docs/affiliate-research/README.md の仕様）:
  - status が approved_for_implementation
  - asin が 10 文字の ASIN で、amazon_url が https://www.amazon.co.jp/dp/{ASIN} の商品ページ
  - 確認日（verified_at / checked_at / updated_at）がある
  - work_ids の作品番号が、SONARIA に掲載中の作品（同じ作曲者）と一致する
リンクは https://www.amazon.co.jp/dp/{ASIN}?tag=mukkoo-22 に作り直す（キューの URL の余分なパラメータは使わない）。
条件を満たさない商品は理由つきで標準出力に出す（サイトには出さない）。

使い方: python tools/affiliate/sync_amazon.py --queue docs/affiliate-research/queue.json --repo .
"""
from __future__ import annotations

import argparse
import json
import os
import re
import sys
from datetime import date

TAG = "mukkoo-22"
CATEGORIES = {"printed_score", "pocket_score", "book", "recording", "accessory"}


def catalog_keys(text: str) -> set[tuple[str, str, str]]:
    """'Op.76 No.3' → {('op','76','3')}、'K.136/125a' → {('k','136','')}、'KV168' → {('k','168','')}"""
    t = text.lower().replace(" ", "")
    out = set()
    for m in re.finditer(r"op\.?(\d+)(?:,?no\.?(\d+)|-(\d+))?", t):
        out.add(("op", m.group(1), m.group(2) or m.group(3) or ""))
    for m in re.finditer(r"k(?:v)?\.?(\d+)", t):
        out.add(("k", m.group(1), ""))
    for m in re.finditer(r"bwv\.?(\d+)", t):
        out.add(("bwv", m.group(1), ""))
    for m in re.finditer(r"hob\.?([ivx]+):(\d+)", t):
        out.add(("hob", m.group(1) + ":" + m.group(2), ""))
    return out


def work_keys(work: dict) -> set[tuple[str, str, str]]:
    out = set()
    for c in work.get("catalog", []):
        nums = re.findall(r"\d+", c["value"])
        if not nums:
            continue
        if c["type"] == "op":
            out.add(("op", nums[0], nums[1] if len(nums) > 1 and "-" in c["value"] else ""))
        elif c["type"] in ("k", "bwv"):
            out.add((c["type"], nums[0], ""))
    return out


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--queue", required=True)
    ap.add_argument("--repo", required=True)
    args = ap.parse_args()
    queue = json.load(open(args.queue, encoding="utf-8"))
    catalog = json.load(open(os.path.join(args.repo, "frontend/src/data/scores/catalog.json"), encoding="utf-8"))
    composers = {c["id"]: c for c in json.load(open(os.path.join(args.repo, "frontend/src/data/scores/composers.json"), encoding="utf-8"))}

    out, skipped = [], []
    for item in queue.get("items", []):
        iid = item.get("id", "?")
        if item.get("status") != "approved_for_implementation":
            skipped.append((iid, f"status={item.get('status')}"))
            continue
        asin = (item.get("asin") or "").strip().upper()
        url = (item.get("amazon_url") or "").strip()
        if not re.fullmatch(r"[A-Z0-9]{10}", asin) or not re.match(rf"^https://www\.amazon\.co\.jp/(?:[^/]+/)?dp/{asin}(?:[/?].*)?$", url):
            skipped.append((iid, "ASIN か商品ページ URL を確認できない"))
            continue
        verified = item.get("verified_at") or item.get("checked_at") or item.get("updated_at")
        if not verified:
            skipped.append((iid, "確認日が無い"))
            continue
        composer_name = (item.get("composer") or "").lower()
        keys = set().union(*[catalog_keys(w) for w in item.get("work_ids", [])]) if item.get("work_ids") else set()
        works = [
            w["id"]
            for w in catalog["works"]
            if composer_name and composer_name in composers[w["composerId"]]["name"]["en"].lower()
            # 作品番号が一致するもの（Op.76 の曲集なら Op.76 No.3 の作品も対象）
            and any(k[:2] == wk[:2] and (not k[2] or not wk[2] or k[2] == wk[2]) for k in keys for wk in work_keys(w))
        ]
        if not works:
            skipped.append((iid, "掲載中の作品と作品番号が一致しない"))
            continue
        category = item.get("category") if item.get("category") in CATEGORIES else "printed_score"
        rec = {
            "id": iid,
            "asin": asin,
            "url": f"https://www.amazon.co.jp/dp/{asin}?tag={TAG}",
            "title": item.get("title", ""),
            "category": category,
            "workIds": sorted(works),
            "verifiedAt": verified[:10],
        }
        if item.get("note_ja") or item.get("note_en"):
            rec["note"] = {"ja": item.get("note_ja") or "", "en": item.get("note_en") or item.get("note_ja") or ""}
        out.append(rec)

    path = os.path.join(args.repo, "frontend/src/data/affiliate/amazon.json")
    data = {"syncedAt": date.today().isoformat(), "source": "docs/affiliate-research/queue.json（status=approved_for_implementation のみ。tools/affiliate/sync_amazon.py で生成）", "items": out}
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=1)
        f.write("\n")
    print(json.dumps({"published": len(out), "skipped": len(skipped)}, ensure_ascii=False))
    for iid, why in skipped:
        print(f"  保留 {iid}: {why}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
