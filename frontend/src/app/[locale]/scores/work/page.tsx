import type { Metadata } from "next";
import Container from "@/components/layout/Container";
import WorkDetail from "@/components/scores/WorkDetail";
import { getDictionary } from "@/data/dictionaries";
import { isLocale, type Locale } from "@/lib/i18n";

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  return isLocale(locale) ? { title: getDictionary(locale).scores.work.pageTitle } : {};
}

// 作品詳細（/scores/work/?id=...）。静的書き出しのため id は画面側で読む
// TODO: 作品数が固まったら /scores/{作品ID}/ の正規 URL にする（仕様「正規作品URL」）
export default async function WorkPage({ params }: Props) {
  const { locale } = await params;
  return (
    <Container className="pb-12">
      <WorkDetail locale={locale as Locale} />
    </Container>
  );
}
