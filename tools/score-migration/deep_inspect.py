#!/usr/bin/env python3
"""
楽譜 PDF の詳細検査（2 回目）。GitHub Actions 専用。

1 回目（audit.py）で取得できた PDF を、内容（SHA-256）ごとに 1 回だけ取り直し、次を調べる。
- 全ページのページ番号（ページ上端・下端の OCR／文字）→ 番号の飛び＝ページ欠落の疑い
- 白紙ページ
- 1 ページ目の題名・パート表記（上部）と著作権表記（下部）
- 全ページの上端・下端にある著作権・出版社・ライセンス・校訂者の表記

- 旧サイトへのアクセスは audit.py と同じ規則（robots.txt・間隔）で 1 件ずつ行う
- 内容が 1 回目と違う（SHA-256 不一致）PDF は検査せず「内容が変わった」と記録する
- PDF は検査後すぐ削除し、保存しない。記録する本文は短い抜粋だけにする
- 途中で止まっても deep.json から再開する

使い方: python deep_inspect.py --state state.json --out deep.json --time-budget 18000
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
from concurrent.futures import ThreadPoolExecutor

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from audit import Fetcher, now, save_state  # noqa: E402

from PIL import Image  # noqa: E402

MAX_PAGES = 150
LANGS = "eng+deu+fra+ita+jpn"

PATTERNS = {
    "copyright": r"©|\(c\)\s*1[89]\d\d|\(c\)\s*20\d\d|copyright|all rights reserved|alle rechte|tous droits|diritti riservati|著作権|無断|jasrac|printed in japan",
    "publisher": r"peters|breitkopf|schott|schirmer|henle|b[aä]renreiter|simrock|durand|ricordi|carl fischer|international music|boosey|universal edition|eulenburg|hamelle|jurgenson|zen-?on|全音|音楽之友|ドレミ|kalmus|dover|novello|augener|litolff|bote|hofmeister|leduc|heugel|costallat|lemoine|rahter|benjamin|cranz|forberg|muzyka|музыка",
    "license": r"creative\s*commons|cc[\s-]?by|mutopia|public\s*domain|imslp|petrucci|musopen|lilypond|musescore",
    "editor": r"herausgegeben|edited by|revidiert|bearbeitet|arranged|arr\.|fingering|fingersatz|revised|revision|校訂|運指|編曲",
}
PART_PATTERNS = {
    "violin1": r"viol(?:ino|in|on)\s*(?:1|i\b|\|(?!\|)|l\b|primo|prima)|1st\s*violin|violon\s*1",
    "violin2": r"viol(?:ino|in|on)\s*(?:2|ii\b|\|\||ll\b|secondo)|2nd\s*violin|violon\s*2",
    "viola": r"\bviola\b|\balto\b|bratsche",
    "cello": r"violoncell|\bcello\b|\bvc\.?\b",
    "bass": r"contrabass|kontrabass|double\s*bass|\bbasso\b",
    "piano": r"piano(?:forte)?|klavier|clavier",
    "violin": r"violin[oe]?\b|violon\b|violine\b",
    "score": r"partitur|full\s*score|\bscore\b|partition|partitura",
}


def run(cmd: list[str], timeout: int = 180) -> tuple[int, str]:
    try:
        p = subprocess.run(cmd, capture_output=True, timeout=timeout)
        return p.returncode, p.stdout.decode("utf-8", "replace")
    except subprocess.TimeoutExpired:
        return -1, ""


def ocr(img: Image.Image, langs: str, psm: str = "6") -> str:
    with tempfile.NamedTemporaryFile(suffix=".png", delete=False) as f:
        img.save(f.name)
        path = f.name
    try:
        _, out = run(["tesseract", path, "-", "-l", langs, "--psm", psm])
        return out
    finally:
        os.remove(path)


def page_text(pdf: str, i: int) -> str:
    _, out = run(["pdftotext", "-f", str(i), "-l", str(i), "-layout", pdf, "-"])
    return out


def render(pdf: str, i: int, dpi: int) -> Image.Image | None:
    with tempfile.TemporaryDirectory() as d:
        run(["pdftoppm", "-r", str(dpi), "-gray", "-f", str(i), "-l", str(i), "-png", pdf, os.path.join(d, "p")])
        files = os.listdir(d)
        if not files:
            return None
        img = Image.open(os.path.join(d, files[0]))
        img.load()
        return img


def numbers_in(text: str, n: int) -> list[int]:
    out = []
    for m in re.finditer(r"(?<![\d.,/])(\d{1,3})(?![\d.,/])", text):
        v = int(m.group(1))
        if 1 <= v <= n + 10:
            out.append(v)
    return out


def inspect_page(pdf: str, i: int, n: int, text_based: bool) -> dict:
    """1 ページの上端・下端の文字、ページ番号の候補、白紙かどうか。"""
    res: dict = {"page": i}
    img = render(pdf, i, 100)
    if img is not None:
        hist = img.histogram()
        dark = sum(hist[:200]) / max(1, img.width * img.height)
        res["blank"] = dark < 0.002
    if text_based:
        lines = [ln for ln in page_text(pdf, i).splitlines() if ln.strip()]
        top, bottom = " ".join(lines[:3]), " ".join(lines[-3:])
    elif img is not None:
        w, h = img.size
        big = render(pdf, i, 200) or img
        W, H = big.size
        # 余白の端に離れて置かれたページ番号も拾うため、通常（psm 6）とまばらな文字向け（psm 11）の両方で読む
        tb, bb = big.crop((0, 0, W, int(H * 0.12))), big.crop((0, int(H * 0.90), W, H))
        top = ocr(tb, "eng", "6") + " " + ocr(tb, "eng", "11")
        bottom = ocr(bb, "eng", "6") + " " + ocr(bb, "eng", "11")
    else:
        top = bottom = ""
    res["top"] = re.sub(r"\s+", " ", top)[:160]
    res["bottom"] = re.sub(r"\s+", " ", bottom)[:160]
    res["nums"] = numbers_in(top, n) + numbers_in(bottom, n)
    return res


def sequence(pages: list[dict], n: int) -> dict:
    """ページ番号の連続性。印刷上の番号 - PDF 上の位置 のずれ（offset）が途中で増えたら欠落の疑い。"""
    offsets = []
    for p in pages:
        cands = [v - p["page"] for v in p["nums"] if -3 <= v - p["page"] <= 10]
        offsets.append(cands)
    flat = [o for c in offsets for o in c]
    if n <= 1:
        return {"result": "single_page"}
    if not flat:
        return {"result": "unknown", "detected": 0}
    base = max(set(flat), key=flat.count)
    detected = sum(1 for c in offsets if base in c)
    jumps = []
    # 欠落があると、それ以降のページは同じだけ番号がずれ続ける。ずれが後ろのページでも続くか、
    # 番号が読めた最後のページであれば「飛び」とみなす（小節番号などの読み違いを 1 回だけの偶然として除く）
    last_detected = max((i for i, c in enumerate(offsets) if c), default=-1)
    for idx, c in enumerate(offsets):
        if c and base not in c:
            for o in sorted(x for x in c if x > base):
                later = any(o in offsets[j] for j in range(idx + 1, len(offsets)))
                if later or idx == last_detected:
                    jumps.append({"page": idx + 1, "printed_offset": o, "expected_offset": base})
                    break
    # 前半のページだけ番号のずれが小さい（例: 1 ページ目が「1」、2 ページ目が「3」）＝その間が欠けている
    first_base = next((i for i, c in enumerate(offsets) if base in c), len(offsets))
    for idx in range(first_base):
        lower = [o for o in offsets[idx] if o < base]
        if lower and base not in offsets[idx]:
            jumps.append({"page": idx + 1, "printed_offset": max(lower), "expected_offset": base})
    coverage = detected / n
    if jumps:
        return {"result": "gap_suspected", "offset": base, "coverage": round(coverage, 2), "jumps": jumps[:10]}
    if coverage >= 0.5:
        return {"result": "continuous", "offset": base, "coverage": round(coverage, 2)}
    return {"result": "unknown", "offset": base, "coverage": round(coverage, 2)}


def find(patterns: dict, text: str) -> dict:
    low = text.lower()
    out = {}
    for k, rx in patterns.items():
        hits = sorted({m.group(0).strip() for m in re.finditer(rx, low)})
        if hits:
            out[k] = hits[:8]
    return out


def snippet_around(text: str, rx: str) -> list[str]:
    low = text.lower()
    out = []
    for m in re.finditer(rx, low):
        a, b = max(0, m.start() - 50), min(len(text), m.end() + 70)
        out.append(re.sub(r"\s+", " ", text[a:b]).strip())
        if len(out) >= 3:
            break
    return out


def inspect(pdf: str, n: int) -> dict:
    _, fonts = run(["pdffonts", pdf])
    t1 = page_text(pdf, 1)
    # 文字を持つ PDF でも、独自のフォント符号化で読めない文字列しか取れないことがある（浄書ソフトの出力など）。
    # 読める単語が少なければ画像として OCR する
    words = re.findall(r"[A-Za-zÀ-ÿ]{3,}", t1)
    readable = sum(1 for w in words if re.search(r"[aeiouyAEIOUY]", w)) / max(1, len(re.findall(r"\S+", t1)))
    text_based = len(fonts.strip().splitlines()) > 2 and len(t1.strip()) > 40 and readable >= 0.25
    k = min(n, MAX_PAGES)
    with ThreadPoolExecutor(max_workers=4) as ex:
        pages = list(ex.map(lambda i: inspect_page(pdf, i, n, text_based), range(1, k + 1)))
    info: dict = {"text_based": text_based, "pages_checked": k}
    # 1 ページ目: 上部（題名・作曲者・パート表記）と下部（著作権表記）を高解像度で読む
    if text_based:
        t1 = page_text(pdf, 1)
        lines = [ln for ln in t1.splitlines() if ln.strip()]
        head, foot = " ".join(lines[:12]), " ".join(lines[-6:])
    else:
        img = render(pdf, 1, 300)
        if img is not None:
            W, H = img.size
            head = ocr(img.crop((0, 0, W, int(H * 0.30))), LANGS)
            foot = ocr(img.crop((0, int(H * 0.85), W, H)), LANGS)
        else:
            head = foot = ""
    info["page1_head"] = re.sub(r"\s+", " ", head)[:400]
    info["page1_foot"] = re.sub(r"\s+", " ", foot)[:240]
    info["part_label"] = sorted(find(PART_PATTERNS, head).keys())
    all_edges = " ".join([head, foot] + [p["top"] + " " + p["bottom"] for p in pages])
    info["marks"] = find(PATTERNS, all_edges)
    info["copyright_snippets"] = snippet_around(all_edges, PATTERNS["copyright"])
    info["sequence"] = sequence(pages, k)
    info["blank_pages"] = [p["page"] for p in pages if p.get("blank")]
    info["page_numbers"] = [p["nums"][:4] for p in pages]
    return info


def load_json(path: str) -> dict:
    if os.path.exists(path):
        with open(path, encoding="utf-8") as f:
            return {k: v for k, v in json.load(f).items() if isinstance(v, dict)}
    return {}


def targets_of(state: dict) -> dict[str, tuple[str, dict]]:
    """内容（SHA-256）ごとに 1 件。同じ内容の PDF を何度も取りに行かない"""
    out: dict[str, tuple[str, dict]] = {}
    for url, e in state["pdfs"].items():
        if e["status"] == "downloaded" and e["sha256"] not in out:
            out[e["sha256"]] = (url, e)
    return out


DONE = ("ok", "changed", "failed_permanent")


def fetch_mode(state: dict, deep: dict, out_dir: str, shards: int, out_json: str) -> None:
    """未検査の PDF を 1 件ずつ（robots.txt・間隔を守って）取得し、shard-<n>/<sha>.pdf に振り分ける。
    検査は並列ジョブで行う（旧サイトへのアクセスはこのジョブだけ）"""
    fetcher = Fetcher()
    n = 0
    for sha, (url, e) in targets_of(state).items():
        if deep.get(sha, {}).get("status") in DONE:
            continue
        try:
            r = fetcher.get(e.get("href_original", url))
            data = r.content if r.status_code == 200 else b""
        except Exception as ex:
            deep[sha] = {"url": url, "checked_at": now(), "status": "retry", "reason": type(ex).__name__}
            continue
        actual = hashlib.sha256(data).hexdigest()
        if actual != sha:
            deep[sha] = {"url": url, "checked_at": now(), "status": "changed", "reason": f"HTTP {r.status_code} / 1 回目と内容が違う", "sha256_now": actual}
            continue
        d = os.path.join(out_dir, f"shard-{n % shards}")
        os.makedirs(d, exist_ok=True)
        with open(os.path.join(d, f"{sha}.pdf"), "wb") as f:
            f.write(data)
        n += 1
    save_state(out_json, deep)
    print(json.dumps({"fetched": n}))


def inspect_dir_mode(state: dict, files_dir: str, part_out: str) -> None:
    """取得済みの PDF（<sha>.pdf）を検査して、結果を part_out に書く"""
    tg = targets_of(state)
    part: dict = {}
    for name in sorted(os.listdir(files_dir)):
        sha = name[:-4]
        url, e = tg[sha]
        rec = {"url": url, "checked_at": now()}
        try:
            rec.update(inspect(os.path.join(files_dir, name), e["pages"] or 0), status="ok")
        except Exception as ex:
            rec.update(status="failed_permanent", reason=f"検査エラー: {type(ex).__name__}: {ex}"[:200])
        part[sha] = rec
        save_state(part_out, part)
    print(json.dumps({"inspected": len(part)}))


def merge_mode(base: str, parts: list[str]) -> None:
    deep = load_json(base)
    for p in parts:
        deep.update(load_json(p))
    save_state(base, deep)
    recs = [v for v in deep.values() if isinstance(v, dict)]
    print(json.dumps({"total": len(recs), "ok": sum(1 for v in recs if v.get("status") == "ok")}))


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--state", required=True)
    ap.add_argument("--out", required=True)
    ap.add_argument("--workdir", default="/tmp/deep")
    ap.add_argument("--time-budget", type=int, default=5 * 3600)
    # 並列化用: fetch（取得して振り分け）／ inspect-dir（取得済みを検査）／ merge（結果をまとめる）
    ap.add_argument("--fetch-to")
    ap.add_argument("--shards", type=int, default=1)
    ap.add_argument("--files-dir")
    ap.add_argument("--part-out")
    ap.add_argument("--merge", nargs="*")
    args = ap.parse_args()
    deadline = time.time() + args.time_budget
    with open(args.state, encoding="utf-8") as f:
        state = json.load(f)
    if args.merge is not None:
        merge_mode(args.out, args.merge)
        return 0
    if args.fetch_to:
        fetch_mode(state, load_json(args.out), args.fetch_to, args.shards, args.out)
        return 0
    if args.files_dir:
        inspect_dir_mode(state, args.files_dir, args.part_out)
        return 0
    deep = {}
    if os.path.exists(args.out):
        with open(args.out, encoding="utf-8") as f:
            deep = json.load(f)
    os.makedirs(args.workdir, exist_ok=True)
    fetcher = Fetcher()
    # 内容（SHA-256）ごとに 1 回だけ。同じ内容の PDF を何度も取りに行かない
    targets: dict[str, tuple[str, dict]] = {}
    for url, e in state["pdfs"].items():
        if e["status"] == "downloaded" and e["sha256"] not in targets:
            targets[e["sha256"]] = (url, e)
    done = 0
    for sha, (url, e) in targets.items():
        if sha in deep and deep[sha].get("status") in ("ok", "changed", "failed_permanent"):
            continue
        if time.time() > deadline:
            break
        rec = {"url": url, "checked_at": now()}
        try:
            r = fetcher.get(e.get("href_original", url))
            data = r.content if r.status_code == 200 else b""
        except Exception as ex:  # 通信エラーは次回に再試行
            rec.update(status="retry", reason=type(ex).__name__)
            deep[sha] = rec
            continue
        actual = hashlib.sha256(data).hexdigest()
        if actual != sha:
            rec.update(status="changed", reason=f"HTTP {r.status_code} / 1 回目と内容が違う", sha256_now=actual)
            deep[sha] = rec
            continue
        path = os.path.join(args.workdir, "current.pdf")
        with open(path, "wb") as f:
            f.write(data)
        try:
            rec.update(inspect(path, e["pages"] or 0), status="ok")
        except Exception as ex:
            rec.update(status="failed_permanent", reason=f"検査エラー: {type(ex).__name__}: {ex}"[:200])
        finally:
            os.remove(path)
        deep[sha] = rec
        done += 1
        if done % 20 == 0:
            save_state(args.out, deep)
    save_state(args.out, deep)
    remaining = sum(1 for s in targets if deep.get(s, {}).get("status") not in ("ok", "changed", "failed_permanent"))
    print(json.dumps({"targets": len(targets), "done_this_run": done, "remaining": remaining}, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    sys.exit(main())
