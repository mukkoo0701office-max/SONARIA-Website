import type { Metadata } from "next";
import ContentPage from "@/components/ContentPage";
import CuratorChannels from "@/components/profile/CuratorChannels";
import ButtonLink from "@/components/ui/ButtonLink";
import { getDictionary } from "@/data/dictionaries";
import { curatorPortrait } from "@/data/images";
import { pagePaths } from "@/data/site";
import { isLocale, localizedPath, type Locale } from "@/lib/i18n";

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  const copy = getDictionary(locale).contentPages.profile;
  return { title: copy.title, description: copy.lead };
}

// 旧サイト（https://www.mukkoo0701music.jp/）の文章をもとにしたページ。
// 構成: プロフィール → 経歴・活動内容 → 執筆・発信活動（note・X）→ お問い合わせ（運営者の指示 2026-11-27）
export default async function ProfilePage({ params }: Props) {
  const { locale: raw } = await params;
  const locale = raw as Locale;
  const dict = getDictionary(locale);

  return (
    <ContentPage locale={locale} copy={dict.contentPages.profile} image="profile" portrait={{ image: curatorPortrait, alt: dict.images.curatorPortrait }} after={<CuratorChannels locale={locale} />}>
        <ButtonLink href={localizedPath(locale, pagePaths.about)} variant="secondary">{dict.pages.about}</ButtonLink>
    </ContentPage>
  );
}
