// 一部の言語にしかないページの一覧（パス → あるページの言語）。言語の切り替えで、無いページへのリンクを作らないために使う。
// サーバー側（レイアウト）で計算し、ヘッダー・フッターの切り替えに渡す。全言語にあるページは含めない（一覧を小さく保つ）
import { categories, categoryLocales, composerLocales, publishedComposers, workLocales, works } from "@/data/scores/catalog";
import { libraryPaths } from "@/data/scores/paths";
import { locales, type Locale } from "@/lib/i18n";
import type { PartialLocalePaths } from "@/lib/localeSwitch";


export function partialLocalePaths(): PartialLocalePaths {
  const out: Record<string, readonly Locale[]> = {};
  const add = (path: string, available: readonly Locale[]) => {
    if (available.length < locales.length) out[path] = available;
  };
  for (const w of works) add(libraryPaths.work(w.id), workLocales(w));
  for (const c of publishedComposers) add(libraryPaths.composer(c.id), composerLocales(c));
  for (const cat of categories) add(libraryPaths.category(cat.id), categoryLocales(cat.id));
  // カテゴリの一覧ページ（/scores/category/）は存在しないので、さらに上（楽譜の一覧）へ移動させる
  add("/scores/category/", []);
  return out;
}
