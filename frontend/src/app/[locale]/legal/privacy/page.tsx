import type { Metadata } from "next";
import ContentPage from "@/components/ContentPage";
import { getDictionary } from "@/data/dictionaries";
import { isLocale, type Locale } from "@/lib/i18n";

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  const copy = getDictionary(locale).privacyPolicy;
  return { title: copy.title, description: copy.lead };
}

// プライバシーポリシー（草案）。申し込みフォームの同意欄からリンクする
export default async function PrivacyPage({ params }: Props) {
  const { locale } = await params;
  return <ContentPage locale={locale as Locale} copy={getDictionary(locale as Locale).privacyPolicy} />;
}
