// Amazon 検索リンクの組み立て（純粋関数。node のテストから直接読むため、ほかのファイルを import しない）

/** 検索ウィジェットの切り替え（検索語の末尾に付ける語） */
export type AmazonSearchKind = "score" | "parts" | "pocket" | "books";
export const amazonSearchKinds: readonly AmazonSearchKind[] = ["score", "parts", "pocket", "books"];
const suffix: Record<AmazonSearchKind, { ja: string; en: string }> = {
  score: { ja: "楽譜", en: "sheet music" },
  parts: { ja: "パート譜", en: "parts" },
  pocket: { ja: "ポケットスコア", en: "study score" },
  books: { ja: "解説 本", en: "book" },
};
const BASE_URL = "https://www.amazon.co.jp/s";

/** 曲名から、検索で邪魔になる愛称・括弧書き・調性を取り除く（例: 弦楽四重奏曲 ハ長調《皇帝》 → 弦楽四重奏曲） */
export function plainTitle(title: string): string {
  return title
    .replace(/[《「“"『(（].*?[》」”"』)）]/g, " ")
    .replace(/\s+(in\s+)?[A-G](-flat|-sharp| flat| sharp)?\s+(major|minor)\b/gi, " ")
    .replace(/[変嬰]?[ハニホヘトイロ][長短]調/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** 作品番号は最初の番号だけ使う（例: "76-3" → Op.76、"216, 218, 219" → K.216） */
export function mainCatalog(label: string): string {
  const first = label.split(",")[0].trim();
  return first.replace(/(Op\.|K\.|BWV |RV |Hob\.|D\.|WoO )?(\S+?)-\d+$/, "$1$2");
}

export function amazonKeyword(parts: { composer: string; title: string; catalog?: string }, kind: AmazonSearchKind, lang: "ja" | "en"): string {
  return [parts.composer, plainTitle(parts.title), parts.catalog ? mainCatalog(parts.catalog) : "", suffix[kind][lang]].filter(Boolean).join(" ");
}

/** tag: トラッキング ID（data/affiliate/amazonSearch.ts）。空ならタグなし */
export function amazonSearchUrl(keyword: string, tag: string): string {
  const q = new URLSearchParams({ k: keyword });
  if (tag) q.set("tag", tag);
  return `${BASE_URL}?${q.toString()}`;
}
