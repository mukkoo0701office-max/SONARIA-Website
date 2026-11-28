// SONARIA 運営の有料サービス（レッスン／運指・運弓付け／録音）の料金と受付条件。
// 仕様: GitHub Issue #13（最新の追記を正本とする）。値を変えるときはここだけを書き換える（画面に直書きしない）。
// 未確定の項目は docs/proposals/service-order-forms.md に記載。
// 注: 講師ディレクトリ（無料・料金非表示）とは別物。こちらは SONARIA 運営の有料サービス専用。
// 注: 料金の正本は料金マスタ（public.price_items、初期値は lib/orders/priceEngine.ts の SEED_PRICES）。
//     申込フォームの表示とサーバーの計算は料金マスタを使う。ここの円の値は初期値と同じであることをテストで確認している（返信文・既存テスト用）

export type ServiceId = "lesson" | "bowing" | "recording";
export const services: readonly ServiceId[] = ["lesson", "bowing", "recording"];

/** 申込フォームのパス（言語を除く） */
export const orderPath = "/apply/";

// ---- 納期係数（運指・運弓／録音で共通） ----------------------------------
// 起算日は「作業に必要なデータが揃った日」（送信日とは異なり得る）。係数は 10 倍の整数で持ち、計算を整数で行う
export type DeliveryId = "nextDay" | "twoDays" | "threePlus";
export const deliveryOptions: { id: DeliveryId; factorTenths: number; daysAfter: number }[] = [
  { id: "nextDay", factorTenths: 12, daysAfter: 1 },
  { id: "twoDays", factorTenths: 11, daysAfter: 2 },
  { id: "threePlus", factorTenths: 10, daysAfter: 3 },
];

// ---- 運指・運弓付け（1 ページ単価） ----------------------------------------
export type BowingType = "bowing" | "fingering" | "both";
export const bowingUnitPrice: Record<BowingType, number> = { bowing: 1000, fingering: 1000, both: 1500 };
export const bowingPagesMax = 100; // [要決定] 1 回の申込のページ数の上限

// ---- 録音（1 トラック単価） -----------------------------------------------
// ヴァイオリン・ヴィオラは SONARIA、チェロ・その他は外注
export type RecordingInstrument = "violin" | "viola" | "cello" | "other";
export const recordingInstruments: { id: RecordingInstrument; unitPrice: number; outsourced: boolean }[] = [
  { id: "violin", unitPrice: 9000, outsourced: false },
  { id: "viola", unitPrice: 9000, outsourced: false },
  { id: "cello", unitPrice: 14000, outsourced: true },
  { id: "other", unitPrice: 14000, outsourced: true },
];
export const recordingTracksMax = 50; // [要決定] 楽器ごとのトラック数の上限

// ---- レッスン ---------------------------------------------------------------
// 料金: Issue #13 の参考値（運営者が「指示書の数字」を採用と決定済み）。所要時間が不明なものは null
export type LessonPlanId = "trial" | "single" | "intensive" | "visiting";
export const lessonPlans: { id: LessonPlanId; price: number; minutes: number | null; firstTimeOnly: boolean }[] = [
  { id: "trial", price: 1000, minutes: null, firstTimeOnly: true }, // [要決定] 体験レッスンの所要時間
  { id: "single", price: 6000, minutes: 60, firstTimeOnly: false },
  { id: "intensive", price: 11000, minutes: 150, firstTimeOnly: false },
  { id: "visiting", price: 10000, minutes: 120, firstTimeOnly: false },
];
export const lessonTimeZone = "Asia/Tokyo";
export const lessonCandidateDays = 7; // 今日から 7 日間
export const lessonStartTimes = ["12:00", "12:30", "13:00", "13:30", "14:00", "14:30", "15:00", "15:30", "16:00", "16:30", "17:00", "17:30", "18:00"];
export const lessonDayEnd = "18:00"; // [要決定] 終了が 18:00 を過ぎる開始時刻の扱い（運営者が確認するまで注記のみ）
export const lessonCandidatesMax = 10;

// [要決定] 表示価格の税込・税抜（旧サイトは税抜表記）。決まるまで画面に注記する
export const taxNotePending = true;
