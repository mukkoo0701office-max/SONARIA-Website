#!/usr/bin/env python3
"""
旧サイト（https://www.mukkoo0701music.jp/）の無料楽譜ライブラリを巡回し、PDF を検査する（GitHub Actions 専用）。

- PDF そのものはリポジトリに保存しない。検査結果（ハッシュ・ページ数・本文の一部など）だけを state.json に記録する
- 会員限定ページは巡回しない（運営者の指示: 権利上の問題があるものを含むため）
- サーバーに負荷をかけないよう、1 件ずつ、間隔を空けてアクセスする。robots.txt に従う
- 途中で止まっても state.json から再開できる（処理済みのページ・PDF は再取得しない）
- ページに書かれていない URL を推測して作らない。取得に失敗した PDF は代わりを探さない

使い方: python audit.py --state state.json --workdir /tmp/pdfs [--max-pdfs N] [--time-budget 秒]
"""
from __future__ import annotations

import argparse
import hashlib
import json
import os
import re
import subprocess
import sys
import time
import urllib.robotparser
from datetime import datetime, timezone
from urllib.parse import unquote, urldefrag, urljoin, urlparse

import requests
from bs4 import BeautifulSoup

BASE = "https://www.mukkoo0701music.jp"
SEED = BASE + "/imslp/弦楽/ヴァイオリン/無料楽譜ライブラリ/"
USER_AGENT = "SONARIA-score-migration/1.0 (site owner's migration audit; contact via site owner)"
DELAY_SECONDS = 3.0  # 1 件ごとの待ち時間
MAX_PDF_BYTES = 80 * 1024 * 1024

# 巡回しないページ（会員限定・ログイン・管理系・共有など）
EXCLUDE_PATTERNS = [
    "会員限定",
    "/login",
    "/logout",
    "/app/auth",
    "/app/cms",
    "/j/privacy",
    "/sitemap",
    "/お問い合わせ",
    "/about",
    "/j/",
    "cms.e.jimdo.com",
    "a.jimdo.com",
]

# 「ハブ」ページ（ここからだけリンクをたどる）: 一覧・楽譜倉庫・ライブラリ
HUB_TITLE_RE = re.compile(r"倉庫|ライブラリ|楽譜一覧")


def now() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def norm(url: str) -> str:
    url, _ = urldefrag(url)
    p = urlparse(url)
    # Jimdo のダウンロード URL はクエリ（?t=...）がキャッシュ用なので外して同一視する
    if "/app/download/" in p.path:
        return f"{p.scheme}://{p.netloc}{p.path}"
    return url


def is_same_site(url: str) -> bool:
    return urlparse(url).netloc in ("www.mukkoo0701music.jp", "mukkoo0701music.jp")


def is_excluded(url: str) -> bool:
    u = unquote(url)
    return any(p in u for p in EXCLUDE_PATTERNS)


def is_download(url: str) -> bool:
    p = urlparse(url)
    path = unquote(p.path).lower()
    return "/app/download/" in path or path.endswith(".pdf")


def load_state(path: str) -> dict:
    if os.path.exists(path):
        with open(path, encoding="utf-8") as f:
            return json.load(f)
    return {"created_at": now(), "pages": {}, "pdfs": {}, "external_links": {}, "queue": [[SEED, 0, None]]}


def save_state(path: str, state: dict) -> None:
    state["updated_at"] = now()
    tmp = path + ".tmp"
    with open(tmp, "w", encoding="utf-8") as f:
        json.dump(state, f, ensure_ascii=False, indent=1, sort_keys=True)
    os.replace(tmp, path)


class Fetcher:
    def __init__(self) -> None:
        self.s = requests.Session()
        self.s.headers["User-Agent"] = USER_AGENT
        self.last = 0.0
        self.robots = urllib.robotparser.RobotFileParser()
        try:
            r = self.s.get(BASE + "/robots.txt", timeout=30)
            self.robots.parse(r.text.splitlines() if r.ok else [])
        except requests.RequestException:
            self.robots.parse([])

    def allowed(self, url: str) -> bool:
        return self.robots.can_fetch(USER_AGENT, url)

    def get(self, url: str, stream: bool = False) -> requests.Response:
        wait = DELAY_SECONDS - (time.time() - self.last)
        if wait > 0:
            time.sleep(wait)
        try:
            return self.s.get(url, timeout=60, stream=stream, allow_redirects=True)
        finally:
            self.last = time.time()


def content_root(soup: BeautifulSoup):
    # Jimdo の本文領域（見つからなければページ全体）
    for sel in ["#content_area", ".j-blogarticle", "#content", "main", ".content"]:
        el = soup.select_one(sel)
        if el:
            return el
    return soup


def context_text(a) -> str:
    """リンク周辺の文字（Jimdo のダウンロードモジュールの題名・説明、直前の見出しなど）"""
    parts = []
    module = a.find_parent(class_=re.compile(r"j-module|j-downloadDocument|cc-m-download"))
    if module:
        parts.append(module.get_text(" ", strip=True))
    heading = a.find_previous(["h1", "h2", "h3", "h4"])
    if heading:
        parts.append("見出し: " + heading.get_text(" ", strip=True))
    return " / ".join(parts)[:400]


def crawl(state: dict, fetcher: Fetcher, deadline: float, state_path: str) -> None:
    pages, pdfs, ext = state["pages"], state["pdfs"], state["external_links"]
    while state["queue"] and time.time() < deadline:
        url, depth, parent = state["queue"].pop(0)
        url = norm(url)
        if url in pages:
            continue
        rec = {"depth": depth, "found_on": parent, "fetched_at": now()}
        if is_excluded(url):
            rec.update(status="excluded", reason="会員限定・管理系などの対象外ページ")
            pages[url] = rec
            continue
        if not fetcher.allowed(url):
            rec.update(status="skipped", reason="robots.txt で禁止")
            pages[url] = rec
            continue
        try:
            r = fetcher.get(url)
        except requests.RequestException as e:
            rec.update(status="error", reason=f"通信エラー: {type(e).__name__}")
            pages[url] = rec
            save_state(state_path, state)
            continue
        rec["http_status"] = r.status_code
        if r.status_code != 200 or "html" not in r.headers.get("content-type", ""):
            rec.update(status="error", reason=f"HTTP {r.status_code} / {r.headers.get('content-type', '')}")
            pages[url] = rec
            continue
        soup = BeautifulSoup(r.text, "html.parser")
        title = (soup.title.get_text(strip=True) if soup.title else "")[:200]
        h1 = soup.find(["h1", "h2"])
        rec.update(status="ok", title=title, heading=(h1.get_text(" ", strip=True)[:200] if h1 else ""))
        is_hub = depth == 0 or bool(HUB_TITLE_RE.search(title))
        rec["is_hub"] = is_hub
        root = content_root(soup)
        downloads, links = [], []
        for a in root.find_all("a", href=True):
            href = urljoin(url, a["href"].strip())
            if not href.startswith("http"):
                continue
            text = a.get_text(" ", strip=True)[:200]
            if is_download(href):
                key = norm(href)
                downloads.append(key)
                entry = pdfs.setdefault(key, {"found_on": [], "link_texts": [], "status": "pending"})
                if url not in entry["found_on"]:
                    entry["found_on"].append(url)
                    entry["link_texts"].append({"page": url, "text": text, "context": context_text(a)})
                entry["href_original"] = href
            elif is_same_site(href):
                links.append({"url": norm(href), "text": text})
            else:
                host = urlparse(href).netloc
                if any(h in host for h in ("imslp.org", "gengaku", "petruccilibrary", "drive.google", "dropbox")):
                    ext.setdefault(norm(href), {"found_on": url, "text": text, "status": "external_not_migrated"})
        rec["downloads"] = downloads
        rec["links"] = links if is_hub else []
        pages[url] = rec
        # ハブからだけリンクをたどる（ハブの子は楽譜記事として PDF を集めるだけ）
        if is_hub:
            for l in links:
                if l["url"] not in pages and not any(q[0] == l["url"] for q in state["queue"]):
                    state["queue"].append([l["url"], depth + 1, url])
        if len(pages) % 10 == 0:
            save_state(state_path, state)
    save_state(state_path, state)


def run(cmd: list[str], timeout: int = 120) -> tuple[int, str]:
    try:
        p = subprocess.run(cmd, capture_output=True, text=True, timeout=timeout)
        return p.returncode, (p.stdout + p.stderr)
    except subprocess.TimeoutExpired:
        return -1, "timeout"


def inspect_pdf(path: str) -> dict:
    info: dict = {}
    code, out = run(["qpdf", "--check", path])
    # qpdf: 0=正常, 2=エラー, 3=警告のみ
    info["qpdf_exit"] = code
    info["qpdf_summary"] = out.strip().splitlines()[-1][:200] if out.strip() else ""
    code, out = run(["pdfinfo", path])
    info["pdfinfo_ok"] = code == 0
    for line in out.splitlines():
        k, _, v = line.partition(":")
        k, v = k.strip(), v.strip()
        if k == "Pages":
            info["pages"] = int(v) if v.isdigit() else None
        elif k in ("Title", "Author", "Producer", "Creator", "Encrypted", "Page size"):
            info[k.lower().replace(" ", "_")] = v[:200]
    n = info.get("pages") or 0
    # 本文（最初の 2 ページと最後のページ）。文字が無い（画像だけの）PDF は OCR する
    code, first = run(["pdftotext", "-l", "2", "-layout", path, "-"])
    info["text_first"] = re.sub(r"\s+", " ", first)[:600] if code == 0 else ""
    if n > 2:
        code, last = run(["pdftotext", "-f", str(n), "-l", str(n), path, "-"])
        info["text_last"] = re.sub(r"\s+", " ", last)[:300] if code == 0 else ""
    if len(info["text_first"].strip()) < 40 and n:
        run(["pdftoppm", "-r", "150", "-f", "1", "-l", "1", "-png", path, "/tmp/ocr_page"])
        imgs = sorted(f for f in os.listdir("/tmp") if f.startswith("ocr_page"))
        if imgs:
            code, ocr = run(["tesseract", os.path.join("/tmp", imgs[0]), "-", "-l", "eng+deu+fra+ita+jpn"], timeout=180)
            info["ocr_first"] = re.sub(r"\s+", " ", ocr)[:600] if code == 0 else ""
            for f in imgs:
                os.remove(os.path.join("/tmp", f))
    # 各ページに文字（または画像）があるか: 真っ白なページの検出（欠落・抜けの手がかり）
    if 0 < n <= 200:
        code, out = run(["pdffonts", path])
        info["has_fonts"] = code == 0 and len(out.strip().splitlines()) > 2
        code, out = run(["pdfimages", "-list", path])
        img_pages = set()
        for line in out.splitlines()[2:]:
            cols = line.split()
            if cols and cols[0].isdigit():
                img_pages.add(int(cols[0]))
        if not info.get("has_fonts"):
            info["pages_without_images"] = sorted(set(range(1, n + 1)) - img_pages)[:50]
    return info


def download_and_inspect(state: dict, fetcher: Fetcher, workdir: str, deadline: float, max_pdfs: int, state_path: str) -> None:
    os.makedirs(workdir, exist_ok=True)
    done = 0
    for url, entry in state["pdfs"].items():
        if entry["status"] != "pending":
            continue
        if time.time() > deadline or done >= max_pdfs:
            break
        entry["checked_at"] = now()
        if not fetcher.allowed(url):
            entry.update(status="skipped", reason="robots.txt で禁止")
            continue
        fetch_url = entry.get("href_original", url)
        try:
            r = fetcher.get(fetch_url, stream=True)
        except requests.RequestException as e:
            entry.update(status="download_failed", reason=f"通信エラー: {type(e).__name__}")
            done += 1
            continue
        entry["http_status"] = r.status_code
        entry["content_type"] = r.headers.get("content-type", "")
        cd = r.headers.get("content-disposition", "")
        m = re.search(r"filename\*?=(?:UTF-8'')?\"?([^\";]+)", cd)
        entry["filename"] = unquote(m.group(1)) if m else unquote(os.path.basename(urlparse(r.url).path))
        if r.status_code != 200:
            entry.update(status="download_failed", reason=f"HTTP {r.status_code}")
            done += 1
            continue
        h = hashlib.sha256()
        path = os.path.join(workdir, "current.pdf")
        size = 0
        too_big = False
        with open(path, "wb") as f:
            for chunk in r.iter_content(1 << 16):
                size += len(chunk)
                if size > MAX_PDF_BYTES:
                    too_big = True
                    break
                h.update(chunk)
                f.write(chunk)
        if too_big:
            entry.update(status="download_failed", reason="80MB を超えるため取得を中止")
            done += 1
            continue
        entry["bytes"] = size
        entry["sha256"] = h.hexdigest()
        with open(path, "rb") as f:
            head = f.read(5)
        if head != b"%PDF-":
            entry.update(status="not_pdf", reason=f"PDF ではない（先頭: {head!r}）")
            done += 1
            continue
        entry.update(inspect_pdf(path))
        entry["status"] = "downloaded"
        # IMSLP のファイル名（例: IMSLP12345-PMLP678-...）なら出典を追跡できる
        mm = re.search(r"IMSLP(\d+)", entry.get("filename", ""))
        entry["imslp_id"] = mm.group(1) if mm else None
        done += 1
        if done % 10 == 0:
            save_state(state_path, state)
        os.remove(path)
    save_state(state_path, state)


def summarize(state: dict) -> dict:
    pages, pdfs = state["pages"], state["pdfs"]
    by_hash: dict[str, list[str]] = {}
    for u, e in pdfs.items():
        if e.get("sha256"):
            by_hash.setdefault(e["sha256"], []).append(u)
    dups = {h: us for h, us in by_hash.items() if len(us) > 1}
    for h, us in dups.items():
        for u in us:
            pdfs[u]["duplicate_of_hash_group"] = us
    s = {
        "pages_total": len(pages),
        "pages_ok": sum(1 for p in pages.values() if p.get("status") == "ok"),
        "pages_with_pdf": sum(1 for p in pages.values() if p.get("downloads")),
        "pages_excluded": sum(1 for p in pages.values() if p.get("status") == "excluded"),
        "pages_error": sum(1 for p in pages.values() if p.get("status") in ("error", "skipped")),
        "queue_remaining": len(state["queue"]),
        "pdf_links": len(pdfs),
        "pdf_pending": sum(1 for e in pdfs.values() if e["status"] == "pending"),
        "pdf_downloaded": sum(1 for e in pdfs.values() if e["status"] == "downloaded"),
        "pdf_failed": sum(1 for e in pdfs.values() if e["status"] in ("download_failed", "not_pdf", "skipped")),
        "pdf_qpdf_errors": sum(1 for e in pdfs.values() if e.get("qpdf_exit") == 2),
        "duplicate_hash_groups": len(dups),
        "external_links": len(state["external_links"]),
    }
    state["summary"] = s
    return s


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--state", required=True)
    ap.add_argument("--workdir", default="/tmp/pdfs")
    ap.add_argument("--max-pdfs", type=int, default=10000)
    ap.add_argument("--time-budget", type=int, default=5 * 3600)
    args = ap.parse_args()
    deadline = time.time() + args.time_budget
    state = load_state(args.state)
    fetcher = Fetcher()
    crawl(state, fetcher, deadline, args.state)
    if not state["queue"]:
        download_and_inspect(state, fetcher, args.workdir, deadline, args.max_pdfs, args.state)
    s = summarize(state)
    save_state(args.state, state)
    print(json.dumps(s, ensure_ascii=False, indent=1))
    return 0


if __name__ == "__main__":
    sys.exit(main())
