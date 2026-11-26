import Container from "@/components/layout/Container";
import HeroCarousel from "@/components/home/HeroCarousel";
import ServicePickup from "@/components/home/ServicePickup";
import TeacherQuickSearch from "@/components/home/TeacherQuickSearch";
import { getDictionary } from "@/data/dictionaries";
import type { Locale } from "@/lib/i18n";

type Props = { params: Promise<{ locale: string }> };

// トップページ（トップページ改修指示書 v1.0）
// 構成: メインビジュアル（8枚） → 講師を探す → ピックアップ（有料サービス）。フッターは共通レイアウト
export default async function HomePage({ params }: Props) {
  const { locale: raw } = await params;
  const locale = raw as Locale;
  const dict = getDictionary(locale);

  return (
    <>
      <h1 className="sr-only">
        {dict.meta.siteTitle} — {dict.meta.siteDescription}
      </h1>

      <Container width="wide" className="pt-4 lg:pt-6">
        <HeroCarousel locale={locale} />
      </Container>

      <section aria-labelledby="teacher-search-heading" className="mt-14 lg:mt-20">
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
