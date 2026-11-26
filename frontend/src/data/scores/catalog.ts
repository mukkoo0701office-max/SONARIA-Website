import raw from "./catalog.json";
import type { Ensemble, Era, Localized, MusicalForm, WorkSummary } from "@/data/works";

// 楽譜カタログ（作品 → 版 → ファイル）。
// 仕様: docs/SONARIA_FREE_SCORE_LIBRARY_AND_CATALOG_v1.0.md、CLAUDE.md「楽譜ライブラリ」
//
// 重要: rights.status が "approved" の版だけを公開する。それ以外の版は画面に一切出さない。
// approved への変更は運営者の承認が必要（承認記録は tools/score-migration/approvals.json）。

export type RightsStatus = "approved" | "pending" | "rejected";

export type ScoreAsset = {
  id: string;
  label: Localized; // 例: スコア / Violin I / ピアノ伴奏
  file: string; // public/ からのパス（例: /scores/mozart-k136/score.pdf）
  sha256: string;
  pages: number;
  bytes: number;
};

export type Edition = {
  id: string;
  label: Localized; // 例: Breitkopf & Härtel（1882）
  source: { type: "imslp" | "own" | "other"; imslpFileId?: string | null; note?: string };
  rights: {
    status: RightsStatus;
    basis: string; // 承認の根拠（作曲者・校訂者の没年、出典のライセンスなど）
    approvedBy?: string;
    approvedAt?: string;
  };
  assets: ScoreAsset[];
  oldSiteUrl?: string; // 旧サイトでの掲載ページ（移行の追跡用）
};

export type CatalogWork = {
  id: string;
  title: Localized;
  composer: Localized & { deathYear?: number | null };
  opus?: string | null;
  players: number;
  ensemble: Ensemble;
  form: MusicalForm;
  era: Era;
  instruments: string[];
  publishedAt: string;
  editions: Edition[];
};

type Catalog = { version: number; generatedAt: string | null; works: CatalogWork[] };

const catalog = raw as Catalog;

// 公開してよい版・ファイルだけを残した作品一覧（承認済みの版が 1 つもない作品は除く）
export const publishedWorks: CatalogWork[] = catalog.works
  .map((w) => ({ ...w, editions: w.editions.filter((e) => e.rights.status === "approved" && e.assets.length > 0) }))
  .filter((w) => w.editions.length > 0);

export const hasPublishedWorks = publishedWorks.length > 0;

// 検索画面用の要約。数字は作品単位（PDF 数・パート数と混同しない）
export function toSummary(w: CatalogWork, index: number): WorkSummary {
  return {
    id: index + 1,
    slug: w.id,
    title: w.title,
    composer: { ja: w.composer.ja, en: w.composer.en },
    players: w.players,
    ensemble: w.ensemble,
    form: w.form,
    era: w.era,
    pdfCount: w.editions.reduce((n, e) => n + e.assets.length, 0),
  };
}

export function findPublishedWork(slug: string): CatalogWork | undefined {
  return publishedWorks.find((w) => w.id === slug);
}
