// 管理画面の配色（グラフ・状態）。色の値はここだけで管理する。
// グラフのカテゴリ色は 8 色の固定順（色覚の違いでも隣同士を見分けられることを検証済み。scripts は dataviz の validate_palette.js）。
// 白地とのコントラストが 3:1 に届かない色があるため、グラフには必ず凡例と「表で見る」を付ける。
// 文字色には使わない（文字は ink / muted）。サイトのゴールドは白地の文字に使わない（CLAUDE.md）

import type { CalendarEventKind, CaseStatus, RevenueCategory, TeacherApplicationStatus } from "./types";

export const chartPalette = ["#257de0", "#f47230", "#00b894", "#f2a600", "#ee7fac", "#008a17", "#6a4ce2", "#ec4647"] as const;

/** 1 系列のグラフはサイトのネイビー */
export const chartPrimary = "#182B45";
export const chartSecondary = "#257de0";
export const chartGrid = "#E5E0D6";
export const chartAxis = "#667085";

export const revenueColor: Record<RevenueCategory, string> = {
  adsense: chartPalette[0],
  amazon: chartPalette[1],
  recording: chartPalette[2],
  performance: chartPalette[3],
  lesson: chartPalette[4],
  donation: chartPalette[5],
  digital: chartPalette[6],
  other: chartPalette[7],
};

export const calendarColor: Record<CalendarEventKind, string> = {
  performance: chartPalette[3],
  lesson: chartPalette[4],
  recording: chartPalette[2],
  delivery_due: chartPalette[0],
  payment_due: chartPalette[6],
  other: "#667085",
};

// 状態のバッジ（色だけでなく文字で状態を示す。Tailwind のクラスは直書き）
export type Tone = "neutral" | "info" | "good" | "warn" | "danger" | "navy";
export const toneClass: Record<Tone, string> = {
  neutral: "border-line bg-paper text-ink",
  info: "border-[#9dc8f7] bg-[#eef5fd] text-[#0e3d7e]",
  good: "border-[#9fd9a9] bg-[#eefaf0] text-[#0b5a18]",
  warn: "border-[#f5cf7a] bg-[#fff8e6] text-[#6b4a00]",
  danger: "border-[#f2a7a7] bg-[#fdeeee] text-[#8a1c1c]",
  navy: "border-navy bg-navy text-white",
};

export const caseTone: Record<CaseStatus, Tone> = {
  new: "info",
  scheduling: "warn",
  quoted: "warn",
  booked: "good",
  in_progress: "info",
  delivered: "good",
  completed: "neutral",
  cancelled: "neutral",
};

export const teacherTone: Record<TeacherApplicationStatus, Tone> = {
  submitted: "info",
  under_review: "warn",
  changes_requested: "warn",
  approved: "good",
  published: "navy",
  unpublished: "neutral",
  rejected: "danger",
};
