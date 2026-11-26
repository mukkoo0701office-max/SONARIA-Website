"""
楽譜 PDF の統一ファイル名と文書情報（PDF のタイトル・作成者・件名・キーワード）。

ファイル名の形式（英語・ASCII のみ。どの OS・メール・クラウドでも文字化けしない）:
  <作曲者>_<曲名>-<作品番号>_<パート>[-<補足>].pdf
  例: Beethoven_Violin-Sonata-No5-Op24_Violin.pdf
      Tchaikovsky_Serenade-for-Strings-Op48_Viola.pdf
      Goltermann_Cello-Concertos_Piano-No1-Vc-Pf.pdf
- 曲名は英語名から調性（in F major など）・愛称（“Spring” など）・括弧書きを除いたもの
- 同じ名前になる場合は末尾に作品 ID を付けて区別する
"""
from __future__ import annotations

import re
import unicodedata

PART_EN = {
    "score": "Score",
    "solo": "Solo",
    "violin": "Violin",
    "violin1": "Violin1",
    "violin2": "Violin2",
    "viola": "Viola",
    "cello": "Cello",
    "bass": "Bass",
    "piano": "Piano",
    "other": "Other",
}
PART_TITLE = {
    "score": "Score",
    "solo": "Solo part",
    "violin": "Violin",
    "violin1": "Violin I",
    "violin2": "Violin II",
    "viola": "Viola",
    "cello": "Cello",
    "bass": "Double bass",
    "piano": "Piano",
    "other": "Other",
}


def ascii_fold(s: str) -> str:
    return unicodedata.normalize("NFKD", s).encode("ascii", "ignore").decode()


def slug(s: str) -> str:
    s = ascii_fold(s.replace("–", "-").replace("—", "-"))
    s = re.sub(r"No\.\s*", "No", s)
    s = re.sub(r"Op\.\s*", "Op", s)
    s = re.sub(r"[’'`.]", "", s)
    s = re.sub(r"[^A-Za-z0-9]+", "-", s)
    return s.strip("-")


def label_slug(label: str | None) -> str:
    if not label:
        return ""
    t = unicodedata.normalize("NFKC", label)
    t = re.sub(r"第\s*(\d+)\s*番", r"No\1", t)
    t = re.sub(r"第\s*(\d+)\s*巻", r"Book\1", t)
    t = re.sub(r"第\s*(\d+)\s*曲", r"No\1", t)
    t = t.replace("&", " ")
    return slug(t)


def catalog_slug(work: dict) -> str:
    prefix = {"op": "Op", "k": "K", "bwv": "BWV", "rv": "RV", "hob": "Hob", "d": "D", "woo": "WoO", "other": ""}
    cats = work.get("catalog") or []
    if not cats:
        return ""
    c = cats[0]
    v = re.sub(r"\s*[,–]\s*", "-", c["value"])
    return slug(prefix.get(c["type"], "") + v)


def title_slug(work: dict) -> str:
    t = work["title"]["en"]
    t = re.sub(r"\s*[“\"].*?[”\"]", "", t)  # 愛称
    t = re.sub(r"\s*\(.*?\)", "", t)  # 括弧書き
    t = re.sub(r"\s+in\s+[A-G](-flat|-sharp)?\s+(major|minor)", "", t)  # 調性
    if work.get("catalog"):
        # 作品番号は catalog_slug で付けるので、曲名の中の番号表記（Op. 1、Op. 2 など）は除く
        t = re.sub(r",?\s*\b(Op|K|BWV|RV|D)\.\s*\d[\d\s–,-]*", " ", t)
    return slug(t)


def composer_slug(composer: dict) -> str:
    return slug(composer["short"]["en"].split()[-1])


def unique_names(items: list[tuple[dict, dict, dict]]) -> dict[tuple[str, str], str]:
    """(作品ID, ファイルID) → ファイル名。同じ名前になる組は、作品 ID の末尾の語（例: cello / viola）を付けて区別する"""
    first = {(w["id"], a["id"]): file_name(w, c, a) for w, c, a in items}
    counts: dict[str, int] = {}
    for n in first.values():
        counts[n] = counts.get(n, 0) + 1
    out = {}
    for (wid, aid), n in first.items():
        if counts[n] > 1:
            stem, ext = n.rsplit(".", 1)
            n = f"{stem}-{slug(wid.split('-')[-1].capitalize())}.{ext}"
        out[(wid, aid)] = n
    return out


def file_name(work: dict, composer: dict, asset: dict) -> str:
    part = PART_EN.get(asset["part"], "Other")
    lab = label_slug((asset.get("label") or {}).get("en"))
    head = "-".join(x for x in (title_slug(work), catalog_slug(work)) if x)
    return f"{composer_slug(composer)}_{head}_{part}{'-' + lab if lab else ''}.pdf"


def doc_info(work: dict, composer: dict, asset: dict) -> dict[str, str]:
    """PDF の文書情報。ビューアの「タイトル」「作成者」や検索に使われる"""
    cat = ", ".join(f"{ {'op': 'Op.', 'k': 'K.', 'bwv': 'BWV ', 'rv': 'RV ', 'd': 'D.', 'hob': 'Hob.', 'woo': 'WoO '}.get(c['type'], '')}{c['value']}" for c in work.get("catalog") or [])
    part = PART_TITLE.get(asset["part"], "Other")
    label = (asset.get("label") or {}).get("en")
    title = f"{work['title']['en']}{', ' + cat if cat else ''} – {part}{' (' + label + ')' if label else ''}"
    return {
        "/Title": title,
        "/Author": composer["name"]["en"],
        "/Subject": f"{composer['name']['ja']}「{work['title']['ja']}」 {part} | SONARIA Score Library",
        "/Keywords": ", ".join(x for x in (composer["name"]["en"], composer["name"]["ja"], work["title"]["en"], work["title"]["ja"], cat, part, "SONARIA") if x),
        "/Creator": "SONARIA Score Library",
    }
