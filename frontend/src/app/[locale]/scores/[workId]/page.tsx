import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import Container from "@/components/layout/Container";
import AffiliateSlot from "@/components/library/AffiliateSlot";
import AmazonRelated from "@/components/library/AmazonRelated";
import AmazonSearchBanner from "@/components/library/AmazonSearchBanner";
import { amazonItemsFor } from "@/data/affiliate/amazon";
import BowingBanner from "@/components/library/BowingBanner";
import PdfFile from "@/components/library/PdfFile";
import WorkList from "@/components/library/WorkList";
import Breadcrumbs from "@/components/seo/Breadcrumbs";
import JsonLd from "@/components/seo/JsonLd";
import { getDictionary } from "@/data/dictionaries";
import { catalogLabel, composerLocales, usesRemotePdf, composerOf, getWork, isSampleCatalog, partOrder, relatedWorks, workLocales, worksForLocale } from "@/data/scores/catalog";
import type { Work } from "@/data/scores/types";
import { pagePaths } from "@/data/site";
import { isLocale, localizedPath, type Locale } from "@/lib/i18n";
import { withBasePath } from "@/lib/paths";
import { absoluteUrl, pageMetadata } from "@/lib/seo";

// 作品詳細ページ。catalog.json の公開済み作品（承認済みの版があるもの）から自動で静的生成する。
// 英語の解説が無い作品は英語ページを作らない。確認できない項目は表示しない（推測で埋めない）。

type Params = { locale: string; workId: string };
type Props = { params: Promise<Params> };

// 静的書き出しでは生成した URL 以外は 404
export const dynamicParams = false;

// 公開作品が 0 件のときも書き出しが失敗しないよう、表示しない仮の ID を 1 つ返す（ページ側で 404 にする）
const NONE = "_none";

export function generateStaticParams({ params }: { params: { locale: string } }): { workId: string }[] {
  if (!isLocale(params.locale)) return [{ workId: NONE }];
  const list = worksForLocale(params.locale).map((w) => ({ workId: w.id }));
  return list.length > 0 ? list : [{ workId: NONE }];
}

function load(p: Params): { locale: Locale; work: Work } | null {
  if (!isLocale(p.locale)) return null;
  const work = getWork(p.workId);
  if (!work || !workLocales(work).includes(p.locale)) return null;
  return { locale: p.locale, work };
}

function partLabel(t: ReturnType<typeof getDictionary>["library"], locale: Locale, a: Work["editions"][number]["assets"][number]): string {
  const base = a.part === "other" && a.label ? a.label[locale] : t.parts[a.part];
  return a.part !== "other" && a.label ? `${base}（${a.label[locale]}）` : base;
}

function instrumentation(t: ReturnType<typeof getDictionary>["library"], w: Work): string {
  return t.scoring[w.scoring];
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const loaded = load(await params);
  if (!loaded) return {};
  const { locale, work } = loaded;
  const t = getDictionary(locale).library;
  const c = composerOf(work);
  const assets = work.editions.flatMap((e) => e.assets);
  const parts = [...new Set(assets.map((a) => t.parts[a.part]))].join(locale === "ja" ? "・" : ", ");
  const preview = assets.find((a) => a.preview)?.preview;
  return pageMetadata({
    locale,
    path: `/scores/${work.id}/`,
    title: t.work.metaTitle((c.short ?? c.name)[locale], work.title[locale], catalogLabel(work)),
    description: t.work.metaDescription(c.name[locale], work.title[locale], catalogLabel(work), parts),
    availableLocales: workLocales(work),
    type: "article",
    image: preview ? { url: preview.file, width: preview.width, height: preview.height, alt: t.work.previewAlt(work.title[locale]) } : null,
  });
}

export default async function WorkPage({ params }: Props) {
  const loaded = load(await params);
  if (!loaded) notFound();
  const { locale, work } = loaded;
  const dict = getDictionary(locale);
  const t = dict.library;
  const tw = t.work;
  const c = composerOf(work);
  const text = work.text?.[locale];
  const composerPage = localizedPath(composerLocales(c).includes(locale) ? locale : "ja", `/composers/${c.id}/`);
  const assets = work.editions.flatMap((e) => e.assets);
  const fileCount = assets.length;
  const partNames = [...new Set(assets.filter((a) => a.part !== "score").sort((a, b) => partOrder.indexOf(a.part) - partOrder.indexOf(b.part)).map((a) => partLabel(t, locale, a)))];
  const sep = locale === "ja" ? "、" : ", ";
  const related = relatedWorks(work);
  const amazonItems = amazonItemsFor(work.id);
  const catalogText = catalogLabel(work);
  const pageUrl = absoluteUrl(localizedPath(locale, `/scores/${work.id}/`));

  // 「この楽譜について」: 収録内容・演奏人数・印刷量・楽章など、データから確実に言える実用情報を質問と回答の形で示す
  const sortedAssets = [...assets].sort((a, b) => partOrder.indexOf(a.part) - partOrder.indexOf(b.part));
  const scoreAssets = sortedAssets.filter((a) => a.part === "score");
  const partAssets = sortedAssets.filter((a) => a.part !== "score");
  const scoreText = scoreAssets.length ? scoreAssets.map((a) => (scoreAssets.length > 1 ? tw.partItem(partLabel(t, locale, a), a.pages) : tw.scoreItem(a.pages))).join(sep) : null;
  const partsText = partAssets.map((a) => tw.partItem(partLabel(t, locale, a), a.pages));
  const totalPages = assets.reduce((n, a) => n + a.pages, 0);
  // 1 人分の目安: 合奏・室内楽で、パートごとに 1 ファイルずつある場合だけ示す（曲集・複数版は人によって違うため出さない）
  const perPlayerParts = partAssets.filter((a) => !a.label);
  const perPlayer =
    perPlayerParts.length >= 2 && perPlayerParts.length === partAssets.length && new Set(perPlayerParts.map((a) => a.part)).size === perPlayerParts.length
      ? perPlayerParts.map((a) => tw.perPlayer(t.parts[a.part], a.pages)).join(sep)
      : null;
  const soloAsset = partAssets.find((a) => a.part === "solo" || a.part === "violin" || a.part === "cello" || a.part === "viola");
  const playersAnswer =
    work.scoring === "solo-orchestra"
      ? partAssets.some((a) => a.part === "piano") && soloAsset
        ? tw.soloWithPiano(t.instruments[work.instruments.find((i) => i !== "piano") ?? "violin"] ?? t.parts.solo)
        : tw.soloWithEnsemble
      : tw.playersByScoring[work.scoring];
  const faq: { q: string; a: string }[] = [
    { q: tw.qContents, a: tw.aContents(scoreText, partsText) },
    ...(playersAnswer ? [{ q: tw.qPlayers, a: playersAnswer }] : []),
    { q: tw.qPrint, a: tw.aPrint(totalPages, assets.length, perPlayer) },
    ...(work.movements && work.movements.length > 1 ? [{ q: tw.qMovements, a: tw.aMovements(work.movements.length, work.movements.map((m) => m[locale]).join(sep)) }] : []),
    { q: tw.qFree, a: tw.aFree(work.title[locale], fileCount, work.editions.every((e) => e.rights.status === "approved")) },
  ];

  const ld = {
    "@context": "https://schema.org",
    "@type": "MusicComposition",
    name: work.title[locale],
    ...(work.title.original ? { alternateName: [work.title.original, ...(work.aliases ?? [])] } : work.aliases?.length ? { alternateName: work.aliases } : {}),
    ...(pageUrl ? { url: pageUrl } : {}),
    inLanguage: locale,
    composer: {
      "@type": "Person",
      name: c.name.original,
      alternateName: [c.name.ja, c.name.en].filter((n) => n !== c.name.original),
      ...(c.born ? { birthDate: c.born } : {}),
      ...(c.died ? { deathDate: c.died } : {}),
    },
    ...(catalogText ? { musicCompositionForm: t.genre[work.genre], identifier: catalogText } : { musicCompositionForm: t.genre[work.genre] }),
    ...(work.key ? { musicalKey: work.key[locale] } : {}),
    ...(work.composed ? { dateCreated: work.composed } : {}),
    dateModified: work.updatedAt,
    workExample: work.editions.flatMap((e) =>
      e.assets.map((a) => {
        const fileUrl = absoluteUrl(a.file);
        return {
          "@type": "SheetMusic",
          name: `${work.title[locale]} – ${partLabel(t, locale, a)}`,
          encodingFormat: "application/pdf",
          isAccessibleForFree: true,
          ...(fileUrl ? { url: fileUrl } : {}),
          ...(e.publisher ? { publisher: { "@type": "Organization", name: e.publisher } } : {}),
          ...(e.rights.license ? { license: e.rights.license } : {}),
        };
      }),
    ),
  };

  return (
    <Container className="pb-12">
      <Breadcrumbs
        label={t.breadcrumb}
        items={[
          { label: t.home, href: localizedPath(locale, "/") },
          { label: t.scores, href: localizedPath(locale, pagePaths.scores) },
          { label: (c.short ?? c.name)[locale], href: composerPage },
          { label: work.title[locale] },
        ]}
      />
      {isSampleCatalog && <p className="mt-4 rounded-card border border-line bg-subtle p-3 text-xs">{t.sampleNotice}</p>}

      <header className="mt-5">
        <h1 className="text-2xl font-bold leading-snug">
          {work.title[locale]}
          {catalogText && <span className="ml-2 text-lg font-semibold text-muted">{catalogText}</span>}
        </h1>
        {work.title.original && work.title.original !== work.title[locale] && <p className="mt-1 text-sm text-muted" lang="und">{work.title.original}</p>}
        <p className="mt-2 flex items-center gap-2 text-sm">
          {c.portrait && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={withBasePath(c.portrait.file)} width={36} height={48} alt={c.portrait.alt[locale]} className="aspect-[3/4] w-9 rounded border border-line object-cover" />
          )}
          <Link href={composerPage} className="text-navy underline">
            {c.name[locale]}
          </Link>
          {c.name.original !== c.name[locale] && <span className="ml-2 text-muted">{c.name.original}</span>}
        </p>
      </header>

      <section aria-labelledby="facts" className="mt-6">
        <h2 id="facts" className="sr-only">
          {tw.facts}
        </h2>
        <dl className="grid gap-2.5 rounded-card border border-line bg-card p-[17px] text-[13px]">
          <Fact term={tw.composer}>{c.name[locale]}</Fact>
          {catalogText && <Fact term={tw.catalogNumber}>{catalogText}</Fact>}
          {work.key && <Fact term={tw.key}>{work.key[locale]}</Fact>}
          {work.composed && <Fact term={tw.composed}>{work.composed}</Fact>}
          <Fact term={tw.instrumentation}>{instrumentation(t, work)}</Fact>
          {work.movements && work.movements.length > 0 && (
            <Fact term={tw.movements}>
              <ol className="grid gap-0.5">
                {work.movements.map((m, i) => (
                  <li key={i}>{m[locale]}</li>
                ))}
              </ol>
            </Fact>
          )}
          {work.duration && (
            <Fact term={tw.duration}>
              {tw.durationValue(work.duration.minutes)}
              <span className="ml-2 text-xs text-muted">（{work.duration.source.label}）</span>
            </Fact>
          )}
          {work.difficulty && <Fact term={tw.difficulty}>{tw.difficultyLevels[work.difficulty.level]}</Fact>}
        </dl>
      </section>

      <section aria-labelledby="scores" className="mt-8">
        <h2 id="scores" className="text-lg font-bold">
          {tw.scoresTitle}
        </h2>
        <p className="mt-1 text-xs text-muted">{usesRemotePdf ? tw.scoresLeadRemote : tw.scoresLead}</p>
        {work.editions.map((e) => (
          <div key={e.id} className="mt-4">
            <h3 className="text-[15px] font-bold">{e.label[locale]}</h3>
            {e.rights.status === "pending" && (
              <p className="mt-1.5 rounded-button border border-navy bg-subtle px-2.5 py-1.5 text-xs font-semibold text-navy">{tw.pendingRights}</p>
            )}
            <dl className="mt-1 grid gap-0.5 text-xs text-muted">
              {e.publisher && <Meta term={tw.publisher}>{e.publisher}</Meta>}
              {e.year && <Meta term={tw.year}>{e.year}</Meta>}
              {e.editor && <Meta term={tw.editor}>{e.editor}</Meta>}
              <Meta term={tw.source}>
                {e.source.url ? (
                  <a href={e.source.url} target="_blank" rel="noopener" className="underline">
                    {tw.sourceTypes[e.source.type]}
                  </a>
                ) : (
                  tw.sourceTypes[e.source.type]
                )}
                {e.source.note && <> – {e.source.note}</>}
              </Meta>
              {e.rights.license && <Meta term={tw.license}>{e.rights.license}</Meta>}
              {e.rights.status === "approved" && <Meta term={tw.rightsBasis}>{e.rights.basis}</Meta>}
            </dl>
            <ul className="mt-3 grid gap-2.5">
              {[...e.assets]
                .sort((a, b) => partOrder.indexOf(a.part) - partOrder.indexOf(b.part))
                .map((a) => (
                  <PdfFile key={a.id} label={partLabel(t, locale, a)} file={a.file} remote={usesRemotePdf ? a.remote : null} filename={a.filename} pages={a.pages} bytes={a.bytes} preview={a.preview} locale={locale} />
                ))}
            </ul>
          </div>
        ))}
        <BowingBanner
          locale={locale}
          t={t.bowing}
          context={{ title: work.title[locale], composer: c.name[locale], workId: work.id, parts: partNames, assets: assets.map((a) => a.id) }}
        />
      </section>

      <section aria-labelledby="faq" className="mt-8">
        <h2 id="faq" className="text-lg font-bold">
          {tw.faqTitle}
        </h2>
        <dl className="mt-3 grid gap-3 text-[14px]">
          {faq.map((f) => (
            <div key={f.q}>
              <dt className="font-semibold">{f.q}</dt>
              <dd className="mt-0.5">{f.a}</dd>
            </div>
          ))}
        </dl>
      </section>

      {text?.overview && <Prose id="overview" title={tw.overview} body={text.overview} />}
      {text?.features && <Prose id="features" title={tw.features} body={text.features} />}
      {text?.performanceTips && <Prose id="tips" title={tw.performanceTips} body={text.performanceTips} />}

      {work.videos && work.videos.length > 0 && (
        <section aria-labelledby="videos" className="mt-8">
          <h2 id="videos" className="text-lg font-bold">
            {tw.videos}
          </h2>
          <ul className="mt-2 grid gap-1 text-sm">
            {work.videos.map((v) => (
              <li key={v.url}>
                <a href={v.url} target="_blank" rel="noopener" className="text-navy underline">
                  {v.title}
                </a>
                {v.note && <span className="ml-2 text-xs text-muted">{v.note}</span>}
              </li>
            ))}
          </ul>
        </section>
      )}

      <section aria-labelledby="sources" className="mt-8 text-xs text-muted">
        {work.sources && work.sources.length > 0 && (
          <>
            <h2 id="sources" className="text-sm font-bold text-ink">
              {tw.sources}
            </h2>
            <ul className="mt-1 grid gap-0.5">
              {work.sources.map((s) => (
                <li key={s.label}>{s.url ? <a href={s.url} target="_blank" rel="noopener" className="underline">{s.label}</a> : s.label}</li>
              ))}
            </ul>
          </>
        )}
        <p className="mt-3">
          {tw.published}: <time dateTime={work.publishedAt}>{work.publishedAt}</time> ・ {tw.updated}: <time dateTime={work.updatedAt}>{work.updatedAt}</time>
        </p>
        {work.changelog && work.changelog.length > 0 && (
          <details className="mt-1">
            <summary className="cursor-pointer">{tw.changelog}</summary>
            <ul className="mt-1 grid gap-0.5">
              {work.changelog.map((ch) => (
                <li key={ch.date + ch.note}>
                  <time dateTime={ch.date}>{ch.date}</time> {ch.note}
                </li>
              ))}
            </ul>
          </details>
        )}
      </section>

      <section aria-labelledby="report" className="mt-8 rounded-card border border-line bg-card p-[17px]">
        <h2 id="report" className="text-[15px] font-bold">
          {tw.reportTitle}
        </h2>
        <p className="mt-1 text-[13px]">{tw.reportLead}</p>
        {/* TODO: 問い合わせ窓口（送信機能）が決まったら、作品 ID を引き継いだ報告フォームにする */}
        <Link href={`${localizedPath(locale, pagePaths.contact)}?topic=score-error&work=${encodeURIComponent(work.id)}`} className="mt-2 inline-block text-[13px] text-navy underline">
          {tw.reportCta}
        </Link>
      </section>


      {related.length > 0 && (
        <section aria-labelledby="related" className="mt-8">
          <h2 id="related" className="mb-3 text-lg font-bold">
            {tw.related}
          </h2>
          <WorkList works={related} locale={locale} />
        </section>
      )}

      {/* Amazon の広告枠はページ最下部の 1 枠だけ（運営者の指示 2026-11-27。本文途中の検索ウィジェットは撤去）。
          中身は 確認済みの商品（amazon.json。approved_for_implementation のみ）→ 作品ごとのリンク → 作曲家の楽譜を探すバナー の順で 1 つ */}
      {amazonItems.length > 0 ? (
        <AmazonRelated items={amazonItems} locale={locale} t={t.ad} />
      ) : work.affiliate && work.affiliate.length > 0 ? (
        <AffiliateSlot placement="work" t={t.ad} links={work.affiliate} />
      ) : (
        <AmazonSearchBanner t={t.ad} s={t.amazonSearch} composer={(c.short ?? c.name)[locale]} keyword={t.amazonSearch.bannerKeyword((c.short ?? c.name)[locale])} />
      )}

      <JsonLd data={ld} />
    </Container>
  );
}

function Fact({ term, children }: { term: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-3">
      <dt className="w-32 flex-none text-muted">{term}</dt>
      <dd className="min-w-0 flex-1">{children}</dd>
    </div>
  );
}

function Meta({ term, children }: { term: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="inline">{term}: </dt>
      <dd className="inline">{children}</dd>
    </div>
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
