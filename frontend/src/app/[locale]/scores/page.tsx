import type { Metadata } from "next";
import ScoreSearch from "@/components/scores/ScoreSearch";
import { getDictionary } from "@/data/dictionaries";
import { isLocale, type Locale } from "@/lib/i18n";

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  return isLocale(locale) ? { title: getDictionary(locale).scores.pageTitle } : {};
}

export default async function ScoresPage({ params }: Props) {
  const { locale } = await params;
  return <ScoreSearch locale={locale as Locale} />;
}
