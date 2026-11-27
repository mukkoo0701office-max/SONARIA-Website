import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Container from "@/components/layout/Container";
import AdSenseSlot from "@/components/ads/AdSenseSlot";
import AffiliateSlot from "@/components/library/AffiliateSlot";
import WorkList, { workHref } from "@/components/library/WorkList";
import Breadcrumbs from "@/components/seo/Breadcrumbs";
import JsonLd from "@/components/seo/JsonLd";
import { getDictionary } from "@/data/dictionaries";
import { categories, categoryLocales, getCategory } from "@/data/scores/catalog";
import { libraryPaths } from "@/data/scores/paths";
import { pagePaths } from "@/data/site";
import { isLocale, localizedPath } from "@/lib/i18n";
import { absoluteUrl, pageMetadata } from "@/lib/seo";

// 編成別・曲種別のカテゴリページ（catalog.ts の categories から自動生成）。
// 英語ページは、英語ページのある作品が MIN_CATEGORY_WORKS 件以上あるカテゴリだけ作る。

type Params = { locale: string; categoryId: string };
type Props = { params: Promise<Params> };

export const dynamicParams = false;
const NONE = "_none";

export function generateStaticParams({ params }: { params: { locale: string } }): { categoryId: string }[] {
  if (!isLocale(params.locale)) return [{ categoryId: NONE }];
  const locale = params.locale;
  const list = categories.filter((c) => categoryLocales(c.id).includes(locale)).map((c) => ({ categoryId: c.id }));
  return list.length > 0 ? list : [{ categoryId: NONE }];
}

function load(p: Params) {
  if (!isLocale(p.locale)) return null;
  const cat = getCategory(p.categoryId);
  if (!cat || !categoryLocales(cat.id).includes(p.locale)) return null;
  return { locale: p.locale, cat };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const loaded = load(await params);
  if (!loaded) return {};
  const { locale, cat } = loaded;
  const t = getDictionary(locale).library.category;
  return pageMetadata({
    locale,
    path: libraryPaths.category(cat.id),
    title: t.metaTitle(cat.name[locale]),
    description: t.metaDescription(cat.name[locale], cat.works.length),
    availableLocales: categoryLocales(cat.id),
  });
}

export default async function CategoryPage({ params }: Props) {
  const loaded = load(await params);
  if (!loaded) notFound();
  const { locale, cat } = loaded;
  const lib = getDictionary(locale).library;
  const ld = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: cat.name[locale],
    numberOfItems: cat.works.length,
    itemListElement: cat.works.map((w, i) => {
      const url = absoluteUrl(workHref(w, locale));
      return { "@type": "ListItem", position: i + 1, name: w.title[locale], ...(url ? { url } : {}) };
    }),
  };
  return (
    <Container className="pb-12">
      <Breadcrumbs
        label={lib.breadcrumb}
        items={[
          { label: lib.home, href: localizedPath(locale, "/") },
          { label: lib.scores, href: localizedPath(locale, pagePaths.scores) },
          { label: cat.name[locale] },
        ]}
      />
      <h1 className="mt-5 text-2xl font-bold">{cat.name[locale]}</h1>
      <p className="mt-2 text-[15px] leading-[1.9]">{cat.intro[locale]}</p>
      {/* Google AdSense（1 枠）。ページ下部の広告・アフィリエイト枠と並ばないよう、作品一覧の前に置く */}
      <AdSenseSlot unit="category-before-list" t={lib.adsense} />
      <p className="mt-4 text-xs text-muted">{lib.category.works(cat.works.length)}</p>
      <div className="mt-2">
        <WorkList works={cat.works} locale={locale} />
      </div>
      <AffiliateSlot placement="category" t={lib.ad} />
      <JsonLd data={ld} />
    </Container>
  );
}
