import type { Dictionary } from "@/data/dictionaries/types";
import type { AmazonItem } from "@/data/affiliate/amazon";
import { tr, type Locale } from "@/lib/i18n";

// 作品ページの「関連する市販楽譜・書籍」（Amazon アソシエイト）。商品が無ければ何も表示しない。
// 広告であることと、アソシエイトの開示文を必ず表示する（Amazon アソシエイト・プログラム運営規約）
export default function AmazonRelated({ items, locale, t }: { items: AmazonItem[]; locale: Locale; t: Dictionary["library"]["ad"] }) {
  if (items.length === 0) return null;
  return (
    <aside aria-labelledby="amazon-related" className="my-8 rounded-card border border-line bg-card p-4">
      <div className="flex items-center gap-2">
        <span className="rounded-full border border-line px-2 py-0.5 text-xs font-semibold text-muted">{t.label}</span>
        <h2 id="amazon-related" className="text-[15px] font-bold">
          {t.amazonHeading}
        </h2>
      </div>
      <ul className="mt-3 grid gap-2.5">
        {items.map((i) => (
          <li key={i.id} className="text-sm">
            <a href={i.url} target="_blank" rel="sponsored nofollow noopener noreferrer" className="text-navy underline">
              {i.title}
            </a>
            {i.note && <span className="mt-0.5 block text-xs text-muted">{tr(i.note, locale)}</span>}
          </li>
        ))}
      </ul>
      <p className="mt-3 text-xs text-muted">{t.amazonDisclosure}</p>
    </aside>
  );
}
