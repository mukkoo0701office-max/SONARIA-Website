"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { LOCALE_COOKIE, locales, stripLocale, type Locale } from "@/lib/i18n";
import { switchTarget, type PartialLocalePaths } from "@/lib/localeSwitch";

type Props = {
  locale: Locale;
  label: string;
  names: Record<Locale, string>;
  /** ヘッダー（小さめ）とフッター（ゆったり）で大きさを変える */
  size?: "compact" | "regular";
  /** 一部の言語にしかないページ。無い言語へは 1 つ上の階層へ移動する */
  partial?: PartialLocalePaths;
};

// 言語の切り替え「日本語 | English」。国旗は使わない。今の言語を強調し、押すと同じページの別言語へ移動する。
// 選んだ言語は Cookie に保存し、次回以降は自動判定より優先する（.htaccess も同じ Cookie を見る）
export default function LanguageSwitcher({ locale, label, names, size = "compact", partial = {} }: Props) {
  const pathname = usePathname();
  const router = useRouter();
  const rest = stripLocale(pathname ?? "/");

  function remember(next: Locale) {
    document.cookie = `${LOCALE_COOKIE}=${next}; path=/; max-age=31536000; samesite=lax`;
  }

  const pad = size === "compact" ? "min-h-11 px-3 text-[13px]" : "min-h-11 px-4 text-[14px]";
  return (
    <nav aria-label={label}>
      <ul className="flex items-center rounded-full border border-line bg-card p-0.5">
        {locales.map((code, i) => {
          const current = code === locale;
          return (
            <li key={code} className="flex items-center">
              {i > 0 && (
                <span aria-hidden="true" className="px-0.5 text-line">
                  |
                </span>
              )}
              {/* next/link はプレビューの basePath（/SONARIA-Website）を自動で付ける */}
              <Link
                href={`/${code}${switchTarget(rest, code, partial)}`}
                hrefLang={code}
                lang={code}
                aria-current={current ? "true" : undefined}
                onClick={(e) => {
                  remember(code);
                  // 検索条件（クエリ）があれば引き継ぐ
                  if (!current && window.location.search && switchTarget(rest, code, partial) === rest) {
                    e.preventDefault();
                    router.push(`/${code}${rest}${window.location.search}`);
                  }
                }}
                className={`inline-flex items-center rounded-full ${pad} ${current ? "bg-navy font-semibold text-white" : "text-navy hover:bg-subtle"}`}
              >
                {names[code]}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
