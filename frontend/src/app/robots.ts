import type { MetadataRoute } from "next";
import { aiAnswerBots, aiTrainingBots, crawlPolicy, privatePaths } from "@/data/crawlers";
import { absoluteUrl, isIndexable } from "@/lib/seo";

export const dynamic = "force-static";

// robots.txt。方針は data/crawlers.ts。
// 正式公開の判断前（NEXT_PUBLIC_INDEXABLE が "1" でない）は、すべてのクローラーを止める。
// 注: GitHub Pages のプレビューは /SONARIA-Website/ 配下のため、この robots.txt はクローラーに読まれない（noindex で対応）
export default function robots(): MetadataRoute.Robots {
  const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
  const priv = privatePaths.map((p) => `${basePath}${p}`);
  if (!isIndexable) return { rules: [{ userAgent: "*", disallow: "/" }] };
  const sitemap = absoluteUrl("/sitemap.xml");
  return {
    rules: [
      { userAgent: "*", allow: "/", disallow: priv },
      { userAgent: aiAnswerBots, ...(crawlPolicy.aiAnswer === "allow" ? { allow: "/", disallow: priv } : { disallow: "/" }) },
      { userAgent: aiTrainingBots, ...(crawlPolicy.aiTraining === "allow" ? { allow: "/", disallow: priv } : { disallow: "/" }) },
    ],
    ...(sitemap ? { sitemap } : {}),
  };
}
