import type { Metadata } from "next";
import PlaceholderPage from "@/components/PlaceholderPage";
import { getDictionary } from "@/data/dictionaries";
import { isLocale, type Locale } from "@/lib/i18n";

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  const copy = getDictionary(locale).placeholders.contact;
  return { title: copy.title, description: copy.lead };
}

// 仮ページ（準備中）
export default async function ContactPage({ params }: Props) {
  const { locale: raw } = await params;
  const locale = raw as Locale;
  const dict = getDictionary(locale);

  return (
    <PlaceholderPage locale={locale} copy={dict.placeholders.contact} />
  );
}
