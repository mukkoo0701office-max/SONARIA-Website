import type { Metadata } from "next";
import { getDictionary } from "@/data/dictionaries";
import { isLocale, type Locale } from "@/lib/i18n";

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  return isLocale(locale) ? { title: getDictionary(locale).about.pageTitle } : {};
}

// TODO: 管理人プロフィールは別ページに分ける（個人を前面に出さない方針）
export default async function AboutPage({ params }: Props) {
  const { locale } = await params;
  const t = getDictionary(locale as Locale).about;

  return (
    <section className="my-6">
      <h1 className="mb-3 text-2xl font-bold">{t.headline}</h1>
      <p className="text-sm leading-relaxed">{t.body}</p>
    </section>
  );
}
