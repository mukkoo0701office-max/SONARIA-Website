import rawCatalog from "./catalog.json";
import rawWorkTexts from "./workTexts.json";
import { sheetTypeOf } from "@/lib/scores/sheetType";
import rawComposers from "./composers.json";
import rawPortraits from "./portraits.json";
import { categoryDefs, MIN_CATEGORY_WORKS, type CategoryDef } from "./categories";
import type { Catalog, Composer, Era, Part, Scoring, Work } from "./types";
import { genres, instruments, type Formation, type Genre as SearchGenre, type Instrument, type WorkSummary } from "@/data/works";
import type { Locale } from "@/lib/i18n";

// 楽譜カタログの読み出し。ページはすべてここから自動生成する（作品ごとにページを手で作らない）。
//
// 重要: rights.status が "approved" または "pending"（運営者の決定 2026-11-28）で、ファイルが 1 つ以上ある版だけを公開する。
// それ以外（権利に問題があると判断した版）は画面・sitemap・構造化データのどこにも出さない。
// approved への変更の記録は tools/score-migration/approvals.json。

type DemoData = { composers: Composer[]; works: Work[] };

const catalog = rawCatalog as Catalog;
const composerMaster = rawComposers as Composer[];

// 仮: 公開できる作品がまだ無いあいだ、プレビュー（GitHub Pages）だけで表示確認用のサンプルを使う。
// 本番ビルドでは NEXT_PUBLIC_PREVIEW が "0" の定数になり、サンプルはバンドルに含まれない。
const demo: DemoData | null =
  process.env.NEXT_PUBLIC_PREVIEW === "1" && catalog.works.length === 0
    ? // eslint-disable-next-line @typescript-eslint/no-require-imports
      (require("./demo") as { demoData: DemoData }).demoData
    : null;

/** プレビューでは PDF 本体をリリースの添付ファイルから取得する（PDF はサイトの書き出しに含めない） */
// PDF は GitHub のリリースの添付ファイルから配信する（運営者の決定 2026-11-28「当面は GitHub のまま、アクセスが増える前に Cloudflare R2 へ」）。
// 本番もプレビューも同じ。R2 へ移すときは remote の URL を差し替える
export const usesRemotePdf = true;

/** 表示確認用のサンプルを表示しているか（画面に明記する） */
export const isSampleCatalog = demo !== null;

const ID_RE = /^[a-z0-9][a-z0-9-]{1,80}$/;
// /scores/category/ と作品ページの URL がぶつからないよう、作品 ID に使えない語
const RESERVED_IDS = new Set(["category", "composers", "work"]);

// 肖像画（運営者が用意した画像）。frontend/public/composers/<作曲家ID>.<拡張子> に置き、portraits.json に出典・ライセンスを書く。
// 出典とライセンスの無い画像は表示しない（記録を必須にする）
type PortraitEntry = { id: string; file: string; source: string; license: string; author?: string };
const portraitById = new Map((rawPortraits as PortraitEntry[]).filter((p) => p.source && p.license).map((p) => [p.id, p]));

const allComposers: Composer[] = (demo ? demo.composers : composerMaster).map((c) => {
  const p = portraitById.get(c.id);
  if (!p) return c;
  return {
    ...c,
    portrait: {
      file: p.file,
      // 実際の縦横比は画像ごとに違うため、表示側で 3:4 の枠に収める（レイアウトのずれを防ぐ）
      width: 300,
      height: 400,
      alt: { ja: `${c.name.ja}の肖像`, en: `Portrait of ${c.name.en}` },
      source: p.source,
      license: p.license,
      ...(p.author ? { author: p.author } : {}),
    },
  };
});
const composerById = new Map(allComposers.map((c) => [c.id, c]));

// 表示する版の権利の状態。
// 運営者の決定（2026-11-28）: 権利確認前（pending）の版も本番で公開する。本番では「権利確認前」の表示もしない（プレビューだけ運営者向けに表示）。
// 権利に問題がある（rejected など）と判断した版は表示しない。docs/decisions/0004-launch-decisions-20261128.md
const visibleStatuses: ReadonlySet<string> = new Set(["approved", "pending"]);

// 作品の概要・原語名・通称（workTexts.json）を重ねる。catalog.json（移行ツールが生成）とは別に管理する
type WorkTextEntry = { original?: string; aliases?: string[]; summary?: { ja: string; en: string } };
const workTexts = (rawWorkTexts as { works: Record<string, WorkTextEntry> }).works;
function withTexts(w: Work): Work {
  const x = workTexts[w.id];
  if (!x) return w;
  return {
    ...w,
    title: { ...w.title, original: x.original ?? w.title.original ?? null },
    aliases: [...new Set([...(w.aliases ?? []), ...(x.aliases ?? [])])],
    summary: x.summary ?? w.summary ?? null,
  };
}

// 表示してよい版・ファイルだけを残した作品一覧（該当する版が 1 つもない作品は除く）
export const works: Work[] = (demo ? demo.works : catalog.works)
  .map((w) => withTexts(w as Work))
  .map((w) => ({ ...w, editions: w.editions.filter((e) => visibleStatuses.has(e.rights.status) && e.assets.length > 0) }))
  .filter((w) => w.editions.length > 0)
  .sort((a, b) => a.id.localeCompare(b.id));

// データの誤りはビルドを止めて知らせる（壊れたリンク・存在しない作曲家を公開しない）
for (const w of works) {
  if (!ID_RE.test(w.id) || RESERVED_IDS.has(w.id)) throw new Error(`作品 ID が不正です: ${w.id}`);
  if (!composerById.has(w.composerId)) throw new Error(`作曲家マスターに無い composerId です: ${w.composerId}（作品 ${w.id}）`);
}
if (new Set(works.map((w) => w.id)).size !== works.length) throw new Error("作品 ID が重複しています");

const workById = new Map(works.map((w) => [w.id, w]));

export function getWork(id: string): Work | undefined {
  return workById.get(id);
}

export function getComposer(id: string): Composer | undefined {
  return composerById.get(id);
}

export function composerOf(w: Work): Composer {
  return composerById.get(w.composerId)!;
}

/** 収録作品が 1 つ以上ある作曲家だけ（作品の無い作曲家ページは作らない） */
export const publishedComposers: Composer[] = allComposers
  .filter((c) => works.some((w) => w.composerId === c.id))
  .sort((a, b) => a.name.en.localeCompare(b.name.en));

export function worksByComposer(composerId: string): Work[] {
  return works.filter((w) => w.composerId === composerId);
}

// ---- 言語ごとのページの有無 ------------------------------------------------
// 英語の解説が無い作品・英語のプロフィールが無い作曲家には英語ページを作らない（存在しない URL を出さない）

export function workLocales(w: Work): Locale[] {
  return w.text?.en ? ["ja", "en"] : ["ja"];
}

export function composerLocales(c: Composer): Locale[] {
  return c.profile?.en ? ["ja", "en"] : ["ja"];
}

export function worksForLocale(locale: Locale): Work[] {
  return works.filter((w) => workLocales(w).includes(locale));
}

// ---- カテゴリ（編成別・曲種別） ---------------------------------------------

/** 作品数が足りないカテゴリと、ほかのカテゴリと中身が同じになるカテゴリは作らない */
export const categories: (CategoryDef & { works: Work[] })[] = (() => {
  const out: (CategoryDef & { works: Work[] })[] = [];
  const seen = new Set<string>();
  for (const def of categoryDefs) {
    const list = works.filter(def.match);
    if (list.length < MIN_CATEGORY_WORKS) continue;
    const key = list.map((w) => w.id).join(",");
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ ...def, works: list });
  }
  return out;
})();

/** カテゴリページがある言語。英語ページは、英語ページのある作品が MIN_CATEGORY_WORKS 件以上あるときだけ */
export function categoryLocales(id: string): Locale[] {
  const cat = categories.find((c) => c.id === id);
  if (!cat) return [];
  return cat.works.filter((w) => workLocales(w).includes("en")).length >= MIN_CATEGORY_WORKS ? ["ja", "en"] : ["ja"];
}

export function getCategory(id: string) {
  return categories.find((c) => c.id === id);
}

export function categoriesOf(w: Work) {
  return categories.filter((c) => c.works.includes(w));
}

// ---- 関連楽譜・新着・おすすめ ---------------------------------------------

/** 同じ作曲家・同じ編成・同じ曲種・同じ時代・近い難易度の順に、実在する収録作品だけを選ぶ */
export function relatedWorks(w: Work, limit = 6): Work[] {
  return works
    .filter((o) => o.id !== w.id)
    .map((o) => {
      let score = 0;
      if (o.composerId === w.composerId) score += 4;
      if (o.scoring === w.scoring) score += 3;
      if (o.genre === w.genre) score += 2;
      if (o.era === w.era) score += 1;
      if (o.difficulty && w.difficulty && Math.abs(o.difficulty.level - w.difficulty.level) <= 1) score += 1;
      return { o, score };
    })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score || a.o.id.localeCompare(b.o.id))
    .slice(0, limit)
    .map((x) => x.o);
}

export function newestWorks(limit = 6): Work[] {
  return [...works].sort((a, b) => b.publishedAt.localeCompare(a.publishedAt) || a.id.localeCompare(b.id)).slice(0, limit);
}

export const featuredWorks: Work[] = works.filter((w) => w.featured);

// ---- 表示用のまとめ -----------------------------------------------------

export const partOrder: Part[] = ["score", "solo", "violin", "violin1", "violin2", "viola", "cello", "bass", "piano", "other"];

export function catalogLabel(w: Work): string {
  const prefix: Record<string, string> = { op: "Op.", bwv: "BWV ", k: "K.", rv: "RV ", hob: "Hob.", d: "D.", woo: "WoO ", other: "" };
  return (w.catalog ?? []).map((c) => `${prefix[c.type]}${c.value}`).join(", ");
}

// カタログの scoring → 検索の「編成」
const formationOfScoring: Record<Scoring, Formation> = {
  violin: "solo-string",
  viola: "solo-string",
  cello: "solo-string",
  piano: "piano",
  "violin-piano": "violin-piano",
  "viola-piano": "viola-piano",
  "cello-piano": "cello-piano",
  "violin-duo": "string-duo",
  "string-duo": "string-duo",
  "string-trio": "string-trio",
  "piano-trio": "piano-trio",
  "string-quartet": "string-quartet",
  "piano-quartet": "piano-quartet",
  "string-quintet": "quintet",
  "piano-quintet": "quintet",
  "string-orchestra": "string-orchestra",
  "solo-orchestra": "solo-orchestra",
  other: "other",
};

/** 検索画面用の要約。数字は作品単位（PDF 数・パート数と混同しない） */
export function toSummary(w: Work, index: number): WorkSummary {
  const c = composerOf(w);
  return {
    id: index + 1,
    slug: w.id,
    hasEnglish: workLocales(w).includes("en"),
    title: { ja: w.title.ja, en: w.title.en },
    composer: { ja: c.name.ja, en: c.name.en },
    players: w.players,
    composerId: w.composerId,
    formation: formationOfScoring[w.scoring] ?? "other",
    instruments: (w.instruments ?? []).filter((i): i is Instrument => (instruments as readonly string[]).includes(i)),
    genre: (genres as readonly string[]).includes(w.genre) ? (w.genre as SearchGenre) : "other",
    era: w.era as Era,
    pdfCount: w.editions.reduce((n, e) => n + e.assets.length, 0),
    sheet: sheetTypeOf(w.editions.flatMap((e) => e.assets.map((a) => a.part))),
    // 日本語名・原語名・英語名・別名・作品番号のどれでも見つかるようにする
    searchText: [w.title.ja, w.title.en, w.title.original, ...(w.aliases ?? []), catalogLabel(w), c.name.ja, c.name.en, c.name.original, ...(c.aliases ?? [])]
      .filter(Boolean)
      .join(" "),
  };
}

export const workSummaries: WorkSummary[] = works.map(toSummary);
