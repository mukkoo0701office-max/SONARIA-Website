import { composerOf, catalogLabel, works } from "@/data/scores/catalog";
import { libraryPaths } from "@/data/scores/paths";
import { absoluteUrl } from "@/lib/seo";

export const dynamic = "force-static";

// llms.txt（任意の補助資料）。AI ツール向けにサイトの概要と主要ページを並べたテキスト。
// 検索順位や AI による引用を保証するものではなく、SEO の必須要件でもない。
export function GET() {
  const url = (p: string) => absoluteUrl(p) ?? p;
  const lines = [
    "# SONARIA",
    "",
    "> SONARIA（ソナリア）は、クラシック音楽の楽譜検索、音楽講師検索、ボウイング・運指付け、レッスン、録音・演奏の依頼をまとめた中立的な音楽プラットフォームです。楽譜ライブラリでは、公開の権利を確認した楽譜 PDF を無料で公開しています。",
    "",
    "## 主なページ",
    `- [楽譜を探す](${url("/ja/scores/")})`,
    `- [作曲家から探す](${url(`/ja${libraryPaths.composers}`)})`,
    `- [ボウイング・運指付け](${url("/ja/bowing/")})`,
    `- [音楽講師を探す](${url("/ja/teachers/")})`,
    "",
    "## 楽譜（作品ページ）",
    ...works.map((w) => {
      const c = composerOf(w);
      return `- [${c.name.ja}「${w.title.ja}」${catalogLabel(w) ? ` ${catalogLabel(w)}` : ""}](${url(`/ja${libraryPaths.work(w.id)}`)})`;
    }),
    "",
  ];
  return new Response(lines.join("\n"), { headers: { "Content-Type": "text/plain; charset=utf-8" } });
}
