import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Footer from "@/components/layout/Footer";
import Header from "@/components/layout/Header";
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
      <body>
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:rounded-button focus:bg-card focus:px-4 focus:py-2"
        >
          {dict.common.skipToContent}
        </a>
        <div className="mx-auto max-w-content px-3 pb-12 pt-3.5 sm:px-4 sm:pb-16 sm:pt-[22px]">
          <Header locale={locale} />
          <main id="main">{children}</main>
          <Footer locale={locale} />
        </div>
      </body>
    </html>
  );
}
