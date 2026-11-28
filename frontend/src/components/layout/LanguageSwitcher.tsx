"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";
import { LOCALE_COOKIE, localeConfig, locales, stripLocale, type Locale } from "@/lib/i18n";
import { switchTarget, type PartialLocalePaths } from "@/lib/localeSwitch";

type Props = {
  locale: Locale;
  label: string;
  names?: Record<Locale, string>;
  /** ヘッダー（小さめ）とフッター（ゆったり）で大きさを変える */
  size?: "compact" | "regular";
  /** 一部の言語にしかないページ。無い言語へは 1 つ上の階層へ移動する */
  partial?: PartialLocalePaths;
};

// 言語の切り替え。国旗は使わず、各言語はその言語自身の名前で出す。押すと同じページの別言語へ移動する。
// - 公開中の言語が 2 つまで: 「日本語 | English」を並べる（今の言語を強調）
// - 3 つ以上: ドロップダウン（スマホは地球のアイコン＋今の言語名）。未公開の言語は出さない
// 選んだ言語は Cookie に保存し、次回以降は自動判定より優先する（.htaccess も同じ Cookie を見る）
export default function LanguageSwitcher({ locale, label, names, size = "compact", partial = {} }: Props) {
  const pathname = usePathname();
  const router = useRouter();
  const rest = stripLocale(pathname ?? "/");

  function remember(next: Locale) {
    document.cookie = `${LOCALE_COOKIE}=${next}; path=/; max-age=31536000; samesite=lax`;
  }

  const pad = size === "compact" ? "min-h-11 px-3 text-[13px]" : "min-h-11 px-4 text-[14px]";
  const hrefOf = (code: Locale) => `/${code}${switchTarget(rest, code, partial)}`;
  const go = (e: React.MouseEvent, code: Locale) => {
    remember(code);
    // 検索条件（クエリ）があれば引き継ぐ（同じページがあるときだけ）
    if (code !== locale && window.location.search && switchTarget(rest, code, partial) === rest) {
      e.preventDefault();
      router.push(`/${code}${rest}${window.location.search}`);
    }
  };

  if (locales.length > 2) return <LanguageMenu locale={locale} label={label} hrefOf={hrefOf} go={go} size={size} />;

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
                href={hrefOf(code)}
                hrefLang={code}
                lang={code}
                aria-current={current ? "true" : undefined}
                onClick={(e) => go(e, code)}
                className={`inline-flex items-center rounded-full ${pad} ${current ? "bg-navy font-semibold text-white" : "text-navy hover:bg-subtle"}`}
              >
                {names?.[code] ?? localeConfig(code).nativeName}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

// 3 言語以上のときのドロップダウン（ネイティブの <details> を使い、キーボード・読み上げで操作できる）
function LanguageMenu({ locale, label, hrefOf, go, size }: { locale: Locale; label: string; hrefOf: (c: Locale) => string; go: (e: React.MouseEvent, c: Locale) => void; size: "compact" | "regular" }) {
  const ref = useRef<HTMLDetailsElement>(null);
  const id = useId();
  const [open, setOpen] = useState(false);
  // 外側を押す・Esc で閉じる
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent | KeyboardEvent) => {
      if (e instanceof KeyboardEvent ? e.key === "Escape" : !ref.current?.contains(e.target as Node)) {
        ref.current?.removeAttribute("open");
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", close);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", close);
    };
  }, [open]);
  return (
    <nav aria-label={label}>
      <details ref={ref} className="relative" onToggle={(e) => setOpen((e.target as HTMLDetailsElement).open)}>
        <summary aria-controls={id} className={`flex min-h-11 cursor-pointer list-none items-center gap-1.5 rounded-full border border-line bg-card px-3 text-navy hover:bg-subtle ${size === "compact" ? "text-[13px]" : "text-[14px]"}`}>
          {/* 地球のアイコン（装飾） */}
          <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.6">
            <circle cx="12" cy="12" r="9" />
            <path d="M3 12h18M12 3c2.5 2.7 2.5 15.3 0 18M12 3c-2.5 2.7-2.5 15.3 0 18" />
          </svg>
          <span>{localeConfig(locale).nativeName}</span>
          <span aria-hidden="true" className="text-[10px]">▾</span>
        </summary>
        <ul id={id} className="absolute right-0 z-50 mt-1 max-h-[60vh] min-w-[11rem] overflow-y-auto rounded-card border border-line bg-card py-1 shadow-lg">
          {locales.map((code) => (
            <li key={code}>
              <Link
                href={hrefOf(code)}
                hrefLang={localeConfig(code).htmlLang}
                lang={localeConfig(code).htmlLang}
                aria-current={code === locale ? "true" : undefined}
                onClick={(e) => go(e, code)}
                className={`flex min-h-11 items-center px-4 text-[14px] ${code === locale ? "font-semibold text-navy" : "text-ink hover:bg-subtle"}`}
              >
                {localeConfig(code).nativeName}
              </Link>
            </li>
          ))}
        </ul>
      </details>
    </nav>
  );
}
