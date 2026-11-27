import type { Metadata } from "next";
import Container from "@/components/layout/Container";
import PerformanceQuoteForm from "@/components/orders/PerformanceQuoteForm";
import { getDictionary } from "@/data/dictionaries";
import { siteImages } from "@/data/images";
import { isLocale, type Locale } from "@/lib/i18n";
import { withBasePath } from "@/lib/paths";

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  const t = getDictionary(locale).performanceQuote;
  // 送信機能が接続されるまでは検索エンジンに載せない（申込ページと同じ扱い。docs/proposals/performance-quote-and-teacher-registration.md）
  return { title: t.pageTitle, description: t.pageLead, robots: { index: false, follow: true } };
}

// 演奏依頼。見出し画像は下層ページ共通の控えめな高さ（PC 6:1・スマホ 3:1）にし、
// 最初の画面から見積もりフォームが見えるようにする（PR #24 §1）。広告・アフィリエイトは置かない
export default async function PerformancePage({ params }: Props) {
  const { locale: raw } = await params;
  const locale = raw as Locale;
  const dict = getDictionary(locale);
  const t = dict.performanceQuote;
  const img = siteImages.performance;

  return (
    <Container width="wide" className="py-8 lg:py-12">
      <div className="overflow-hidden rounded-card border border-line bg-card">
        {/* eslint-disable-next-line @next/next/no-img-element -- 静的書き出しのため next/image の最適化は使えない */}
        <img
          src={withBasePath(img.src)}
          width={img.width}
          height={img.height}
          alt={dict.images.alt.performance}
          decoding="async"
          style={img.focus ? { objectPosition: img.focus } : undefined}
          className="aspect-[3/1] w-full object-cover sm:aspect-[6/1]"
        />
        <div className="p-6 sm:p-8">
          <h1 className="text-2xl font-bold sm:text-3xl">{t.pageTitle}</h1>
          <p className="mt-3 max-w-3xl text-sm leading-relaxed sm:text-base">{t.pageLead}</p>
          <ul className="mt-4 flex flex-wrap gap-2">
            {t.points.map((p) => (
              <li key={p} className="rounded-full border border-line bg-paper px-3 py-1.5 text-[13px]">
                <span aria-hidden="true" className="mr-1 text-navy">
                  ✓
                </span>
                {p}
              </li>
            ))}
          </ul>
        </div>
      </div>

      <section aria-labelledby="quote-heading" className="mt-6">
        <h2 id="quote-heading" className="mb-4 text-xl font-bold">
          {t.formHeading}
        </h2>
        <PerformanceQuoteForm locale={locale} />
      </section>
    </Container>
  );
}
