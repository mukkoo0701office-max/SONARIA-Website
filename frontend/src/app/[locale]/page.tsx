import Link from "next/link";
import { getDictionary } from "@/data/dictionaries";
import { localizedPath, type Locale } from "@/lib/i18n";

type Props = { params: Promise<{ locale: string }> };

// ホーム（仮）。サイトマップ案のとおり、作品検索と講師検索の入口を最優先に置く
export default async function HomePage({ params }: Props) {
  const { locale: raw } = await params;
  const locale = raw as Locale;
  const dict = getDictionary(locale);
  const t = dict.home;

  return (
    <div>
      <section className="my-8">
        <h1 className="mb-2 text-2xl font-bold leading-snug">{t.headline}</h1>
        <p className="text-sm text-muted">{t.lead}</p>
      </section>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <article className="flex flex-col rounded-card border border-line bg-card p-[17px]">
          <h2 className="mb-2 text-base font-bold">{t.scoresCardTitle}</h2>
          <p className="mb-4 flex-1 text-[13px] text-muted">{t.scoresCardBody}</p>
          <Link
            href={localizedPath(locale, "/scores/")}
            className="block rounded-button border border-navy bg-navy p-[11px] text-center text-[13px] text-white transition-[filter] hover:brightness-95"
          >
            {t.scoresCardAction}
          </Link>
        </article>

        <article className="flex flex-col rounded-card border border-line bg-card p-[17px]">
          <div className="mb-2 flex items-center gap-2">
            <h2 className="text-base font-bold">{t.teachersCardTitle}</h2>
            <span className="rounded-tag bg-subtle px-2 py-[3px] text-[11px]">{dict.common.comingSoon}</span>
          </div>
          <p className="mb-4 flex-1 text-[13px] text-muted">{t.teachersCardBody}</p>
          <Link
            href={localizedPath(locale, "/teachers/")}
            className="block rounded-button border border-line bg-card p-[11px] text-center text-[13px] text-navy transition-[filter] hover:brightness-95"
          >
            {t.teachersCardAction}
          </Link>
        </article>
      </div>
    </div>
  );
}
