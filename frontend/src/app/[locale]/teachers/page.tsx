import type { Metadata } from "next";
import { getDictionary } from "@/data/dictionaries";
import { isLocale, type Locale } from "@/lib/i18n";

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  return isLocale(locale) ? { title: getDictionary(locale).teachers.pageTitle } : {};
}

// 講師検索（準備中）。架空の講師データは表示しない（CLAUDE.md: 講師ディレクトリの不変ルール）
// TODO: docs/SONARIA_TEACHER_DIRECTORY_UI_SPEC_v1.0.md（B案）に沿って検索・簡易プロフィールを実装する
export default async function TeachersPage({ params }: Props) {
  const { locale } = await params;
  const t = getDictionary(locale as Locale).teachers;

  return (
    <section className="my-6">
      <h1 className="mb-3 text-2xl font-bold">{t.headline}</h1>
      <p className="mb-5 text-sm leading-relaxed">{t.body}</p>
      <ul className="rounded-card border border-line bg-card p-[17px] text-[13px] leading-relaxed">
        {t.rules.map((rule) => (
          <li key={rule} className="ml-4 list-disc">
            {rule}
          </li>
        ))}
      </ul>
    </section>
  );
}
