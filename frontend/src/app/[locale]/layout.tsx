import type { Metadata } from "next";
import { notFound } from "next/navigation";
import SiteFooter from "@/components/layout/SiteFooter";
import SiteHeader from "@/components/layout/SiteHeader";
import { getDictionary } from "@/data/dictionaries";
import { isLocale, locales } from "@/lib/i18n";
import "../globals.css";

// 静的書き出しのため、/ja と /en だけを事前に生成し、それ以外の言語は 404 にする
export const dynamicParams = false;

export function generateStaticParams() {
  return locales.map((locale) => ({ locale }));
}

type Props = {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
};

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  const dict = getDictionary(locale);

  // TODO: 本番ドメインが決まったら NEXT_PUBLIC_SITE_URL を設定し、canonical・hreflang を有効にする
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL;
  // プレビュー（GitHub Pages）は検索エンジンに載せない
  const isPreview = process.env.NEXT_PUBLIC_PREVIEW === "1";

  return {
    title: { default: dict.meta.siteTitle, template: `%s | ${dict.meta.siteTitle}` },
    description: dict.meta.siteDescription,
    openGraph: {
      siteName: dict.meta.siteTitle,
      title: dict.meta.siteTitle,
      description: dict.meta.siteDescription,
      type: "website",
      locale: locale === "ja" ? "ja_JP" : "en_US",
    },
    ...(siteUrl ? { metadataBase: new URL(siteUrl) } : {}),
    ...(isPreview ? { robots: { index: false, follow: false } } : {}),
  };
}

export default async function LocaleLayout({ children, params }: Props) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const dict = getDictionary(locale);

  return (
    <html lang={locale}>
      <body className="flex min-h-dvh flex-col">
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-button focus:bg-card focus:px-4 focus:py-2"
        >
          {dict.common.skipToContent}
        </a>
        <SiteHeader locale={locale} />
        {/* 各ページが自分で幅を決める（トップは広め、検索ページは承認済みの 780px） */}
        <main id="main" className="flex-1">
          {children}
        </main>
        <SiteFooter locale={locale} />
      </body>
    </html>
  );
}
