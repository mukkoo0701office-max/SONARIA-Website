import type { AffiliateLink } from "@/data/scores/types";

// 広告・アフィリエイト枠の設定。提携先が決まったらここだけを書き換える（コンポーネントは触らない）。
// CLAUDE.md「広告・アフィリエイト」: 「PR」と明示し、ダウンロード・送信・ナビの操作ボタンの隣に置かない。
// 登録・問い合わせ・決済・法務・管理画面には置かない（楽譜ライブラリのページだけで使う）。
//
// 対応している種類:
//   none    … 何も表示しない（本番で未設定のとき。プレビューでは枠の位置だけ表示する）
//   links   … 商品リンクの一覧（Amazon・楽天ブックス・出版社など。URL は https:// のみ）
//   adsense … Google AdSense（client: ca-pub-…、slot: 広告ユニット ID）
//   html    … 提携先が発行した貼り付けコード（Amazon・楽天・もしもアフィリエイト・A8.net などのウィジェット）。
//             サイト本体と切り離すため sandbox 付きの iframe の中で動かす。height は枠の高さ（px）
//
// TODO: 提携先が決まったら設定する。架空の商品・購入リンクは作らない

export type AdConfig =
  | { type: "none" }
  | { type: "links"; links: AffiliateLink[] }
  | { type: "adsense"; client: string; slot: string; height: number }
  | { type: "html"; html: string; height: number };

export type AdPlacement = "work" | "composer" | "category";

export const adPlacements: Record<AdPlacement, AdConfig> = {
  work: { type: "none" },
  composer: { type: "none" },
  category: { type: "none" },
};

// ── Google AdSense ───────────────────────────────────────
// 運営者の指示（2026-11-27「Google AdSense広告の最適化」）と AdSense のプログラムポリシーに沿う設定。
// 方針（docs/ads/ADSENSE_PLAN.md）:
// - 楽譜詳細ページに通常のディスプレイ広告を 1 枠だけ。ダウンロードの操作ボタンから離す（間に別のセクションを挟む）
// - 広告の上の表記は「広告」/「Advertisement」だけ（Google が認める表記）
// - ダウンロードを広告の閲覧条件にしない・独自ポップアップ・強制表示・自動クリック・表示回数の水増しをしない
// - 全画面（ビネット）広告・アンカー広告・自動広告は Google 側（AdSense の管理画面）の設定。初期値はすべて OFF
// - client / slot が未設定の間は広告コードを読み込まない。本番の一般利用者にはダミー広告を出さない（プレビュー時だけ枠の位置を表示）
// TODO: AdSense の審査に通ったら client（ca-pub-…）と slot（広告ユニット ID）を設定し、enabled を true にする（運営者の承認が必要）

export type AdSenseUnitId = "work-after-downloads";

export type AdSenseConfig = {
  enabled: boolean;
  client: string; // ca-pub-0000000000000000
  units: Record<AdSenseUnitId, { slot: string; enabled: boolean }>;
  // 表示するページの種類（楽譜詳細だけ。フォーム・法務・管理画面には置かない）
  pages: { work: boolean; composer: boolean; category: boolean };
  // 以下は Google 側で管理する設定の控え（サイトからは変更できない。管理画面の表示用）
  googleManaged: { autoAds: boolean; vignette: boolean; anchor: boolean };
  // 将来、自動広告を使う場合に除外するパス（AdSense の管理画面の「ページの除外」にも同じものを登録する）
  autoAdsExcludedPaths: readonly string[];
};

export const adsenseConfig: AdSenseConfig = {
  enabled: false,
  client: "",
  units: { "work-after-downloads": { slot: "", enabled: true } },
  pages: { work: true, composer: false, category: false },
  googleManaged: { autoAds: false, vignette: false, anchor: false },
  autoAdsExcludedPaths: ["/apply/", "/contact/", "/teachers/register/", "/performance/", "/legal/", "/admin/"],
};

/** 広告ユニットが配信できる状態か（client・slot がそろい、有効になっている） */
export function adsenseUnitReady(unit: AdSenseUnitId, config: AdSenseConfig = adsenseConfig): boolean {
  const u = config.units[unit];
  return config.enabled && /^ca-pub-\d{16}$/.test(config.client) && u.enabled && /^\d{6,}$/.test(u.slot);
}
