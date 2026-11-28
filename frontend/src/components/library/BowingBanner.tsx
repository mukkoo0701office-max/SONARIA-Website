import Link from "next/link";
import type { Dictionary } from "@/data/dictionaries/types";
import { pagePaths } from "@/data/site";
import { localizedPath, type Locale } from "@/lib/i18n";
import BowingPrices from "./BowingPrices";

type Props = {
  locale: Locale;
  t: Dictionary["library"]["bowing"];
  // 申し込み時に引き継ぐ情報（同じ内容を再入力しなくて済むようにする）
  context: { title: string; composer: string; workId: string; parts: string[]; assets: string[] };
};

// 運指・ボウイング付けサービス（SONARIA の有料サービス）への導線。広告ではないので PR 表記は付けない。
// 遷移先は統合申込フォーム（/apply/?service=bowing）。title / composer / part を「対象の楽譜」の初期値として読み込む（Issue #13）
export default function BowingBanner({ locale, t, context }: Props) {
  const params = new URLSearchParams({ service: "bowing", title: context.title, composer: context.composer, work: context.workId });
  for (const p of context.parts) params.append("part", p);
  for (const a of context.assets) params.append("asset", a);
  return (
    <aside className="my-6 rounded-card border border-navy bg-subtle p-[17px]">
      <h3 className="text-base font-bold text-navy">{t.title}</h3>
      <p className="mt-1.5 text-[13px]">{t.lead}</p>
      <BowingPrices t={t} />
      <Link
        href={`${localizedPath(locale, pagePaths.apply)}?${params.toString()}`}
        className="mt-3 inline-block rounded-button border border-navy bg-navy px-4 py-2.5 text-[13px] font-semibold text-white hover:brightness-95"
      >
        {t.cta}
      </Link>
      <p className="mt-2 text-xs text-muted">{t.note}</p>
    </aside>
  );
}
