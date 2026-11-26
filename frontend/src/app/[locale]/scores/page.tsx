import type { Metadata } from "next";
import Container from "@/components/layout/Container";
import LibraryBrowse from "@/components/library/LibraryBrowse";
import ScoreSearch from "@/components/scores/ScoreSearch";
import { getDictionary } from "@/data/dictionaries";
import { isSampleCatalog, workSummaries } from "@/data/scores/catalog";
import { works as demoWorks } from "@/data/works";
import { isLocale, type Locale } from "@/lib/i18n";
import { pageMetadata } from "@/lib/seo";

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  const t = getDictionary(locale).scores;
  return pageMetadata({ locale, path: "/scores/", title: t.pageTitle, description: t.subtitle });
}

// 公開できる作品があればカタログ、まだ無いあいだはプレビューだけで説明用のデモデータ（画面に明記）。
// 実在しない楽譜を本番の検索結果に出さないため、本番でカタログが空なら結果も空にする
const isPreviewBuild = process.env.NEXT_PUBLIC_PREVIEW === "1";
const searchWorks = workSummaries.length > 0 ? workSummaries : isPreviewBuild ? demoWorks : [];
const isDemoData = workSummaries.length === 0 || isSampleCatalog;

export default async function ScoresPage({ params }: Props) {
  const { locale } = await params;
  return (
    <Container className="pb-12">
      <ScoreSearch locale={locale as Locale} works={searchWorks} isDemoData={isDemoData} />
      <LibraryBrowse locale={locale as Locale} />
    </Container>
  );
}
