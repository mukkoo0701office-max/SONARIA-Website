import type { MetadataRoute } from "next";
import { categories, categoryLocales, composerLocales, publishedComposers, workLocales, works } from "@/data/scores/catalog";
import { libraryPaths } from "@/data/scores/paths";
import { pagePaths, type PageKey } from "@/data/site";
import { locales, type Locale } from "@/lib/i18n";
import { absoluteUrl, isIndexable } from "@/lib/seo";

export const dynamic = "force-static";

// sitemap.xml。カタログから自動で作るため、作品の追加・削除で自動的に更新される。
// 登録するのは公開済みで内容のある URL だけ（準備中のページ・検索条件付きの URL・存在しない言語の URL は入れない）。
// 公開 URL（NEXT_PUBLIC_SITE_URL）が未設定、または掲載を許可していないビルドでは空にする。

// 内容のある固定ページ（準備中の performance・contact・privacy は除く）
const staticPages: PageKey[] = ["home", "scores", "bowing", "lessons", "recording", "community", "profile", "teachers", "about"];

export default function sitemap(): MetadataRoute.Sitemap {
  if (!isIndexable || !absoluteUrl("/")) return [];
  const entries: MetadataRoute.Sitemap = [];

  function add(path: string, available: readonly Locale[], lastModified?: string) {
    const languages: Record<string, string> = {};
    for (const l of available) languages[l] = absoluteUrl(`/${l}${path}`)!;
    for (const l of available) {
      entries.push({
        url: absoluteUrl(`/${l}${path}`)!,
        ...(lastModified ? { lastModified } : {}),
        ...(available.length > 1 ? { alternates: { languages } } : {}),
      });
    }
  }

  for (const key of staticPages) add(pagePaths[key], locales);
  for (const w of works) add(libraryPaths.work(w.id), workLocales(w), w.updatedAt);
  if (publishedComposers.length > 0) add(libraryPaths.composers, locales);
  for (const c of publishedComposers) add(libraryPaths.composer(c.id), composerLocales(c));
  for (const cat of categories) add(libraryPaths.category(cat.id), categoryLocales(cat.id));
  return entries;
}
