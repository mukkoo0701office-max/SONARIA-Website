// GitHub Pages のプレビューは /SONARIA-Website 配下で配信される（next.config.ts の basePath）。
// next/link と router は basePath を自動で付けるが、<img src> などの素のパスには付かないため、この関数で付ける。
const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

export function withBasePath(path: string): string {
  return `${basePath}${path.startsWith("/") ? path : `/${path}`}`;
}

// プレビュー環境（GitHub Pages）かどうか。デモデータの表示切り替えに使う
export const isPreview = process.env.NEXT_PUBLIC_PREVIEW === "1";
