import type { NextConfig } from "next";

// プレビュー（GitHub Pages）は https://<user>.github.io/SONARIA-Website/ 配下で配信されるため、
// その時だけ NEXT_PUBLIC_BASE_PATH=/SONARIA-Website を指定する。本番（さくら）では空。
const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

// 静的書き出し（さくらのレンタルサーバで配信するため）。
// trailingSlash: /ja/scores/ を ja/scores/index.html として出力し、Apache でそのまま配信できるようにする。
const nextConfig: NextConfig = {
  output: "export",
  basePath,
  trailingSlash: true,
  images: { unoptimized: true },
  // 未設定でも必ず値を持たせ、ビルド時に定数として埋め込む（本番ビルドでデモデータを除くため）
  // 申し込みフォームの定義（supabase/functions/_shared/schema.ts）を画面とサーバーで共有するため
  experimental: { externalDir: true },
  env: {
    NEXT_PUBLIC_PREVIEW: process.env.NEXT_PUBLIC_PREVIEW ?? "0",
  },
};

export default nextConfig;
