// アクセス解析（GA4）の設定。測定 ID は公開してよい値（ページの HTML に必ず含まれる）
// プロパティ: SONARIA（ストリーム名 Sonaria）。運営者が 2026-11-28 に作成
export const analyticsConfig = {
  ga4MeasurementId: "G-HJT4YXBKPR",
};

// 計測するのは本番ビルドだけ。プレビュー（NEXT_PUBLIC_PREVIEW=1）の閲覧は運営側の確認作業なので数字に混ぜない
// 注: NEXT_PUBLIC_* はビルド時に置き換わるため process.env.XXX と直接書く
export function ga4MeasurementId(): string | null {
  if (process.env.NEXT_PUBLIC_PREVIEW === "1") return null;
  const id = analyticsConfig.ga4MeasurementId;
  return /^G-[A-Z0-9]+$/.test(id) ? id : null;
}
