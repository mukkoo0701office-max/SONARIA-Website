// 請求先の地域の推定（表示用の仮の値）。言語とは切り離し、端末のタイムゾーンで推定する。
// 確定は申込時の「請求先の国・地域」の申告と、決済時のサーバー側の確認で行う（docs/payments/PAYMENTS_DESIGN.md）
import type { Region } from "./priceEngine";

export function guessRegion(): Region | null {
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (!tz) return null;
    return tz === "Asia/Tokyo" ? "jp" : "intl";
  } catch {
    return null;
  }
}

/** 日本時間の今日（料金マスタの有効開始日と比べる） */
export function todayTokyo(now: Date = new Date()): string {
  return new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Tokyo" }).format(now);
}
