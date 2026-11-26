import type { Metadata } from "next";
import Link from "next/link";
import Container from "@/components/layout/Container";
import Breadcrumbs from "@/components/seo/Breadcrumbs";
import JsonLd from "@/components/seo/JsonLd";
import { getDictionary } from "@/data/dictionaries";
import { composerLocales, publishedComposers, worksByComposer } from "@/data/scores/catalog";
import { libraryPaths } from "@/data/scores/paths";
import { isLocale, localizedPath, type Locale } from "@/lib/i18n";
import { absoluteUrl, pageMetadata } from "@/lib/seo";

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  const t = getDictionary(locale).library.composer;
  // 収録作品が無いあいだは中身の無いページなので検索エンジンに載せない
  return pageMetadata({ locale, path: libraryPaths.composers, title: t.indexTitle, description: t.indexLead, noindex: publishedComposers.length === 0 });
}

// 作曲家の一覧（収録作品がある作曲家だけ）
export default async function ComposersPage({ params }: Props) {
  const { locale: raw } = await params;
  const locale = raw as Locale;
  const lib = getDictionary(locale).library;
  const ld = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: lib.composer.indexTitle,
    itemListElement: publishedComposers.map((c, i) => {
      const url = absoluteUrl(localizedPath(composerLocales(c).includes(locale) ? locale : "ja", libraryPaths.composer(c.id)));
      return { "@type": "ListItem", position: i + 1, name: c.name[locale], ...(url ? { url } : {}) };
    }),
  };
  return (
    <Container className="pb-12">
      <Breadcrumbs label={lib.breadcrumb} items={[{ label: lib.home, href: localizedPath(locale, "/") }, { label: lib.composers }]} />
      <h1 className="mt-5 text-2xl font-bold">{lib.composer.indexTitle}</h1>
      <p className="mt-1 text-xs text-muted">{lib.composer.indexLead}</p>
      <ul className="mt-5 grid gap-2.5 min-[421px]:grid-cols-2">
        {publishedComposers.map((c) => (
          <li key={c.id}>
            <Link
              href={localizedPath(composerLocales(c).includes(locale) ? locale : "ja", libraryPaths.composer(c.id))}
              className="block rounded-card border border-line bg-card p-[13px] hover:border-navy"
            >
              <span className="block font-bold">{c.name[locale]}</span>
              <span className="mt-0.5 block text-xs text-muted">
                {[c.born?.slice(0, 4), c.died?.slice(0, 4)].filter(Boolean).join("–")} ・ {lib.category.works(worksByComposer(c.id).length)}
                {!composerLocales(c).includes(locale) && <> ・ {lib.onlyJapanese}</>}
              </span>
            </Link>
          </li>
        ))}
      </ul>
      {publishedComposers.length > 0 && <JsonLd data={ld} />}
    </Container>
  );
}
