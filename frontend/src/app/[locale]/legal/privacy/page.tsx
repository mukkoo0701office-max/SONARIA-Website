import type { Metadata } from "next";
import ContentPage from "@/components/ContentPage";
import { getDictionary } from "@/data/dictionaries";
import { isLocale, type Locale } from "@/lib/i18n";

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  const copy = getDictionary(locale).contentPages.privacy;
  return { title: copy.title, description: copy.lead };
}

// プライバシーポリシー（運営者の決定 2026-11-28: Claude が作成しそのまま掲載。根拠は docs/ads/ADSENSE_PLAN.md §6）
// 送信先・解析・広告の構成を変えたら、この内容も更新する
export default async function LegalPrivacyPage({ params }: Props) {
  const { locale: raw } = await params;
  const locale = raw as Locale;
  return <ContentPage locale={locale} copy={getDictionary(locale).contentPages.privacy} />;
}
