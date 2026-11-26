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
