import raw from "./amazon.json";

// Amazon アソシエイトの商品リンク（docs/affiliate-research/README.md の仕様）。
// - 掲載するのは、GPT の調査キューで approved_for_implementation になり、ASIN と商品ページを確認できた商品だけ
//   （tools/affiliate/sync_amazon.py が docs/affiliate-research/queue.json から生成する。ここを手で書き換えない）
// - リンクは https://www.amazon.co.jp/dp/{ASIN}?tag={AMAZON_TAG} の形だけを認める。タグが違う・確認から日数が経ったものは表示しない
// - 1 ページ最大 2 件。広告／PR と、アソシエイトの開示文を必ず表示する。ダウンロードボタンの隣には置かない
// - 価格・在庫・評価・商品画像は表示しない（許諾された方法で取得・更新できないため）

export const AMAZON_TAG = "mukkoo-22";
export const MAX_ITEMS_PER_PAGE = 2;
const MAX_AGE_DAYS = 180; // 確認日から半年を過ぎたリンクは出さない（失効・誤リンクの防止）

export type AmazonItem = {
  id: string;
  asin: string;
  url: string;
  title: string; // 商品名（Amazon の商品ページの表記）
  category: "printed_score" | "pocket_score" | "book" | "recording" | "accessory";
  workIds: string[]; // SONARIA の作品 ID
  note?: { ja: string; en: string }; // 例: 「この曲を含む原典版のパート譜（ヘンレ社）」
  verifiedAt: string; // YYYY-MM-DD
};

const URL_RE = /^https:\/\/www\.amazon\.co\.jp\/dp\/([A-Z0-9]{10})\?tag=([A-Za-z0-9-]+)$/;

function isValid(item: AmazonItem, today: Date): boolean {
  const m = URL_RE.exec(item.url);
  if (!m || m[1] !== item.asin || m[2] !== AMAZON_TAG) return false;
  const age = (today.getTime() - new Date(item.verifiedAt).getTime()) / 86_400_000;
  return Number.isFinite(age) && age >= 0 && age <= MAX_AGE_DAYS;
}

const buildDate = new Date();
const items: AmazonItem[] = (raw.items as AmazonItem[]).filter((i) => isValid(i, buildDate));

/** 作品に関連する商品（最大 2 件。楽譜 → ポケットスコア → 書籍 → 録音 → 用品の順） */
export function amazonItemsFor(workId: string): AmazonItem[] {
  const order = ["printed_score", "pocket_score", "book", "recording", "accessory"];
  return items
    .filter((i) => i.workIds.includes(workId))
    .sort((a, b) => order.indexOf(a.category) - order.indexOf(b.category))
    .slice(0, MAX_ITEMS_PER_PAGE);
}
