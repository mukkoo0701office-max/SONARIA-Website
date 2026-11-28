import type { Metadata } from "next";
import ContentPage from "@/components/ContentPage";
import { getDictionary } from "@/data/dictionaries";
import { isLocale, type Locale } from "@/lib/i18n";

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  const copy = getDictionary(locale).contentPages.commerce;
  return { title: copy.title, description: copy.lead };
}

// 特定商取引法に基づく表示（決済導入 Phase 6。docs/payments/PAYMENTS_DESIGN.md）。
// 運営者の決定（2026-11-29）: 氏名・住所・電話番号は「請求があれば遅滞なく開示」。法律の専門家の確認は経ていない。
// 料金・支払い方法・キャンセル規定を変えたら、この内容も更新する
export default async function LegalCommercePage({ params }: Props) {
  const { locale: raw } = await params;
  const locale = raw as Locale;
  return <ContentPage locale={locale} copy={getDictionary(locale).contentPages.commerce} />;
}
