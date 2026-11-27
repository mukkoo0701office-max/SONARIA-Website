// 管理人への通知メールの文面（Edge Function と Node のテストの両方から使う）
// 個人情報（氏名・連絡先・入力内容）は入れない。転送・誤共有されても漏れないようにするため
import type { Kind } from "./validate.ts";

const KIND_LABEL: Record<Kind, string> = {
  lesson: "レッスンの申込",
  bowing: "運指・運弓付けの依頼",
  recording: "録音の依頼",
  performance_quote: "演奏依頼（見積もり）",
  teacher_application: "講師登録の申請",
};

export type NotifyMail = { subject: string; text: string };

export function buildNotifyMail(kind: Kind, receipt: string, at: Date, dashboardUrl: string): NotifyMail {
  // 日本時間で表示する
  const jst = new Date(at.getTime() + 9 * 60 * 60 * 1000).toISOString().replace("T", " ").slice(0, 16);
  const label = KIND_LABEL[kind];
  return {
    subject: `[SONARIA] ${label}が届きました（${receipt}）`,
    text: [
      `SONARIA のフォームから${label}が届きました。`,
      "",
      `受付番号: ${receipt}`,
      `種類: ${label}`,
      `受付日時: ${jst}（日本時間）`,
      "",
      "内容は管理画面で確認してください（このメールには個人情報を載せていません）。",
      dashboardUrl,
    ].join("\n"),
  };
}
