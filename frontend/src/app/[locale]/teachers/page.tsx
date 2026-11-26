import type { Metadata } from "next";
import Container from "@/components/layout/Container";
import TeacherSearch from "@/components/teachers/TeacherSearch";
import { getDictionary } from "@/data/dictionaries";
import { isLocale, type Locale } from "@/lib/i18n";

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  const t = getDictionary(locale).teachers;
  return { title: t.pageTitle, description: t.lead };
}

// 講師検索。本番では公開済みの講師だけ、プレビューでは表示確認用のデモデータも表示する（src/data/teachers.ts）
export default async function TeachersPage({ params }: Props) {
  const { locale } = await params;
  return (
    <Container className="pb-12">
      <TeacherSearch locale={locale as Locale} />
    </Container>
  );
}
