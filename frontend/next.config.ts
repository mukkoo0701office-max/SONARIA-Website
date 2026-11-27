import type { NextConfig } from "next";

// プレビュー（GitHub Pages）は https://<user>.github.io/SONARIA-Website/ 配下で配信されるため、
// その時だけ NEXT_PUBLIC_BASE_PATH=/SONARIA-Website を指定する。本番（さくら）では空。
const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

// 静的書き出し（さくらのレンタルサーバで配信するため）。
// trailingSlash: /ja/scores/ を ja/scores/index.html として出力し、Apache でそのまま配信できるようにする。
// 管理画面（src/app/(admin)/admin/*.admin.tsx）は SONARIA_ADMIN_PREVIEW=1 のビルドでだけページとして生成する。
// 認証サーバーが未接続のため、本番・GitHub Pages のビルドには管理画面もデモデータも含めない（CI の「No admin in production build」で検査）。
// 確認方法: SONARIA_ADMIN_PREVIEW=1 npm run dev → http://localhost:3000/admin/
const adminPreview = process.env.SONARIA_ADMIN_PREVIEW === "1";

const nextConfig: NextConfig = {
  output: "export",
  pageExtensions: adminPreview ? ["admin.tsx", "tsx", "ts"] : ["tsx", "ts"],
  basePath,
  trailingSlash: true,
  images: { unoptimized: true },
  // 未設定でも必ず値を持たせ、ビルド時に定数として埋め込む（本番ビルドでデモデータを除くため）
  env: {
    NEXT_PUBLIC_PREVIEW: process.env.NEXT_PUBLIC_PREVIEW ?? "0",
    // 検索エンジンへの掲載可否と公開 URL（lib/seo.ts）。正式公開の判断までは未設定のまま
    NEXT_PUBLIC_INDEXABLE: process.env.NEXT_PUBLIC_INDEXABLE ?? "0",
    NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL ?? "",
    // 申込フォームの送信先（Supabase の URL と公開キー）。未設定の間は「未接続」として扱う（lib/orders/submit.ts）
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "",
  },
};

export default nextConfig;
