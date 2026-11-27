import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import Container from "@/components/layout/Container";
import AdSenseSlot from "@/components/ads/AdSenseSlot";
import AffiliateSlot from "@/components/library/AffiliateSlot";
import WorkList from "@/components/library/WorkList";
import Breadcrumbs from "@/components/seo/Breadcrumbs";
import JsonLd from "@/components/seo/JsonLd";
import { getDictionary } from "@/data/dictionaries";
import { composerLocales, getComposer, isSampleCatalog, publishedComposers, worksByComposer } from "@/data/scores/catalog";
import { libraryPaths } from "@/data/scores/paths";
import type { Composer } from "@/data/scores/types";
import { isLocale, localizedPath, type Locale } from "@/lib/i18n";
import { withBasePath } from "@/lib/paths";
import { absoluteUrl, pageMetadata } from "@/lib/seo";

// 作曲家ページ。作曲家マスター（composers.json）のうち、収録作品がある作曲家だけを自動で静的生成する。
// 英語のプロフィールが無い作曲家は英語ページを作らない。確認できない項目は表示しない。

type Params = { locale: string; composerId: string };
type Props = { params: Promise<Params> };

export const dynamicParams = false;
const NONE = "_none";

export function generateStaticParams({ params }: { params: { locale: string } }): { composerId: string }[] {
  if (!isLocale(params.locale)) return [{ composerId: NONE }];
  const locale = params.locale;
  const list = publishedComposers.filter((c) => composerLocales(c).includes(locale)).map((c) => ({ composerId: c.id }));
  return list.length > 0 ? list : [{ composerId: NONE }];
}

function load(p: Params): { locale: Locale; composer: Composer } | null {
  if (!isLocale(p.locale)) return null;
  const composer = getComposer(p.composerId);
  if (!composer || !publishedComposers.includes(composer) || !composerLocales(composer).includes(p.locale)) return null;
  return { locale: p.locale, composer };
}

function lifespan(c: Composer): string | null {
  if (!c.born && !c.died) return null;
  return `${c.born ?? "?"} – ${c.died ?? ""}`.trim();
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const loaded = load(await params);
  if (!loaded) return {};
  const { locale, composer: c } = loaded;
  const t = getDictionary(locale).library.composer;
  return pageMetadata({
    locale,
    path: libraryPaths.composer(c.id),
    title: t.metaTitle(c.name[locale]),
    description: t.metaDescription(c.name[locale], worksByComposer(c.id).length),
    availableLocales: composerLocales(c),
    type: "profile",
    image: c.portrait ? { url: c.portrait.file, width: c.portrait.width, height: c.portrait.height, alt: c.portrait.alt[locale] } : null,
  });
}

export default async function ComposerPage({ params }: Props) {
  const loaded = load(await params);
  if (!loaded) notFound();
  const { locale, composer: c } = loaded;
  const lib = getDictionary(locale).library;
  const t = lib.composer;
  const profile = c.profile?.[locale];
  const list = worksByComposer(c.id);
  const related = (c.related ?? []).map((id) => publishedComposers.find((p) => p.id === id)).filter((p): p is Composer => Boolean(p));
  const span = lifespan(c);
  const pageUrl = absoluteUrl(localizedPath(locale, libraryPaths.composer(c.id)));

  const ld = {
    "@context": "https://schema.org",
    "@type": "Person",
    name: c.name.original,
    alternateName: [c.name.ja, c.name.en, ...(c.aliases ?? [])].filter((n, i, a) => n !== c.name.original && a.indexOf(n) === i),
    ...(pageUrl ? { url: pageUrl } : {}),
    ...(c.born ? { birthDate: c.born } : {}),
    ...(c.died ? { deathDate: c.died } : {}),
    ...(c.nationality ? { nationality: c.nationality[locale] } : {}),
    ...(c.portrait && absoluteUrl(c.portrait.file) ? { image: absoluteUrl(c.portrait.file) } : {}),
    ...(c.externalIds?.wikidata ? { sameAs: [`https://www.wikidata.org/wiki/${c.externalIds.wikidata}`] } : {}),
  };

  return (
    <Container className="pb-12">
      <Breadcrumbs
        label={lib.breadcrumb}
        items={[
          { label: lib.home, href: localizedPath(locale, "/") },
          { label: lib.composers, href: localizedPath(locale, libraryPaths.composers) },
          { label: c.name[locale] },
        ]}
      />
      {isSampleCatalog && <p className="mt-4 rounded-card border border-line bg-subtle p-3 text-xs">{lib.sampleNotice}</p>}

      <header className="mt-5 flex items-start gap-4">
        {c.portrait && (
          <figure className="w-28 flex-none">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={withBasePath(c.portrait.file)}
              width={c.portrait.width}
              height={c.portrait.height}
              alt={c.portrait.alt[locale]}
              className="aspect-[3/4] w-full rounded border border-line bg-card object-cover"
            />
          </figure>
        )}
        <div>
          <h1 className="text-2xl font-bold leading-snug">{c.name[locale]}</h1>
          {c.name.original !== c.name[locale] && <p className="mt-1 text-sm text-muted">{c.name.original}</p>}
          <dl className="mt-3 grid gap-1 text-[13px]">
            {span && (
              <div>
                <dt className="inline text-muted">{t.lifespan}: </dt>
                <dd className="inline">{span}</dd>
              </div>
            )}
            {c.nationality && (
              <div>
                <dt className="inline text-muted">{t.nationality}: </dt>
                <dd className="inline">{c.nationality[locale]}</dd>
              </div>
            )}
          </dl>
        </div>
      </header>

      {profile?.position && <Prose id="position" title={t.position} body={profile.position} />}
      {profile?.life && <Prose id="life" title={t.life} body={profile.life} />}
      {profile?.style && <Prose id="style" title={t.style} body={profile.style} />}

      {c.notableWorks && c.notableWorks.length > 0 && (
        <section aria-labelledby="notable" className="mt-8">
          <h2 id="notable" className="text-lg font-bold">
            {t.notableWorks}
          </h2>
          <ul className="mt-2 grid gap-0.5 text-[14px]">
            {c.notableWorks.map((w) => (
              <li key={w.ja}>・{w[locale]}</li>
            ))}
          </ul>
        </section>
      )}

      <section aria-labelledby="works" className="mt-8">
        <h2 id="works" className="mb-3 text-lg font-bold">
          {t.worksInLibrary(list.length)}
        </h2>
        <WorkList works={list} locale={locale} showComposer={false} />
      </section>

      {/* Google AdSense（1 枠）。作品一覧の後、ページ下部の広告・アフィリエイト枠とは関連作曲家・出典を挟んで分ける */}
      <AdSenseSlot unit="composer-after-works" t={lib.adsense} />

      {related.length > 0 && (
        <section aria-labelledby="related" className="mt-8">
          <h2 id="related" className="text-lg font-bold">
            {t.related}
          </h2>
          <ul className="mt-2 flex flex-wrap gap-2">
            {related.map((r) => (
              <li key={r.id}>
                <Link href={localizedPath(composerLocales(r).includes(locale) ? locale : "ja", libraryPaths.composer(r.id))} className="inline-block rounded-full border border-line bg-card px-3 py-1.5 text-[13px] hover:border-navy">
                  {r.name[locale]}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {(c.sources?.length || c.portrait) && (
        <section aria-labelledby="sources" className="mt-8 text-xs text-muted">
          {c.sources && c.sources.length > 0 && (
            <>
              <h2 id="sources" className="text-sm font-bold text-ink">
                {t.sources}
              </h2>
              <ul className="mt-1 grid gap-0.5">
                {c.sources.map((s) => (
                  <li key={s.label}>{s.url ? <a href={s.url} target="_blank" rel="noopener" className="underline">{s.label}</a> : s.label}</li>
                ))}
              </ul>
            </>
          )}
          {c.portrait && (
            <p className="mt-2">
              {t.portraitCredit}:{" "}
              <a href={c.portrait.source} target="_blank" rel="noopener" className="underline">
                {c.portrait.author ?? c.portrait.source}
              </a>{" "}
              ({c.portrait.license})
            </p>
          )}
        </section>
      )}

      <AffiliateSlot placement="composer" t={lib.ad} />
      <JsonLd data={ld} />
    </Container>
  );
}

function Prose({ id, title, body }: { id: string; title: string; body: string }) {
  return (
    <section aria-labelledby={id} className="mt-8">
      <h2 id={id} className="text-lg font-bold">
        {title}
      </h2>
      {body.split(/\n{2,}/).map((p, i) => (
        <p key={i} className="mt-2 text-[15px] leading-[1.9]">
          {p}
        </p>
      ))}
    </section>
  );
}
