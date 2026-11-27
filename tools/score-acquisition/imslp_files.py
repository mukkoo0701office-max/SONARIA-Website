"""IMSLP の作品ページから、版ごとのファイル一覧（総譜・パート譜の番号・ページ数）を取得し、
GPT のキューの候補ごとに「総譜＋対応するパート譜」の組を選ぶ（GitHub Actions 専用）。

背景: GPT のキューは候補ごとに 1 ファイル（多くは総譜）しか記録しておらず、番号がページに存在しないこともある。
- 読むのは IMSLP の API（api.php の action=parse。robots.txt で許可されている経路）だけ。PDF はダウンロードしない
- 1 リクエストごとに 3 秒あける。取得済みのページは再取得しない（途中で止まっても再開できる）
- 著作権表示が Public Domain のもの（「See notes」付き＝校訂版の扱いに注意、は除外）を優先し、
  CC BY は「要クレジット」として別扱い。Non-PD の表示があるものは使わない
使い方:
  python imslp_files.py --queue queue.json --cache pages.json --out imslp_sets.json --md imslp_sets.md
  python imslp_files.py --dump "<ページ名>" --out dump.html   # 構造確認用
"""
from __future__ import annotations

import argparse
import json
import os
import re
import sys
import time
import urllib.parse

import requests
from bs4 import BeautifulSoup

API = "https://imslp.org/api.php"
UA = "SONARIA-score-library/1.0 (edition file listing for site owner's manual download; contact via site owner)"
DELAY = 3.0
_last = 0.0
session = requests.Session()
session.headers["User-Agent"] = UA

TABS = {"tabScore1": "scores", "tabScore2": "parts", "tabArrTrans": "arrangements", "tabScore5": "other"}
# キューのカテゴリごとに必要なパート
REQUIRED = {
    "string_quartet": ["violin_1", "violin_2", "viola", "cello"],
    "violin_sonata": ["violin"],
    "cello_sonata": ["cello"],
}
PART_RX = {
    "violin_1": r"Violin(?:o|e)?\s*(?:1|I)(?![IV\d])|Violino\s*primo|1st\s*Violin",
    "violin_2": r"Violin(?:o|e)?\s*(?:2|II)(?![IV\d])|Violino\s*secondo|2nd\s*Violin",
    "viola": r"\bViola\b|Alto\b|Bratsche",
    "cello": r"Cello|Violoncell|Basso\b",
    "violin": r"^Violin(?:o|e)?$|^Violin(?:o|e)?\s*(?:\(|part)|Violin\s*Part",
    "piano": r"Piano|Klavier|Cembalo|Keyboard",
}
SCORE_RX = r"Complete\s*Score|Full\s*Score|^Score\b|Partitur|Piano\s*Score"
ALL_PARTS_RX = r"Complete\s*Parts|All\s*parts"


def api_parse(title: str) -> str:
    global _last
    wait = DELAY - (time.time() - _last)
    if wait > 0:
        time.sleep(wait)
    try:
        r = session.get(API, params={"action": "parse", "page": title, "prop": "text", "format": "json", "redirects": 1}, timeout=90)
        return ((r.json().get("parse") or {}).get("text") or {}).get("*", "") if r.ok else ""
    except (requests.RequestException, ValueError):
        return ""
    finally:
        _last = time.time()


def title_of(url: str) -> str:
    return urllib.parse.unquote(url.split("/wiki/", 1)[1]).replace(" ", "_") if "/wiki/" in (url or "") else ""


def clean(s: str) -> str:
    return re.sub(r"\s*\[\s*tag\s*/.*?\]\s*", "", re.sub(r"\s+", " ", s or "")).strip()


def editions_from_html(html: str) -> list[dict]:
    soup = BeautifulSoup(html, "html.parser")
    out = []
    for tab_id, tab in TABS.items():
        div = soup.find(id=tab_id)
        if not div:
            continue
        for we in div.find_all("div", class_="we"):
            files: list[dict] = []
            for el in we.find_all(["div", "table"], recursive=False):
                if el.name == "div" and re.match(r"IMSLP\d+$", el.get("id") or ""):
                    a = el.select_one(".we_file_download a[href*='ImagefromIndex']")
                    info = el.select_one(".we_file_info2")
                    m = re.search(r"#\d+\s*-\s*([\d.]+\s*[KMG]B)(?:,\s*(\d+)\s*pp)?", info.get_text(" ", strip=True) if info else "")
                    files.append({"id": el["id"][5:], "desc": a.get_text(" ", strip=True) if a else "", "pages": int(m.group(2)) if m and m.group(2) else None, "size": m.group(1).replace(" ", "") if m else None})
                elif el.name == "table" and "we_edition_info" in (el.get("class") or []):
                    rows: dict[str, str] = {}
                    for tr in el.select("tr"):
                        th, td = tr.find("th"), tr.find("td")
                        if th and td:
                            rows[re.sub(r"\s+", "", th.get_text("", strip=True))] = td.get_text(" ", strip=True)
                    out.append({"tab": tab, "files": tag_ranges(files), "publisher": clean(rows.get("Publisher.Info.", "")), "editor": clean(rows.get("Editor", "")), "arranger": clean(rows.get("Arranger", "")), "copyright": clean(rows.get("Copyright", "")), "notes": clean(rows.get("Misc.Notes", ""))[:300], "reprinted": clean(rows.get("Reprinted", ""))})
                    files = []
            if files:
                out.append({"tab": tab, "files": tag_ranges(files), "publisher": "", "editor": "", "arranger": "", "copyright": "", "notes": "", "reprinted": ""})
    return out


def tag_ranges(files: list[dict]) -> list[dict]:
    """曲集のページでは「Nos.1-3: Complete Parts」のように、番号の範囲が後ろのファイルにだけ書かれていることがある。
    範囲の書かれたファイルの直前までの（範囲の無い）ファイルにも同じ範囲を付ける"""
    pending: list[dict] = []
    for f in files:
        m = re.search(r"\bNos?\.?\s*(\d+)(?:\s*[-–&,]\s*(\d+))?", f["desc"])
        if m:
            lo, hi = int(m.group(1)), int(m.group(2) or m.group(1))
            for g in pending + [f]:
                g["nos"] = [lo, hi]
            pending = []
        else:
            pending.append(f)
    return files


def item_number(item: dict) -> int | None:
    m = re.search(r"Op\.?\s*\d+\s*,?\s*No\.?\s*(\d+)", item.get("opus_catalog") or "", re.I)
    return int(m.group(1)) if m else None


def rights_of(ed: dict) -> str:
    c = ed["copyright"]
    if re.search(r"Non-PD", c, re.I):
        return "non_pd"
    if re.search(r"Creative Commons", c, re.I):
        return "cc"
    if re.match(r"Public Domain", c, re.I):
        return "pd_notes" if re.search(r"See notes", c, re.I) else "pd"
    return "unknown"


def roles_of(desc: str) -> set[str]:
    if re.search(ALL_PARTS_RX, desc, re.I):
        return {"all_parts"}
    if re.search(SCORE_RX, desc, re.I):
        return {"full_score"}
    return {k for k, rx in PART_RX.items() if re.search(rx, desc, re.I)}


def pub_key(ed: dict) -> set[str]:
    """版の同定に使う語（出版社名・プレート番号）"""
    p = ed.get("reprinted") + " " + ed.get("publisher", "")
    words = {w.lower() for w in re.findall(r"[A-Z][a-zä-ü]{3,}", p)} - {"plate", "complete", "edition", "werke", "series", "serie", "leipzig", "berlin", "london", "paris", "wien", "vienna", "mainz", "offenbach", "amsterdam"}
    plates = set(re.findall(r"Plate\s*([\w.\-]+)", p))
    return words | {f"plate:{x}" for x in plates}


def files_by_role(ed: dict, need: list[str]) -> dict[str, list[dict]]:
    got: dict[str, list[dict]] = {}
    for f in ed["files"]:
        rs = roles_of(f["desc"])
        if "all_parts" in rs:
            for n in need:
                got.setdefault(n, []).append(f)
        for r in rs:
            got.setdefault(r, []).append(f)
    return got


def queue_ids(item: dict) -> set[str]:
    """GPT が採用したファイル番号（imslp_file_id / score_file_id / parts_file_ids）。比較用に言及しただけの番号は含めない"""
    txt = json.dumps({"edition": {k: v for k, v in (item.get("edition") or {}).items() if k in ("imslp_file_id", "score_file_id", "parts_file_ids")}, "set": item.get("score_parts_set") or {}})
    return set(re.findall(r'"(?:imslp_file_id|score_file_id)":\s*"?(\d{3,7})', txt)) | set(re.findall(r'"parts_file_ids":\s*[\[{]([^\]}]*)', txt) and re.findall(r"\d{4,7}", "".join(re.findall(r'"parts_file_ids":\s*[\[{]([^\]}]*)', txt))))


def year_of(ed: dict) -> int:
    ys = [int(y) for y in re.findall(r"\b(1[6-9]\d\d|20\d\d)\b", ed.get("publisher", ""))]
    return min(ys) if ys else 0


def manuscript(ed: dict) -> bool:
    return bool(re.search(r"manuscript|holograph|autograph|Manuskript", ed.get("publisher", "") + " " + ed.get("notes", ""), re.I))


def choose(item: dict, eds: list[dict]) -> dict:
    need = REQUIRED.get(item.get("category"), ["violin_1", "violin_2", "viola", "cello"])
    tabs = {"arrangements", "scores", "parts"} if (item.get("arranger") or item.get("original_work")) else {"scores", "parts"}
    no = item_number(item)
    usable = []
    for e in eds:
        if e["tab"] not in tabs or rights_of(e) not in ("pd", "cc"):
            continue
        # 曲集のうち、この曲（No.）を含まない範囲のファイルは除く
        files = [f for f in e["files"] if not (no and f.get("nos") and not (f["nos"][0] <= no <= f["nos"][1]))]
        if files:
            usable.append(dict(e, files=files))
    on_page = {f["id"] for e in eds for f in e["files"]}
    qids = queue_ids(item)
    scores = [(e, f) for e in usable for f in files_by_role(e, need).get("full_score", [])]
    part_sets = []
    for e in usable:
        fr = files_by_role(e, need)
        if all(fr.get(n) for n in need):
            part_sets.append((e, {n: fr[n][0] for n in need}))

    def ed_rank(e: dict) -> tuple:
        # 手稿は避ける → PD を優先 → 出版年が新しい（＝印刷が読みやすい）ほど優先
        return (1 if manuscript(e) else 0, 0 if rights_of(e) == "pd" else 1, -year_of(e))

    pairs = []
    for sc in scores or [None]:
        for ps in part_sets or [None]:
            if sc is None and ps is None:
                continue
            hits = (1 if sc and sc[1]["id"] in qids else 0) + (1 if ps and any(f["id"] in qids for f in ps[1].values()) else 0)
            same = bool(sc and ps and (ps[0]["publisher"] == sc[0]["publisher"] or len(pub_key(ps[0]) & pub_key(sc[0])) > 0))
            complete = (sc is not None) + (ps is not None)
            r_sc = ed_rank(sc[0]) if sc else (9, 9, 0)
            r_ps = ed_rank(ps[0]) if ps else (9, 9, 0)
            pairs.append(((-complete, -hits, 0 if same else 1, r_sc[0] + r_ps[0], r_sc[1] + r_ps[1], r_ps[2], r_sc[2]), sc, ps, same))
    pairs.sort(key=lambda p: p[0])
    _, best_score, best_parts, same_edition = pairs[0] if pairs else (None, None, None, False)
    status = "complete_set" if best_score and best_parts else "score_only" if best_score else "parts_only" if best_parts else "nothing_usable"
    return {
        "status": status,
        "need": need,
        "gpt_ids": sorted(qids),
        "gpt_ids_missing_on_page": sorted(qids - on_page),
        "score": {"id": best_score[1]["id"], "desc": best_score[1]["desc"], "pages": best_score[1]["pages"], "publisher": best_score[0]["publisher"], "rights": rights_of(best_score[0]), "page": best_score[0].get("page")} if best_score else None,
        "parts": {"publisher": best_parts[0]["publisher"], "rights": rights_of(best_parts[0]), "page": best_parts[0].get("page"), "files": {n: {"id": f["id"], "desc": f["desc"], "pages": f["pages"]} for n, f in best_parts[1].items()}} if best_parts else None,
        "same_edition": same_edition,
        "alternatives": {"scores": len(scores), "part_sets": len(part_sets)},
    }


LABEL = {"full_score": "総譜", "violin_1": "Vn1", "violin_2": "Vn2", "viola": "Va", "cello": "Vc", "violin": "Vn", "piano": "Pf"}
STATUS = {"complete_set": "総譜＋パート", "score_only": "総譜のみ（パート譜なし）", "parts_only": "パート譜のみ（総譜なし）", "nothing_usable": "使える版なし", "page_error": "ページ取得失敗"}


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--queue")
    ap.add_argument("--cache", default="")
    ap.add_argument("--dump", action="append")
    ap.add_argument("--out", required=True)
    ap.add_argument("--md", default="")
    a = ap.parse_args()
    if a.dump:
        with open(a.out, "w", encoding="utf-8") as f:
            for t in a.dump:
                f.write(f"<!-- PAGE {t} -->\n{api_parse(t)}\n")
        return 0

    queue = json.load(open(a.queue, encoding="utf-8"))
    cache = {}
    if a.cache and os.path.exists(a.cache) and os.path.getsize(a.cache) > 0:
        try:
            cache = json.load(open(a.cache, encoding="utf-8"))
        except ValueError:
            cache = {}
    results = []
    for item in queue["items"]:
        titles = []
        for u in (item.get("edition_url"), item.get("work_url")):
            t = title_of(u or "")
            if t and t not in titles:
                titles.append(t)
        eds: list[dict] = []
        ok = False
        for t in titles:
            if t not in cache or cache[t] is None:
                html = api_parse(t)
                cache[t] = editions_from_html(html) if html else None
                if a.cache:
                    json.dump(cache, open(a.cache, "w", encoding="utf-8"), ensure_ascii=False)
                print(t, "ok" if cache[t] is not None else "ERROR", flush=True)
            if cache[t] is not None:
                ok = True
                eds += [dict(e, page=t) for e in cache[t]]
        r = choose(item, eds) if ok else {"status": "page_error", "gpt_ids": sorted(queue_ids(item))}
        results.append({"id": item["id"], "composer": item.get("composer", ""), "title": f"{item.get('work_title', '')} {item.get('opus_catalog', '')}".strip(), "category": item.get("category"), "queue_status": item.get("status"), "pages": titles, **r})

    counts: dict[str, int] = {}
    for r in results:
        counts[r["status"]] = counts.get(r["status"], 0) + 1
    json.dump({"counts": counts, "results": results}, open(a.out, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    print(json.dumps(counts, ensure_ascii=False))

    if a.md:
        missing = [r for r in results if r.get("gpt_ids_missing_on_page")]
        lines = ["# 総譜と対応するパート譜の一覧（IMSLP の作品ページから Claude が作成）", "", "GPT のキューの候補ごとに、IMSLP の作品ページの全ファイルを読み、**総譜 1 つ＋必要なパート譜がそろう組**を選んだ。PDF はダウンロードしていない。", "", "- 選び方: GPT が選んだ番号を含む版を優先 → 著作権表示が Public Domain → 総譜と同じ出版社・プレートのパート譜", "- 「See notes」付きの PD（近年の校訂版）と Non-PD は除外。CC BY は「要クレジット」", f"- GPT の記録した番号が作品ページに存在しなかった候補: **{len(missing)} 件**（下表の「GPT 番号」欄に ⚠）", "", "| 判定 | 件数 |", "|---|---|"]
        lines += [f"| {STATUS[k]} | {counts.get(k, 0)} |" for k in STATUS if counts.get(k)]
        current = None
        for r in results:
            comp = r["composer"].split("(")[0].split(";")[0].strip()
            if comp != current:
                lines += ["", f"## {comp}", "", "| 候補 | 判定 | 総譜 | パート譜 | 同じ版 | GPT 番号 |", "|---|---|---|---|---|---|"]
                current = comp
            sc = r.get("score")
            ps = r.get("parts")
            score_txt = f"#{sc['id']}（{sc['pages']}p）{'・CC' if sc['rights'] == 'cc' else ''}<br><small>{sc['publisher'][:60]}</small>" if sc else "—"
            parts_txt = ("<br>".join(f"{LABEL.get(n, n)} #{f['id']}（{f['pages']}p）" for n, f in ps["files"].items()) + f"{'・CC' if ps['rights'] == 'cc' else ''}<br><small>{ps['publisher'][:60]}</small>") if ps else "—"
            gpt = ", ".join(r.get("gpt_ids", [])) + (" ⚠ ページに無い: " + ", ".join(r["gpt_ids_missing_on_page"]) if r.get("gpt_ids_missing_on_page") else "")
            url = f"https://imslp.org/wiki/{urllib.parse.quote(r['pages'][0])}" if r.get("pages") else ""
            lines.append(f"| [{r['title']}]({url})<br>`{r['id']}` | {STATUS.get(r['status'], r['status'])} | {score_txt} | {parts_txt} | {'○' if r.get('same_edition') else ('×' if sc and ps else '—')} | {gpt} |")
        open(a.md, "w", encoding="utf-8").write("\n".join(lines) + "\n")
    return 0


if __name__ == "__main__":
    sys.exit(main())
