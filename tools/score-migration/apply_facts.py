#!/usr/bin/env python3
"""
IMSLP から取得した作品情報（imslp_facts_v2.json）を確認しながら、作品データ（調性・作曲年・楽章・出典）に反映する。

- 反映するのは、作品番号と作曲者が一致した（status=matched）作品だけ
- 作品名に書いた調性と IMSLP の調性が食い違う作品は反映せず、要確認として一覧に出す（作品名の誤りの可能性）
- 作曲年に「?」が付いている（不確か）ものは反映しない
- 楽章は「楽章数」と一覧の数が合うときだけ反映する
- 出力: facts_reviewed.json（作品 ID → 反映する項目）と、確認が必要な作品の一覧（標準出力）
  analyze.py と本スクリプトの --patch で approvals.json / catalog.json に書き込む

使い方:
  python apply_facts.py --facts imslp_facts_v2.json --repo . --out facts_reviewed.json
  python apply_facts.py --reviewed facts_reviewed.json --repo . --patch
"""
from __future__ import annotations

import argparse
import json
import os
import re
import sys

JA_NOTE = {"C": "ハ", "D": "ニ", "E": "ホ", "F": "ヘ", "G": "ト", "A": "イ", "B": "ロ"}


def parse_key(raw: str) -> tuple[str, str] | None:
    """{{Key|F}} → ('F major', 'ヘ長調')、{{Key|d}} → ('D minor', 'ニ短調')、{{Key|Bb}} / {{Key|e-flat}} にも対応"""
    m = re.search(r"\{\{\s*key\s*\|\s*([A-Ga-g])\s*(b|-?flat|#|s|-?sharp)?\s*\}\}", raw or "", re.I)
    if not m:
        return None
    letter, acc = m.group(1), (m.group(2) or "").lower()
    minor = letter.islower()
    up = letter.upper()
    flat = acc in ("b", "flat", "-flat")
    sharp = acc in ("#", "s", "sharp", "-sharp")
    en = f"{up}{'-flat' if flat else '-sharp' if sharp else ''} {'minor' if minor else 'major'}"
    ja = f"{'変' if flat else '嬰' if sharp else ''}{JA_NOTE[up]}{'短調' if minor else '長調'}"
    return en, ja


# 人が確認して反映しないと決めた作品（IMSLP のページが別の作品・原曲・曲集の一部を指す）
EXCLUDE = {
    "bach-jesu-joy-of-mans-desiring": "IMSLP はカンタータ BWV 147 全体（調性・10 楽章）。掲載はコラールの弦楽合奏版",
    "mozart-violin-concertos-3-5": "IMSLP のページは第3番だけ。掲載は第3〜5番の曲集",
    "mozart-violin-duos-op70": "IMSLP のページは別の作品（Minuet, Op.70）",
}
NO_MOVEMENTS = {
    "mozart-12-duos-k487": "原曲はホルン二重奏の 12 曲で、楽章ではない",
}
NO_COMPOSED = {
    "bach-air-on-the-g-string": "原曲（管弦楽組曲第3番）の推定年代のため",
}


def clean(s: str) -> str:
    s = re.sub(r"\{\{\s*EN\s*\}\}", "–", s)
    s = re.sub(r"\[\[(?:[^|\]]*\|)?([^\]]*)\]\]", r"\1", s)
    s = re.sub(r"'{2,}", "", s)
    s = re.sub(r"\{\{[^}]*\}\}", "", s)
    s = re.sub(r"<[^>]+>", "", s)
    return re.sub(r"\s+", " ", s).strip(" .;:")


def parse_movements(raw: str, count_raw: str) -> list[str] | None:
    # IMSLP は「Number of Movements/Sections」の下に「#」または「:I.」形式で楽章を並べることが多い
    text = "\n".join(x for x in (count_raw, raw) if x)
    items = []
    for l in text.splitlines():
        if not re.match(r"^\s*[#*:]", l):
            continue
        l = re.sub(r"^\s*[#*:]+\s*", "", l)
        l = re.sub(r"^[IVX]+\.\s*", "", l)  # ローマ数字の番号
        l = re.sub(r"\s*\((?:[^()]*\bbars?\b[^()]*|\{\{[^}]*\}\})\)", "", l)  # （251 bars）（{{K|F}}）
        l = re.sub(r",\s*\d+\s*bars?\b", "", l)
        items.append(clean(l))
    items = [i for i in items if i]
    m = re.search(r"(\d+)", count_raw or raw or "")
    n = int(m.group(1)) if m else None
    if not items or (n is not None and n != len(items)) or len(items) > 12:
        return None
    return items


def strict_catalog(w: dict, text: str) -> bool:
    """作品番号の下位番号（Op.44-3 の 3）は「Op.44 No.3」のように Op. の直後にある場合だけ一致とみなす"""
    t = text.lower().replace(" ", "")
    for c in w.get("catalog", []):
        nums = re.findall(r"\d+", c["value"])
        if not nums:
            continue
        if c["type"] == "op":
            rx = rf"op\.?{nums[0]}(?!\d)" + (rf",?no\.?{nums[1]}(?!\d)" if len(nums) > 1 and "-" in c["value"] else "")
        elif c["type"] == "k":
            rx = rf"k\.?v?\.?{nums[0]}(?!\d)"
        else:
            rx = rf"{c['type']}\.?{nums[0]}(?!\d)"
        if re.search(rx, t):
            return True
    return not w.get("catalog")


def review(facts: dict, catalog_path: str) -> tuple[dict, list[str]]:
    works = {w["id"]: w for w in json.load(open(catalog_path, encoding="utf-8"))["works"]}
    out, notes = {}, []
    for wid, f in sorted(facts.items()):
        w = works.get(wid)
        if not w or f.get("status") != "matched":
            continue
        if wid in EXCLUDE:
            notes.append(f"{wid}: {EXCLUDE[wid]} → 反映しない")
            continue
        fields = f.get("fields", {})
        if not strict_catalog(w, f["page"] + " ; " + fields.get("catalog", "")):
            notes.append(f"{wid}: IMSLP のページ（{f['page']}）は作品番号が一致しない → 反映しない")
            continue
        rec: dict = {"source": {"label": f"IMSLP: {f['page']}", "url": f["url"]}}
        key = parse_key(fields.get("key", ""))
        title_key = re.search(r"([変嬰]?[ハニホヘトイロ][長短]調)", w["title"]["ja"])
        if key:
            if title_key and title_key.group(1) != key[1]:
                notes.append(f"{wid}: 作品名の調性（{title_key.group(1)}）と IMSLP（{key[1]}）が違う → 反映しない・作品名を確認")
                continue
            rec["key"] = {"ja": key[1], "en": key[0]}
        # 作曲年は最初の「年」または「年–年」だけを使う（場所・改訂の注記などは除く）
        composed_raw = clean(fields.get("composed", ""))
        m = re.search(r"(1[5-9]\d\d)(?:\s*[–/-]\s*(\d{2,4}))?", composed_raw)
        if m and "?" not in composed_raw and wid not in NO_COMPOSED and not re.search(r"\b(ca|c\.|circa)\b", composed_raw):
            rec["composed"] = m.group(1) + (f"–{m.group(2)}" if m.group(2) and not re.match(r"^\d{2}/", composed_raw[m.end(1):].strip()) and len(m.group(2)) in (2, 4) else "")
        mv = parse_movements(fields.get("movements", ""), fields.get("movement_count", ""))
        if mv and wid not in NO_MOVEMENTS:
            rec["movements"] = mv
        out[wid] = rec
    return out, notes


def patch(reviewed: dict, path: str) -> int:
    data = json.load(open(path, encoding="utf-8"))
    n = patch_data(reviewed, data)
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=1)
        f.write("\n")
    return n


def patch_data(reviewed: dict, data: dict) -> int:
    """作品データ（catalog / approvals の形）に、確認済みの作品情報を書き込む"""
    n = 0
    for w in data["works"]:
        r = reviewed.get(w["id"])
        if not r:
            continue
        if r.get("key"):
            w["key"] = r["key"]
        if r.get("composed"):
            w["composed"] = r["composed"]
        if r.get("movements"):
            # 楽章名は原語（テンポ表示など）のまま。番号は日本語・英語で付ける
            w["movements"] = [{"ja": f"第{i + 1}楽章 {m}", "en": f"{['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII'][i]}. {m}"} for i, m in enumerate(r["movements"])]
        src = [s for s in w.get("sources", []) if not s["label"].startswith("IMSLP:")]
        w["sources"] = src + [r["source"]]
        n += 1
    return n


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--facts")
    ap.add_argument("--reviewed")
    ap.add_argument("--repo", required=True)
    ap.add_argument("--out")
    ap.add_argument("--patch", action="store_true")
    args = ap.parse_args()
    catalog = os.path.join(args.repo, "frontend/src/data/scores/catalog.json")
    if args.facts:
        facts = json.load(open(args.facts, encoding="utf-8"))
        reviewed, notes = review(facts, catalog)
        json.dump(reviewed, open(args.out, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
        print(json.dumps({"reviewed": len(reviewed), "with_key": sum(1 for r in reviewed.values() if "key" in r), "with_composed": sum(1 for r in reviewed.values() if "composed" in r), "with_movements": sum(1 for r in reviewed.values() if "movements" in r)}, ensure_ascii=False))
        for n in notes:
            print("要確認:", n)
    if args.patch:
        reviewed = json.load(open(args.reviewed, encoding="utf-8"))
        for p in (catalog, os.path.join(args.repo, "tools/score-migration/approvals.json")):
            print(p, patch(reviewed, p))
    return 0


if __name__ == "__main__":
    sys.exit(main())
