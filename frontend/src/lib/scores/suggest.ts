// ホームの楽譜検索の入力補完（候補の選び方）。画面に依存しない純粋な関数にしてテストする
// 一致の判定は楽譜検索ページ（lib/scores/filters.ts）と同じ「部分一致」。全角・半角の違いは NFKC でそろえる

export type SuggestWork = {
  slug: string;
  title: { ja: string; en: string };
  composer: { ja: string; en: string };
  composerId: string;
  searchText?: string;
  hasEnglish?: boolean;
};
export type SuggestComposer = { id: string; name: { ja: string; en: string }; aliases?: string[] };

export type Suggestions = {
  composers: { id: string; name: string; count: number }[];
  works: { slug: string; title: string; composer: string; hasEnglish: boolean }[];
};

const norm = (s: string) => s.normalize("NFKC").toLocaleLowerCase().replace(/\s+/g, " ").trim();

/** 候補を出し始める長さ。英数字だけなら 2 文字から、日本語などは 1 文字から */
export function shouldSuggest(q: string): boolean {
  const t = q.trim();
  if (!t) return false;
  // eslint-disable-next-line no-control-regex
  return /^[\x00-\x7F]+$/.test(t) ? t.length >= 2 : t.length >= 1;
}

// 並び順: 先頭一致 → 単語の先頭一致 → 部分一致
function rank(text: string, q: string): number {
  const i = text.indexOf(q);
  if (i < 0) return -1;
  if (i === 0) return 0;
  return /[\s.,・（(《「-]/.test(text[i - 1]) ? 1 : 2;
}

// 一致なし（-1）を末尾扱い（99）にする
const miss = (r: number) => (r < 0 ? 99 : r);

export function suggest(
  q: string,
  works: readonly SuggestWork[],
  composers: readonly SuggestComposer[],
  locale: "ja" | "en",
  limits = { composers: 3, works: 6 },
): Suggestions {
  if (!shouldSuggest(q)) return { composers: [], works: [] };
  const nq = norm(q);

  const counts = new Map<string, number>();
  for (const w of works) counts.set(w.composerId, (counts.get(w.composerId) ?? 0) + 1);

  const composerHits = composers
    .map((c) => {
      const names = [c.name.ja, c.name.en, ...(c.aliases ?? [])].map(norm);
      const r = Math.min(...names.map((n) => miss(rank(n, nq))));
      return { c, r };
    })
    .filter((x) => x.r < 99 && (counts.get(x.c.id) ?? 0) > 0)
    .sort((a, b) => a.r - b.r || (counts.get(b.c.id) ?? 0) - (counts.get(a.c.id) ?? 0))
    .slice(0, limits.composers)
    .map(({ c }) => ({ id: c.id, name: c.name[locale], count: counts.get(c.id) ?? 0 }));

  const workHits = works
    .map((w) => {
      // 曲名での一致を優先し、作曲家名・別名・作品番号での一致は後ろに回す
      const t = Math.min(miss(rank(norm(w.title.ja), nq)), miss(rank(norm(w.title.en), nq)));
      const other = miss(rank(norm([w.composer.ja, w.composer.en, w.searchText ?? ""].join(" ")), nq));
      const r = t < 99 ? t : other < 99 ? 10 + other : 99;
      return { w, r };
    })
    .filter((x) => x.r < 99)
    .sort((a, b) => a.r - b.r || a.w.title[locale].localeCompare(b.w.title[locale], locale))
    .slice(0, limits.works)
    .map(({ w }) => ({ slug: w.slug, title: w.title[locale], composer: w.composer[locale], hasEnglish: w.hasEnglish ?? false }));

  return { composers: composerHits, works: workHits };
}
