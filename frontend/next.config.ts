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
};

export default nextConfig;
