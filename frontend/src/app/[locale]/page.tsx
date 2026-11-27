import Container from "@/components/layout/Container";
import HeroCarousel from "@/components/home/HeroCarousel";
import ServicePickup from "@/components/home/ServicePickup";
import TeacherQuickSearch from "@/components/home/TeacherQuickSearch";
import ScoreQuickSearch from "@/components/home/ScoreQuickSearch";
import JsonLd from "@/components/seo/JsonLd";
import { composerLocales, publishedComposers, workSummaries, works, worksByComposer } from "@/data/scores/catalog";
import { formations } from "@/data/works";
import { libraryPaths } from "@/data/scores/paths";
import { getDictionary } from "@/data/dictionaries";
import { absoluteUrl } from "@/lib/seo";
import { localizedPath, type Locale } from "@/lib/i18n";

type Props = { params: Promise<{ locale: string }> };

// トップページ（トップページ改修指示書 v1.0）
// 構成: メインビジュアル（8枚） → 楽譜を探す → 講師を探す → ピックアップ（有料サービス）。フッターは共通レイアウト
export default async function HomePage({ params }: Props) {
  const { locale: raw } = await params;
  const locale = raw as Locale;
  const dict = getDictionary(locale);

  const url = absoluteUrl(`/${locale}/`);
  // 作品数の多い作曲家（最大 8 人）。リンク先は実在する作曲家ページだけ
  const topComposers = [...publishedComposers]
    .sort((a, b) => worksByComposer(b.id).length - worksByComposer(a.id).length || a.name.en.localeCompare(b.name.en))
    .slice(0, 8)
    .map((c) => ({ id: c.id, name: (c.short ?? c.name)[locale], href: localizedPath(composerLocales(c).includes(locale) ? locale : "ja", libraryPaths.composer(c.id)) }));
  // サイト全体の構造化データ（運営者は SONARIA という名称で表す。個人名は出さない）
  const ld = [
    { "@context": "https://schema.org", "@type": "WebSite", name: dict.meta.siteTitle, inLanguage: locale, ...(url ? { url } : {}) },
    { "@context": "https://schema.org", "@type": "Organization", name: "SONARIA", ...(absoluteUrl("/") ? { url: absoluteUrl("/") } : {}) },
  ];

  return (
    <>
      <JsonLd data={ld} />
      <h1 className="sr-only">
        {dict.meta.siteTitle} — {dict.meta.siteDescription}
      </h1>

      <Container width="wide" className="pt-4 lg:pt-6">
        <HeroCarousel locale={locale} />
      </Container>

      <section aria-labelledby="score-search-heading" className="mt-14 lg:mt-20">
        <Container width="wide">
          <ScoreQuickSearch locale={locale} workCount={works.length} composers={topComposers} formations={formations.filter((f) => workSummaries.some((w) => w.formation === f))} />
        </Container>
      </section>

      <section aria-labelledby="teacher-search-heading" className="mt-10 lg:mt-12">
        <Container width="wide">
          <TeacherQuickSearch locale={locale} />
        </Container>
      </section>

      <section aria-labelledby="pickup-heading" className="mt-14 lg:mt-20">
        <Container width="wide">
          <ServicePickup locale={locale} />
        </Container>
      </section>
    </>
  );
}
