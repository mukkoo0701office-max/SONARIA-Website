// 楽譜検索の絞り込み条件（トップページの簡易検索と楽譜検索ページで共通）。
// 同じ条件・同じデータで判定するため、トップで見えた件数と検索ページの件数が一致する（PR #24 §3）。
// URL のクエリ名: q / players / inst / fmt / genre / sheet / composer / era / sort / page

import { eras, formations, genres, instruments, type Era, type Formation, type Genre, type Instrument, type WorkSummary } from "@/data/works";
import { matchesPlayers, matchesSheet, playersFilters, sheetFilters, type PlayersFilter, type SheetFilter } from "@/lib/scores/sheetType";

export type SortKey = "title" | "composer" | "pdfCount";
export const sortValues: readonly SortKey[] = ["title", "composer", "pdfCount"];

export type ScoreFilters = {
  q: string;
  players: PlayersFilter;
  inst: "all" | Instrument;
  fmt: "all" | Formation;
  genre: "all" | Genre;
  sheet: SheetFilter;
  composer: string; // "all" または作曲家 ID
  era: "all" | Era;
  sort: SortKey;
  page: number;
};
export type FacetKey = "players" | "inst" | "fmt" | "genre" | "sheet" | "composer" | "era";

export const initialFilters: ScoreFilters = { q: "", players: "all", inst: "all", fmt: "all", genre: "all", sheet: "all", composer: "all", era: "all", sort: "title", page: 1 };

function pick<T extends string>(value: string | null, allowed: readonly T[], fallback: T): T {
  return value !== null && (allowed as readonly string[]).includes(value) ? (value as T) : fallback;
}

// URL のクエリから検索条件を復元する（共有・戻る操作のため）。不正な値は初期値に戻す。
// 旧形式のリンク（ensemble / form）も、対応する新しい条件に読み替える
export function filtersFromSearch(search: string): ScoreFilters {
  const params = new URLSearchParams(search);
  const page = Number(params.get("page"));
  const legacyFmt: Record<string, Formation> = { piano: "piano", orchestra: "solo-orchestra" };
  return {
    q: params.get("q") ?? "",
    players: pick<PlayersFilter>(params.get("players"), playersFilters, "all"),
    inst: pick<"all" | Instrument>(params.get("inst"), ["all", ...instruments], "all"),
    fmt: pick<"all" | Formation>(params.get("fmt") ?? legacyFmt[params.get("ensemble") ?? ""] ?? null, ["all", ...formations], "all"),
    genre: pick<"all" | Genre>(params.get("genre") ?? params.get("form"), ["all", ...genres], "all"),
    sheet: pick<SheetFilter>(params.get("sheet"), sheetFilters, "all"),
    composer: /^[a-z0-9-]{1,60}$/.test(params.get("composer") ?? "") ? (params.get("composer") as string) : "all",
    era: pick<"all" | Era>(params.get("era"), ["all", ...eras], "all"),
    sort: pick<SortKey>(params.get("sort"), sortValues, "title"),
    page: Number.isInteger(page) && page > 0 ? page : 1,
  };
}

// 初期値と同じ項目はクエリに書かない（URL を短く保つ）
export function filtersToSearch(filters: Partial<ScoreFilters>): string {
  const params = new URLSearchParams();
  for (const key of Object.keys(initialFilters) as (keyof ScoreFilters)[]) {
    const v = filters[key];
    if (v === undefined) continue;
    if (key === "q" ? String(v).trim() !== "" : v !== initialFilters[key]) params.set(key, key === "q" ? String(v).trim() : String(v));
  }
  const query = params.toString();
  return query ? `?${query}` : "";
}

/** キーワードと各絞り込みの AND 条件。skip に指定した絞り込みは無視する（選択肢ごとの件数を数えるため） */
export function matchesFilters(w: WorkSummary, f: ScoreFilters, skip?: FacetKey): boolean {
  const q = f.q.trim().toLocaleLowerCase();
  if (q) {
    const text = [w.title.ja, w.title.en, w.composer.ja, w.composer.en, w.searchText ?? ""].join(" ").toLocaleLowerCase();
    if (!text.includes(q)) return false;
  }
  if (skip !== "players" && !matchesPlayers(w.players, f.players)) return false;
  if (skip !== "inst" && f.inst !== "all" && !w.instruments.includes(f.inst)) return false;
  if (skip !== "fmt" && f.fmt !== "all" && w.formation !== f.fmt) return false;
  if (skip !== "genre" && f.genre !== "all" && w.genre !== f.genre) return false;
  if (skip !== "sheet" && !matchesSheet(w.sheet, f.sheet)) return false;
  if (skip !== "composer" && f.composer !== "all" && w.composerId !== f.composer) return false;
  if (skip !== "era" && f.era !== "all" && w.era !== f.era) return false;
  return true;
}

/** ある絞り込みの各選択肢の件数（その絞り込み以外の条件をすべて適用した件数） */
export function countBy(works: readonly WorkSummary[], f: ScoreFilters, facet: FacetKey, keyOf: (w: WorkSummary) => readonly string[]): Map<string, number> {
  const out = new Map<string, number>();
  for (const w of works) {
    if (!matchesFilters(w, f, facet)) continue;
    for (const k of keyOf(w)) out.set(k, (out.get(k) ?? 0) + 1);
  }
  return out;
}

/** 演奏人数の選択肢のキー（5 人以上は "5"） */
export const playersKey = (w: WorkSummary): readonly string[] => [String(Math.min(w.players, 5))];

/** 譜面の種類の選択肢のキー（両方ある作品はスコア・パート譜・両方ありのすべてに数える） */
export const sheetKeys = (w: WorkSummary): readonly string[] => (w.sheet === "both" ? ["score", "parts", "both"] : w.sheet ? [w.sheet] : []);
