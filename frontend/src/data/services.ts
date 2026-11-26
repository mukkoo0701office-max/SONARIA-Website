import type { ImageKey } from "@/data/images";
import type { PageKey } from "@/data/site";

// トップページ「ピックアップ」に並べる SONARIA の有料サービス。
// サービスを増やすときはこの配列に追加し、dictionaries の services.items に文言を足す。
// price: 料金は詳細ページで後から設定する。null のあいだは表示しない（指示書 §5）
export type ServiceKey = "bowing" | "lessons" | "recording" | "performance";

export type Service = {
  key: ServiceKey;
  page: PageKey;
  image: ImageKey;
  price: null | { amount: number; currency: "JPY" | "USD"; note?: string };
};

export const services: readonly Service[] = [
  { key: "bowing", page: "bowing", image: "bowing", price: null },
  { key: "lessons", page: "lessons", image: "lessons", price: null },
  { key: "recording", page: "recording", image: "recording", price: null },
  { key: "performance", page: "performance", image: "performance", price: null },
];
