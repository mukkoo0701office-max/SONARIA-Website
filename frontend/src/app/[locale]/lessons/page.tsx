import type { Metadata } from "next";
import ContentPage from "@/components/ContentPage";
import ButtonLink from "@/components/ui/ButtonLink";
import { getDictionary } from "@/data/dictionaries";
import { pagePaths } from "@/data/site";
import { isLocale, localizedPath, type Locale } from "@/lib/i18n";

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  const copy = getDictionary(locale).contentPages.lessons;
  return { title: copy.title, description: copy.lead };
}

// 旧サイト（https://www.mukkoo0701music.jp/）の文章をもとにしたページ
export default async function LessonsPage({ params }: Props) {
  const { locale: raw } = await params;
  const locale = raw as Locale;
  const dict = getDictionary(locale);

  return (
    <ContentPage locale={locale} copy={dict.contentPages.lessons} image="lessons">
        <ButtonLink href={localizedPath(locale, `${pagePaths.lessons}apply/`)}>{dict.apply.lessonCta}</ButtonLink>
        <ButtonLink href={localizedPath(locale, pagePaths.contact)} variant="secondary">{dict.contentCta.contact}</ButtonLink>
        <ButtonLink href={localizedPath(locale, pagePaths.profile)} variant="secondary">{dict.contentCta.profile}</ButtonLink>
        <ButtonLink href={localizedPath(locale, pagePaths.teachers)} variant="secondary">{dict.contentCta.teachers}</ButtonLink>
    </ContentPage>
  );
}
