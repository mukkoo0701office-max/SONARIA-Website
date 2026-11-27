import type { Metadata } from "next";
import { notFound } from "next/navigation";
import GoogleAnalytics from "@/components/analytics/GoogleAnalytics";
import SiteFooter from "@/components/layout/SiteFooter";
import SiteHeader from "@/components/layout/SiteHeader";
import { getDictionary } from "@/data/dictionaries";
import { isLocale, locales } from "@/lib/i18n";
import { isIndexable, siteUrl } from "@/lib/seo";
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
    // 検索エンジンへの掲載は NEXT_PUBLIC_INDEXABLE=1 の本番ビルドだけ（lib/seo.ts）。プレビューは常に noindex
    ...(isIndexable ? {} : { robots: { index: false, follow: true } }),
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
        <GoogleAnalytics />
      </body>
    </html>
  );
}
