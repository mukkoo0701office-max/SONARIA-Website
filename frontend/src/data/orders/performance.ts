// 演奏依頼の見積もりフォームの選択肢。表示名は辞書（performanceQuote）、値はここだけで管理する。
// 仕様: PR #24（docs/SONARIA_FORMS_AND_HOME_SEARCH_20261127.md）§1。価格の自動確定はしない（見積もりは個別に返信）
// 未確定の項目は docs/proposals/performance-quote-and-teacher-registration.md

/** 日程の状況 */
export type ScheduleMode = "fixed" | "candidates" | "undecided";
export const scheduleModes: readonly ScheduleMode[] = ["fixed", "candidates", "undecided"];

/** 候補日の最大数（候補が複数のとき） */
export const performanceDatesMax = 3;

/** 時間帯 */
export type TimeSlot = "any" | "morning" | "afternoon" | "evening";
export const timeSlots: readonly TimeSlot[] = ["any", "morning", "afternoon", "evening"];

// 仮: 予算範囲の区切りは未確定（運営者の確認待ち）。正式な料金表ではなく、見積もりの参考として伺うだけ
export type BudgetRange = "under50k" | "50to100k" | "100to200k" | "200to300k" | "over300k" | "undecided";
export const budgetRanges: readonly BudgetRange[] = ["under50k", "50to100k", "100to200k", "200to300k", "over300k", "undecided"];

/** 編成 */
export type PerformanceEnsemble = "solo" | "duo" | "trio" | "quartet" | "other";
export const performanceEnsembles: readonly PerformanceEnsemble[] = ["solo", "duo", "trio", "quartet", "other"];
