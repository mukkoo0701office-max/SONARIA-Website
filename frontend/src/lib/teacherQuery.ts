import {
  audiences,
  instrumentCategories,
  lessonFormats,
  type Audience,
  type InstrumentCategory,
  type LessonFormat,
} from "@/data/teachers";
import { prefectures } from "@/data/prefectures";

// 講師検索の条件と URL クエリの相互変換。トップの簡易検索と講師検索ページで共通に使う。
// 個人情報は URL に入れない（仕様 §4）。

export type GenderFilter = "any" | "female" | "male";
export type TeacherSort = "name" | "area";

export type TeacherFilters = {
  q: string;
  category: "all" | InstrumentCategory;
  pref: string; // "all" または都道府県コード
  formats: LessonFormat[]; // 選んだ形態すべてに対応する講師を表示
  gender: GenderFilter;
  audiences: Audience[]; // 選んだ対象すべてに対応する講師を表示
  sort: TeacherSort;
  page: number;
};

export const initialTeacherFilters: TeacherFilters = {
  q: "",
  category: "all",
  pref: "all",
  formats: [],
  gender: "any",
  audiences: [],
  sort: "name",
  page: 1,
};

const genderValues: readonly GenderFilter[] = ["any", "female", "male"];
const sortValues: readonly TeacherSort[] = ["name", "area"];

function pickOne<T extends string>(value: string | null, allowed: readonly T[], fallback: T): T {
  return value !== null && (allowed as readonly string[]).includes(value) ? (value as T) : fallback;
}

function pickMany<T extends string>(value: string | null, allowed: readonly T[]): T[] {
  if (!value) return [];
  const set = new Set(value.split(","));
  return allowed.filter((v) => set.has(v));
}

export function teacherFiltersFromSearch(search: string): TeacherFilters {
  const params = new URLSearchParams(search);
  const pref = params.get("pref");
  const page = Number(params.get("page"));
  return {
    q: params.get("q") ?? "",
    category: pickOne<"all" | InstrumentCategory>(params.get("category"), ["all", ...instrumentCategories], "all"),
    pref: pref && prefectures.some((p) => p.code === pref) ? pref : "all",
    formats: pickMany(params.get("formats"), lessonFormats),
    gender: pickOne(params.get("gender"), genderValues, "any"),
    audiences: pickMany(params.get("audiences"), audiences),
    sort: pickOne(params.get("sort"), sortValues, "name"),
    page: Number.isInteger(page) && page > 0 ? page : 1,
  };
}

// 初期値と同じ項目はクエリに書かない
export function buildTeacherQuery(partial: Partial<TeacherFilters>): string {
  const filters = { ...initialTeacherFilters, ...partial };
  const params = new URLSearchParams();
  if (filters.q) params.set("q", filters.q);
  if (filters.category !== "all") params.set("category", filters.category);
  if (filters.pref !== "all") params.set("pref", filters.pref);
  if (filters.formats.length) params.set("formats", filters.formats.join(","));
  if (filters.gender !== "any") params.set("gender", filters.gender);
  if (filters.audiences.length) params.set("audiences", filters.audiences.join(","));
  if (filters.sort !== "name") params.set("sort", filters.sort);
  if (filters.page !== 1) params.set("page", String(filters.page));
  const query = params.toString();
  return query ? `?${query}` : "";
}
