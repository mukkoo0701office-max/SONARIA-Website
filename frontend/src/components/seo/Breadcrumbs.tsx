import Link from "next/link";
import JsonLd from "@/components/seo/JsonLd";
import { absoluteUrl } from "@/lib/seo";

export type Crumb = { label: string; href?: string }; // href は言語付きのサイト内パス（/ja/scores/）。最後の項目は href なし

// パンくずリスト（画面表示と BreadcrumbList の構造化データを同じ内容で出す）
export default function Breadcrumbs({ items, label }: { items: Crumb[]; label: string }) {
  const ld = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((c, i) => {
      const url = c.href ? absoluteUrl(c.href) : null;
      return { "@type": "ListItem", position: i + 1, name: c.label, ...(url ? { item: url } : {}) };
    }),
  };
  return (
    <>
      <nav aria-label={label} className="mt-4 text-xs text-muted">
        <ol className="flex flex-wrap items-center gap-1">
          {items.map((c, i) => (
            <li key={i} className="flex items-center gap-1">
              {i > 0 && <span aria-hidden="true">›</span>}
              {c.href ? (
                <Link href={c.href} className="text-navy underline">
                  {c.label}
                </Link>
              ) : (
                <span aria-current="page">{c.label}</span>
              )}
            </li>
          ))}
        </ol>
      </nav>
      <JsonLd data={ld} />
    </>
  );
}
