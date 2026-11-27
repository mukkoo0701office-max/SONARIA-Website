import Link from "next/link";
import { getDictionary } from "@/data/dictionaries";
import { curatorChannels, pagePaths, type CuratorChannelKey } from "@/data/site";
import { localizedPath, type Locale } from "@/lib/i18n";

// 管理人プロフィールの「執筆・発信活動」（note・X への外部リンクカード）と「お問い合わせ」。
// - 投稿の自動取得・埋め込みはしない（外部の JavaScript を読み込まない）
// - アイコンはサービスのロゴではなく汎用の図形（ロゴを使う場合は各社のブランドガイドに沿った公式素材を assets/ に置いてから）
// - 外部リンクは新しいタブ。rel に noopener noreferrer と、本人のアカウントであることを示す me を付ける
export default function CuratorChannels({ locale }: { locale: Locale }) {
  const t = getDictionary(locale).profileChannels;

  return (
    <>
      <section aria-labelledby="curator-channels" className="mt-10">
        <h2 id="curator-channels" className="border-l-[3px] border-gold pl-3 text-base font-bold sm:text-lg">
          {t.heading}
        </h2>
        <p className="mt-3 text-[14px] leading-relaxed sm:text-[15px]">{t.lead}</p>
        <ul className="mt-4 grid gap-3 sm:grid-cols-2">
          {curatorChannels.map((ch) => {
            const c = t.channels[ch.key];
            return (
              <li key={ch.key} className="flex flex-col rounded-card border border-line bg-paper p-5">
                <div className="flex items-center gap-3">
                  <span aria-hidden="true" className="grid h-10 w-10 flex-none place-items-center rounded-full border border-line bg-card text-navy">
                    <ChannelIcon kind={ch.key} />
                  </span>
                  <h3 className="text-[16px] font-bold">{c.name}</h3>
                </div>
                <p className="mt-3 flex-1 text-[14px] leading-relaxed">{c.description}</p>
                <a
                  href={ch.url}
                  target="_blank"
                  rel="me noopener noreferrer"
                  className="mt-4 inline-flex min-h-11 items-center justify-center gap-1.5 self-start rounded-button border border-navy bg-card px-4 text-[14px] font-semibold text-navy hover:bg-subtle"
                >
                  {c.cta}
                  <span aria-hidden="true">↗</span>
                  <span className="sr-only">（{t.newTab}）</span>
                </a>
              </li>
            );
          })}
        </ul>
      </section>

      <section aria-labelledby="curator-contact" className="mt-10">
        <h2 id="curator-contact" className="border-l-[3px] border-gold pl-3 text-base font-bold sm:text-lg">
          {t.contactHeading}
        </h2>
        <p className="mt-3 text-[14px] leading-relaxed sm:text-[15px]">{t.contactBody}</p>
        <Link href={localizedPath(locale, pagePaths.contact)} className="mt-3 inline-block text-[14px] text-navy underline">
          {t.contactCta}
        </Link>
      </section>
    </>
  );
}

// 汎用のアイコン（note: ペンと紙／X: 吹き出し）。サービスのロゴは描かない
function ChannelIcon({ kind }: { kind: CuratorChannelKey }) {
  if (kind === "note")
    return (
      <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
        <path d="M5 4h9l5 5v11H5z" />
        <path d="M14 4v5h5" />
        <path d="M8 13h8M8 16.5h5" />
      </svg>
    );
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 5h16v11H9l-5 4z" />
      <path d="M8 9.5h8M8 12.5h5" />
    </svg>
  );
}
