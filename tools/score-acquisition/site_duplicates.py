"""GPT の楽譜収集キュー（docs/score-acquisition/queue.json）と SONARIA の掲載状況の照合。

GPT が cursor.note で求めている「site duplicate verification」を行う。ネットワークは使わない。
照合先:
  - frontend/src/data/scores/catalog.json … 現在サイトに出している作品
  - tools/score-migration/works_meta.py の W … 旧サイトにあった作品（catalog に無いものは移行で保留した作品）
作品番号（Op.・No.・Hob.・K.）で突き合わせ、編成（四重奏・ソナタなど）が同じかも見る。
使い方: python tools/score-acquisition/site_duplicates.py <queue.json> <out.json> <out.md>
"""
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "tools" / "score-migration"))
from works_meta import W  # noqa: E402

CATEGORY_TO_SCORING = {"string_quartet": {"string-quartet"}, "violin_sonata": {"violin-piano"}, "cello_sonata": {"cello-piano"}}


def composer_id(name: str) -> str:
    n = name.lower()
    for cid in ("haydn", "mozart", "beethoven", "brahms"):
        if cid in n:
            return cid
    return n.split()[0] if n else ""


def keys_from_queue(text: str) -> set[str]:
    """'Op.1 No.1; Hob.III:1' → {'op:1-1', 'hob:iii:1'}。'K.80/73f' → {'k:80', 'k:73f'}"""
    t = text or ""
    keys = set()
    for m in re.finditer(r"Op\.?\s*(\d+)\s*(?:,?\s*No\.?\s*(\d+))?", t, re.I):
        keys.add(f"op:{m.group(1)}-{m.group(2)}" if m.group(2) else f"op:{m.group(1)}")
    for m in re.finditer(r"Hob\.?\s*([IVXL]+[a-z]?)\s*:\s*([0-9a-zA-Z]+)", t):
        keys.add(f"hob:{m.group(1).lower()}:{m.group(2).lower()}")
    for m in re.finditer(r"K(?:V)?\.?\s*(\d+[a-z]?)(?:\s*/\s*(\d+[a-z]?))?", t):
        keys.add(f"k:{m.group(1).lower()}")
        if m.group(2):
            keys.add(f"k:{m.group(2).lower()}")
    return keys


def keys_from_site(catalog: list[dict] | str) -> set[str]:
    """catalog.json の [{'type':'op','value':'76-3'}] / works_meta の 'op:76-3' 形式"""
    pairs = [(c["type"], c["value"]) for c in catalog] if isinstance(catalog, list) else [tuple(catalog.split(":", 1))] if catalog else []
    keys = set()
    for typ, value in pairs:
        for v in re.split(r"\s*,\s*", value):
            if v:
                keys.add(f"{typ.lower()}:{v.lower()}")
    return keys


def main(queue_path: str, out_json: str, out_md: str) -> None:
    queue = json.loads(Path(queue_path).read_text(encoding="utf-8"))
    catalog = json.loads((ROOT / "frontend/src/data/scores/catalog.json").read_text(encoding="utf-8"))
    works = catalog["works"] if isinstance(catalog, dict) else catalog
    site = [{"id": w["id"], "composer": w["composerId"], "keys": keys_from_site(w.get("catalog") or []), "scoring": w["scoring"], "title": w["title"]["ja"], "where": "published"} for w in works]
    published_ids = {w["id"] for w in works}
    for heading, (wid, ja, _en, cid, scoring, _genre, cat) in W.items():
        if wid not in published_ids:
            site.append({"id": wid, "composer": cid, "keys": keys_from_site(cat), "scoring": scoring, "title": ja, "where": "old_site_held"})

    results = []
    by_work: dict[tuple, list[str]] = {}
    for item in queue["items"]:
        cid = composer_id(item.get("composer", ""))
        qkeys = keys_from_queue(item.get("opus_catalog", ""))
        hits = []
        for s in site:
            if s["composer"] != cid or not (qkeys & s["keys"]):
                continue
            same_scoring = s["scoring"] in CATEGORY_TO_SCORING.get(item.get("category"), set())
            hits.append({"site_id": s["id"], "title": s["title"], "where": s["where"], "same_scoring": same_scoring, "matched": sorted(qkeys & s["keys"])})
        if any(h["where"] == "published" and h["same_scoring"] for h in hits):
            verdict = "duplicate_published"  # すでにサイトに同じ編成で掲載中（別の版として追加するかは要判断）
        elif any(h["where"] == "old_site_held" and h["same_scoring"] for h in hits):
            verdict = "old_site_held"  # 旧サイトにはあったが移行で保留（欠けたパートの補完候補になる）
        elif hits:
            verdict = "same_work_other_scoring"  # 原曲は掲載中だが編成が違う（編曲など）
        else:
            verdict = "new"
        work_key = (cid, item.get("category"), min(qkeys) if qkeys else item["id"])
        by_work.setdefault(work_key, []).append(item["id"])
        results.append({"id": item["id"], "composer_id": cid, "category": item.get("category"), "opus_catalog": item.get("opus_catalog"), "keys": sorted(qkeys), "verdict": verdict, "site_matches": hits})

    internal = {k: v for k, v in by_work.items() if len(v) > 1}
    for r in results:
        for ids in internal.values():
            if r["id"] in ids:
                r["queue_same_work"] = [i for i in ids if i != r["id"]]

    counts: dict[str, int] = {}
    for r in results:
        counts[r["verdict"]] = counts.get(r["verdict"], 0) + 1
    out = {"schema_version": 1, "source_queue_last_updated": queue.get("last_updated"), "counts": counts, "results": results}
    Path(out_json).write_text(json.dumps(out, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")

    label = {"duplicate_published": "掲載中と重複", "old_site_held": "旧サイトで保留中の作品", "same_work_other_scoring": "原曲は掲載中・編成違い", "new": "未掲載（新規）"}
    lines = ["# 楽譜収集キューとサイト掲載の照合（Claude）", "", f"- 照合したキュー: {len(results)} 件（queue.json last_updated: {queue.get('last_updated')}）", "- 照合先: サイト掲載中の作品（catalog.json）と、旧サイトから移行時に保留した作品（works_meta.py）", "- 作品番号（Op.／No.／Hob.／K.）と作曲家・編成で突き合わせ。作品番号が無い・表記が特殊な候補は「未掲載」に入るため、目視で確認すること", "", "| 判定 | 件数 |", "|---|---|"]
    lines += [f"| {label[k]} | {counts.get(k, 0)} |" for k in label]
    for k in ("duplicate_published", "old_site_held", "same_work_other_scoring"):
        rows = [r for r in results if r["verdict"] == k]
        if not rows:
            continue
        lines += ["", f"## {label[k]}", "", "| キュー ID | 作品番号 | サイト側 |", "|---|---|---|"]
        for r in rows:
            sm = "<br>".join(f"{h['site_id']}（{h['title']}・{'掲載中' if h['where'] == 'published' else '旧サイト保留'}{'' if h['same_scoring'] else '・編成違い'}）" for h in r["site_matches"])
            lines.append(f"| `{r['id']}` | {r['opus_catalog']} | {sm} |")
    if internal:
        lines += ["", "## キュー内で同じ作品を指す候補（版違い・パート違い）", ""]
        for (cid, cat, key), ids in sorted(internal.items()):
            lines.append(f"- {cid} {cat} {key}: " + ", ".join(f"`{i}`" for i in ids))
    nokey = [r for r in results if not r["keys"]]
    if nokey:
        lines += ["", "## 作品番号を読み取れなかった候補（目視確認が必要）", ""] + [f"- `{r['id']}`: {r['opus_catalog']}" for r in nokey]
    Path(out_md).write_text("\n".join(lines) + "\n", encoding="utf-8")
    print(json.dumps(counts, ensure_ascii=False))


if __name__ == "__main__":
    main(*sys.argv[1:4])
