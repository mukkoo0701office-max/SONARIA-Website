import Link from "next/link";
import { getDictionary } from "@/data/dictionaries";
import { footerNav, pagePaths, socialLinks } from "@/data/site";
import { localizedPath, type Locale } from "@/lib/i18n";

// フッター（トップページ改修指示書 §6）。
// SNS は URL が未設定（null）のあいだリンクにせず「準備中」と表示する（不正なページへ移動させない）。
// 仮: 各 SNS の公式アイコンは、それぞれのブランドガイドラインに沿った素材が届いてから差し替える。
export default function SiteFooter({ locale }: { locale: Locale }) {
  const dict = getDictionary(locale);

  return (
    <footer className="mt-20 border-t border-line bg-card">
      <div className="mx-auto grid max-w-wide gap-10 px-4 py-12 sm:grid-cols-2 lg:grid-cols-[1.2fr_2fr_1fr_1fr] lg:px-6">
        <div>
          <Link href={localizedPath(locale, "/")} aria-label={dict.header.homeLinkLabel} className="inline-block">
            <span className="block font-brand text-[26px] leading-none tracking-[0.06em] text-navy">SONARIA</span>
            <span className="mt-1 block text-[10px] tracking-[0.2em] text-gold" aria-hidden="true">
              {dict.common.tagline}
            </span>
          </Link>
          <p className="mt-4 max-w-xs text-xs leading-relaxed text-muted">{dict.meta.siteDescription}</p>
        </div>

        <nav aria-labelledby="footer-site-links">
          <h2 id="footer-site-links" className="mb-3 text-[13px] font-semibold">
            {dict.footer.siteLinksHeading}
          </h2>
          <ul className="grid grid-cols-1 gap-y-2 text-[13px] min-[420px]:grid-cols-2">
            {footerNav.map((key) => (
              <li key={key}>
                <Link href={localizedPath(locale, pagePaths[key])} className="text-ink hover:underline">
                  {dict.pages[key]}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <nav aria-labelledby="footer-support">
          <h2 id="footer-support" className="mb-3 text-[13px] font-semibold">
            {dict.footer.supportHeading}
          </h2>
          <ul className="grid gap-y-2 text-[13px]">
            <li>
              <Link href={localizedPath(locale, pagePaths.contact)} className="text-ink hover:underline">
                {dict.pages.contact}
              </Link>
            </li>
            <li>
              <Link href={localizedPath(locale, pagePaths.privacy)} className="text-ink hover:underline">
                {dict.pages.privacy}
              </Link>
            </li>
          </ul>
        </nav>

        <div>
          <h2 className="mb-3 text-[13px] font-semibold">{dict.footer.snsHeading}</h2>
          <ul className="flex flex-wrap gap-2">
            {socialLinks.map((sns) => (
              <li key={sns.key}>
                {sns.url ? (
                  <a
                    href={sns.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex min-h-10 items-center rounded-full border border-line bg-card px-4 text-[13px] text-navy hover:bg-paper"
                  >
                    {sns.label}
                  </a>
                ) : (
                  <span className="inline-flex min-h-10 items-center gap-1.5 rounded-full border border-dashed border-line px-4 text-[13px] text-muted">
                    {sns.label}
                    <span className="text-[11px]">· {dict.footer.snsPending}</span>
                  </span>
                )}
              </li>
            ))}
          </ul>
        </div>
      </div>
      <div className="border-t border-line">
        <p className="mx-auto max-w-wide px-4 py-5 text-xs text-muted lg:px-6">{dict.footer.copyright}</p>
      </div>
    </footer>
  );
}
