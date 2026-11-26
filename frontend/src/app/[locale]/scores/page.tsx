import type { Metadata } from "next";
import Container from "@/components/layout/Container";
import ScoreSearch from "@/components/scores/ScoreSearch";
import { getDictionary } from "@/data/dictionaries";
import { isLocale, type Locale } from "@/lib/i18n";

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  const t = getDictionary(locale).scores;
  return { title: t.pageTitle, description: t.subtitle };
}

export default async function ScoresPage({ params }: Props) {
  const { locale } = await params;
  return (
    <Container className="pb-12">
      <ScoreSearch locale={locale as Locale} />
    </Container>
  );
}
