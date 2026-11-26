import type { Metadata } from "next";
import ApplicationForm from "@/components/forms/ApplicationForm";
import Container from "@/components/layout/Container";
import { getDictionary } from "@/data/dictionaries";
import { pagePaths } from "@/data/site";
import { isLocale, type Locale } from "@/lib/i18n";

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  const copy = getDictionary(locale).forms.lesson;
  return { title: copy.title, description: copy.lead };
}

// 申し込みフォーム（docs/decisions/0003-external-backend.md）
export default async function LessonApplyPage({ params }: Props) {
  const { locale } = await params;
  return (
    <Container width="wide" className="py-8 lg:py-12">
      <ApplicationForm locale={locale as Locale} service="lesson" servicePage={pagePaths.lessons} />
    </Container>
  );
}
