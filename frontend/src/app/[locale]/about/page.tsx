import type { Metadata } from "next";
import Link from "next/link";
import Container from "@/components/layout/Container";
import { getDictionary } from "@/data/dictionaries";
import { pagePaths } from "@/data/site";
import { isLocale, localizedPath, type Locale } from "@/lib/i18n";

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  const t = getDictionary(locale).about;
  return { title: t.pageTitle, description: t.body };
}

// 管理人のプロフィールは別ページ（/profile/）に分ける（個人を前面に出さない方針）
export default async function AboutPage({ params }: Props) {
  const { locale: raw } = await params;
  const locale = raw as Locale;
  const dict = getDictionary(locale);
  const t = dict.about;

  return (
    <Container className="py-8 lg:py-12">
      <h1 className="mb-3 text-2xl font-bold">{t.headline}</h1>
      <p className="text-sm leading-relaxed">{t.body}</p>
      <Link href={localizedPath(locale, pagePaths.profile)} className="mt-6 inline-block text-[13px] text-navy underline">
        {dict.pages.profile}
      </Link>
    </Container>
  );
}
