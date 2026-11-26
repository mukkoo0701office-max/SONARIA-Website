import type { Metadata } from "next";
import Link from "next/link";
import { pagePaths } from "@/data/site";
import { isLocale, localizedPath, type Locale } from "@/lib/i18n";
import PlaceholderPage from "@/components/PlaceholderPage";
import { getDictionary } from "@/data/dictionaries";

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  const copy = getDictionary(locale).placeholders.lessons;
  return { title: copy.title, description: copy.lead };
}

// 仮ページ（準備中）
export default async function LessonsPage({ params }: Props) {
  const { locale: raw } = await params;
  const locale = raw as Locale;
  const dict = getDictionary(locale);

  return (
    <PlaceholderPage locale={locale} copy={dict.placeholders.lessons} image="lessons">
      <Link
        href={localizedPath(locale, pagePaths.teachers)}
        className="mt-6 inline-flex rounded-button border border-navy bg-navy px-5 py-3 text-[13px] font-semibold text-white transition-[filter] hover:brightness-95"
      >
        {dict.pages.teachers}
      </Link>
    </PlaceholderPage>
  );
}
