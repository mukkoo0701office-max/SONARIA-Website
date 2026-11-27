import type { Metadata } from "next";
import Breadcrumbs from "@/components/seo/Breadcrumbs";
import Container from "@/components/layout/Container";
import TeacherRegistrationForm from "@/components/teachers/TeacherRegistrationForm";
import { getDictionary } from "@/data/dictionaries";
import { pagePaths } from "@/data/site";
import { isLocale, localizedPath, type Locale } from "@/lib/i18n";

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  const t = getDictionary(locale).teacherRegister;
  // 送信機能が接続されるまでは検索エンジンに載せない
  return { title: t.pageTitle, description: t.pageLead, robots: { index: false, follow: true } };
}

// 講師登録の申請ページ（PR #24 §2）。講師ごとのブログではなく、登録フォーム専用のページ。
// 申請は管理人が確認し、承認した講師だけを src/data/teachers.ts の publishedTeachers に追加して公開する
export default async function TeacherRegisterPage({ params }: Props) {
  const { locale: raw } = await params;
  const locale = raw as Locale;
  const dict = getDictionary(locale);
  const t = dict.teacherRegister;

  return (
    <Container width="wide" className="pb-12">
      <Breadcrumbs
        label={dict.teacherProfile.breadcrumbLabel}
        items={[
          { label: dict.pages.home, href: localizedPath(locale, pagePaths.home) },
          { label: dict.pages.teachers, href: localizedPath(locale, pagePaths.teachers) },
          { label: dict.pages.teacherRegister },
        ]}
      />
      <section className="my-6">
        <h1 className="text-2xl font-bold sm:text-3xl">{t.pageTitle}</h1>
        <p className="mt-3 max-w-3xl text-sm leading-relaxed sm:text-base">{t.pageLead}</p>
      </section>

      <div className="mb-6 grid gap-4 lg:grid-cols-2">
        <section className="rounded-card border border-line bg-card p-5">
          <h2 className="border-l-[3px] border-gold pl-3 text-base font-bold">{t.stepsHeading}</h2>
          <ol className="mt-3 grid list-decimal gap-1.5 pl-5 text-[14px] leading-relaxed">
            {t.steps.map((s) => (
              <li key={s}>{s}</li>
            ))}
          </ol>
        </section>
        <section className="rounded-card border border-line bg-card p-5">
          <h2 className="border-l-[3px] border-gold pl-3 text-base font-bold">{t.rulesHeading}</h2>
          <ul className="mt-3 grid list-disc gap-1.5 pl-5 text-[14px] leading-relaxed">
            {t.rules.map((s) => (
              <li key={s}>{s}</li>
            ))}
          </ul>
        </section>
      </div>

      <TeacherRegistrationForm locale={locale} />
    </Container>
  );

}
