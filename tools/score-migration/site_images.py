#!/usr/bin/env python3
"""旧サイトの主なページ（トップ・メニューのページ・管理人プロフィールなど）にある画像を集め、
人が選ぶための一覧を作る（GitHub Actions 専用）。会員限定ページ・ブログ記事は対象外。
robots.txt を守り、5 秒間隔で取得する。旧サイトのデータは変更しない。
出力: images/（取得した画像）、index.json（ページ・alt・大きさ）、sheet-*.jpg（一覧）
使い方: python site_images.py --out DIR
"""
import argparse
import hashlib
import io
import json
import os
import re
import sys
import time
from urllib.parse import urljoin, urlparse
from urllib.robotparser import RobotFileParser

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from audit import BASE, Fetcher, is_excluded, is_same_site, norm  # noqa: E402
from bs4 import BeautifulSoup  # noqa: E402
from PIL import Image, ImageDraw  # noqa: E402

_robots: dict[str, RobotFileParser] = {}


def allowed_other(fetcher: Fetcher, url: str) -> bool:
    host = urlparse(url).netloc
    if host not in _robots:
        rp = RobotFileParser()
        try:
            r = fetcher.get(f"https://{host}/robots.txt")
            rp.parse(r.text.splitlines() if r.ok else [])
        except Exception:
            rp.parse([])
        _robots[host] = rp
    return _robots[host].can_fetch("*", url)


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", required=True)
    ap.add_argument("--max-images", type=int, default=120)
    a = ap.parse_args()
    os.makedirs(os.path.join(a.out, "images"), exist_ok=True)
    f = Fetcher()
    # トップと、トップから直接リンクされている固定ページ（日付のあるブログ記事は除く）
    top = f.get(BASE + "/")
    soup = BeautifulSoup(top.text, "html.parser")
    pages = [BASE + "/"]
    for el in soup.find_all("a", href=True):
        u = norm(urljoin(BASE + "/", el["href"]))
        if is_same_site(u) and not is_excluded(u) and not re.search(r"/\d{4}/\d{2}/\d{2}/|/app/|#", u) and u not in pages:
            pages.append(u)
    pages = pages[:40]
    images: dict[str, dict] = {}
    for p in pages:
        if not f.allowed(p):
            continue
        r = f.get(p) if p != BASE + "/" else top
        if r.status_code != 200:
            continue
        s = BeautifulSoup(r.text, "html.parser")
        title = s.title.get_text(strip=True) if s.title else ""
        for img in s.find_all("img"):
            src = img.get("data-src") or img.get("src") or ""
            srcset = img.get("srcset") or img.get("data-srcset") or ""
            if srcset:
                # 一番大きい候補を使う
                cands = [c.strip().split(" ") for c in srcset.split(",") if c.strip()]
                src = cands[-1][0] if cands else src
            if not src or src.startswith("data:"):
                continue
            u = urljoin(p, src)
            rec = images.setdefault(u, {"url": u, "pages": [], "alt": img.get("alt") or "", "title": title})
            if p not in rec["pages"]:
                rec["pages"].append(p)
        # 背景画像（style の url(...)）
        for m in re.finditer(r"url\(['\"]?([^'\")]+\.(?:jpe?g|png|webp))", r.text, re.I):
            u = urljoin(p, m.group(1))
            rec = images.setdefault(u, {"url": u, "pages": [], "alt": "(背景)", "title": title})
            if p not in rec["pages"]:
                rec["pages"].append(p)
    out = []
    for i, rec in enumerate(list(images.values())[: a.max_images]):
        u = rec["url"]
        if not (f.allowed(u) if is_same_site(u) else allowed_other(f, u)):
            rec["status"] = "robots"
            out.append(rec)
            continue
        try:
            r = f.get(u)
        except Exception as e:
            rec["status"] = f"error {type(e).__name__}"
            out.append(rec)
            continue
        if r.status_code != 200:
            rec["status"] = f"http {r.status_code}"
            out.append(rec)
            continue
        try:
            im = Image.open(io.BytesIO(r.content))
            im.load()
        except Exception:
            rec["status"] = "not_image"
            out.append(rec)
            continue
        key = hashlib.sha1(r.content).hexdigest()[:12]
        ext = (im.format or "jpg").lower().replace("jpeg", "jpg")
        path = f"images/{key}.{ext}"
        open(os.path.join(a.out, path), "wb").write(r.content)
        rec.update(status="ok", file=path, width=im.width, height=im.height, bytes=len(r.content), key=key)
        out.append(rec)
        print(i, im.width, im.height, u[-60:], flush=True)
    json.dump(out, open(os.path.join(a.out, "index.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    # 一覧（小さい画像・アイコンは除く）
    ok = [r for r in out if r.get("status") == "ok" and r["width"] >= 200 and r["height"] >= 120]
    for b in range(0, len(ok), 12):
        grp = ok[b : b + 12]
        sheet = Image.new("RGB", (4 * 360, 3 * 300), "white")
        d = ImageDraw.Draw(sheet)
        for k, rec in enumerate(grp):
            im = Image.open(os.path.join(a.out, rec["file"])).convert("RGB")
            im.thumbnail((350, 260))
            x, y = (k % 4) * 360, (k // 4) * 300
            sheet.paste(im, (x + 5, y + 30))
            d.text((x + 5, y + 5), f"{b + k}: {rec['key']} {rec['width']}x{rec['height']}", fill=(0, 0, 0))
        sheet.save(os.path.join(a.out, f"sheet-{b // 12:02d}.jpg"), quality=70)
    json.dump([r["key"] for r in ok], open(os.path.join(a.out, "sheet_order.json"), "w"))
    print(len(out), "images", len(ok), "large")
    return 0


if __name__ == "__main__":
    sys.exit(main())
