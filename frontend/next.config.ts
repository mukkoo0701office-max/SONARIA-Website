import type { NextConfig } from "next";

// 静的書き出し（さくらのレンタルサーバで配信するため）。
// trailingSlash: /ja/scores/ を ja/scores/index.html として出力し、Apache でそのまま配信できるようにする。
const nextConfig: NextConfig = {
  output: "export",
  trailingSlash: true,
  images: { unoptimized: true },
};

export default nextConfig;
