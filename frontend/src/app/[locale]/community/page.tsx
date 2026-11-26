import type { Metadata } from "next";
import { externalLinks } from "@/data/site";
import PlaceholderPage from "@/components/PlaceholderPage";
import { getDictionary } from "@/data/dictionaries";
import { isLocale, type Locale } from "@/lib/i18n";

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  const copy = getDictionary(locale).placeholders.community;
  return { title: copy.title, description: copy.lead };
}

// 仮ページ（準備中）
export default async function CommunityPage({ params }: Props) {
  const { locale: raw } = await params;
  const locale = raw as Locale;
  const dict = getDictionary(locale);

  return (
    <PlaceholderPage locale={locale} copy={dict.placeholders.community} image="community">
      <a
        href={externalLinks.community}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-6 inline-flex items-center gap-1 rounded-button border border-line bg-card px-5 py-3 text-[13px] text-navy hover:bg-paper"
      >
        {dict.community.externalLinkLabel}
        <span className="text-[11px] text-muted">· {dict.common.externalSite}</span>
      </a>
    </PlaceholderPage>
  );
}
