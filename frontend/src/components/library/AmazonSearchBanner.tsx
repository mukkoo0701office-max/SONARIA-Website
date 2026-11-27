import { amazonSearch } from "@/data/affiliate/amazonSearch";
import type { Dictionary } from "@/data/dictionaries/types";
import { amazonSearchUrl } from "@/lib/affiliate/amazonSearch";

type Props = {
  t: Dictionary["library"]["ad"];
  composer: string; // 表示用の作曲家名
  keyword: string; // 検索語
};

// 作品ページの下部に置く横長のバナー（広告）。確認済みの商品（amazon.json）が無いときに表示する。
// 画像は使わず、配色トークンだけで描く（外部画像・ロゴを使わない）
export default function AmazonSearchBanner({ t, composer, keyword }: Props) {
  const s = t.amazonSearch;
  return (
    <aside aria-labelledby="amazon-banner" className="my-8 overflow-hidden rounded-card bg-navy text-white">
      <div className="relative flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
        <span aria-hidden="true" className="pointer-events-none absolute bottom-[-30px] right-24 hidden select-none text-[120px] leading-none text-gold/20 sm:block">
          ♪
        </span>
        <div className="relative">
          <p className="text-xs font-semibold tracking-wider text-gold">
            {t.label} · {s.bannerKicker}
          </p>
          <h2 id="amazon-banner" className="mt-1 text-lg font-bold">
            {s.bannerHeading(composer)}
          </h2>
          <p className="mt-1 text-[13px] text-white/85">{s.bannerLead}</p>
        </div>
        <a
          href={amazonSearchUrl(keyword, amazonSearch.tag)}
          target="_blank"
          rel="sponsored nofollow noopener noreferrer"
          className="relative inline-flex min-h-11 shrink-0 items-center justify-center rounded-full bg-gold px-5 py-3 text-[15px] font-semibold text-navy hover:brightness-110"
        >
          {s.bannerCta} <span aria-hidden="true" className="ml-1">↗</span>
          <span className="sr-only">{s.newWindow}</span>
        </a>
      </div>
      <p className="px-5 pb-4 text-xs text-white/75 sm:px-6">{t.amazonDisclosure}</p>
    </aside>
  );
}
