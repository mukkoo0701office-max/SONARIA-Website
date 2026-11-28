import type { Metadata } from "next";
import { alternateLanguages, localeConfig, locales, type Locale } from "@/lib/i18n";

// SEO の共通処理（canonical・hreflang・OGP・検索エンジンへの掲載可否）。
//
// - NEXT_PUBLIC_SITE_URL: 公開 URL（basePath を含む。例: https://example.jp）。
//   [要決定] 正式公開ドメインが決まるまで、本番の値は未設定。未設定のあいだ canonical・hreflang は出さない
// - NEXT_PUBLIC_INDEXABLE: "1" のときだけ検索エンジンへの掲載を許可する。
//   プレビュー（NEXT_PUBLIC_PREVIEW=1）は常に noindex。正式公開の判断が下るまで本番も既定で noindex
//   （プレビューの設定が本番に引き継がれる事故と、未承認のまま本番が掲載される事故の両方を防ぐ）

export const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? "").replace(/\/$/, "");
export const isIndexable = process.env.NEXT_PUBLIC_INDEXABLE === "1" && process.env.NEXT_PUBLIC_PREVIEW !== "1";

/** basePath を含まないサイト内パス（/ja/scores/...）を絶対 URL にする。公開 URL が未設定なら null */
export function absoluteUrl(path: string): string | null {
  return siteUrl ? `${siteUrl}${path.startsWith("/") ? path : `/${path}`}` : null;
}

type PageMetaInput = {
  locale: Locale;
  path: string; // 言語を除いたパス（例: /scores/beethoven-violin-sonata-5/）
  title: string;
  description: string;
  availableLocales?: readonly Locale[]; // このページが存在する言語（存在しない言語の URL は出さない）
  image?: { url: string; width: number; height: number; alt: string } | null; // url は basePath を含まないパス
  type?: "website" | "article" | "profile";
  noindex?: boolean; // 未完成ページなど
};

export function pageMetadata({ locale, path, title, description, availableLocales = locales, image, type = "website", noindex }: PageMetaInput): Metadata {
  const url = absoluteUrl(`/${locale}${path}`);
  // hreflang（存在する言語どうしで相互参照。x-default は既定言語のページ）
  const languages = alternateLanguages(path, availableLocales, absoluteUrl);
  const imageUrl = image ? absoluteUrl(image.url) : null;

  return {
    title,
    description,
    ...(url ? { alternates: { canonical: url, ...(Object.keys(languages).length > 0 ? { languages } : {}) } } : {}),
    openGraph: {
      title,
      description,
      type,
      locale: localeConfig(locale).ogLocale,
      ...(url ? { url } : {}),
      ...(imageUrl && image ? { images: [{ url: imageUrl, width: image.width, height: image.height, alt: image.alt }] } : {}),
    },
    twitter: {
      card: imageUrl ? "summary_large_image" : "summary",
      title,
      description,
      ...(imageUrl ? { images: [imageUrl] } : {}),
    },
    ...(noindex || !isIndexable ? { robots: { index: false, follow: true } } : {}),
  };
}
