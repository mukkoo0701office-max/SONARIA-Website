import type { Metadata } from "next";
import Container from "@/components/layout/Container";
import TeacherProfile from "@/components/teachers/TeacherProfile";
import { getDictionary } from "@/data/dictionaries";
import { isLocale, type Locale } from "@/lib/i18n";

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  return isLocale(locale) ? { title: getDictionary(locale).teacherProfile.pageTitle } : {};
}

// 講師の簡易プロフィール（/teachers/profile/?id=...）
export default async function TeacherProfilePage({ params }: Props) {
  const { locale } = await params;
  return (
    <Container className="pb-12">
      <TeacherProfile locale={locale as Locale} />
    </Container>
  );
}
