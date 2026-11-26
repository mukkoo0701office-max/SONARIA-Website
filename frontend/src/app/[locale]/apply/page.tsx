import type { Metadata } from "next";
import Container from "@/components/layout/Container";
import ServiceOrderForm from "@/components/orders/ServiceOrderForm";
import { getDictionary } from "@/data/dictionaries";
import { isLocale, type Locale } from "@/lib/i18n";

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  const t = getDictionary(locale).orderForm;
  // 送信機能が接続されるまでは検索エンジンに載せない（docs/proposals/service-order-forms.md）
  return { title: t.pageTitle, description: t.pageLead, robots: { index: false, follow: true } };
}

// サービスの統合申込フォーム（Issue #13）。広告・アフィリエイトは置かない
export default async function ApplyPage({ params }: Props) {
  const { locale: raw } = await params;
  const locale = raw as Locale;
  const t = getDictionary(locale).orderForm;

  return (
    <Container width="wide" className="py-8 lg:py-12">
      <h1 className="text-2xl font-bold sm:text-3xl">{t.pageTitle}</h1>
      <p className="mt-3 max-w-content text-sm leading-relaxed sm:text-base">{t.pageLead}</p>
      <div className="mt-6">
        <ServiceOrderForm locale={locale} />
      </div>
    </Container>
  );
}
