"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";
import { getDictionary } from "@/data/dictionaries";
import { headerNav, pagePaths, type PageKey } from "@/data/site";
import { localizedPath, stripLocale, type Locale } from "@/lib/i18n";
import LanguageSwitcher from "./LanguageSwitcher";
import type { PartialLocalePaths } from "@/lib/localeSwitch";

// 画面上部に固定するヘッダー（トップページ改修指示書 §2）。
// PC（lg 以上）はロゴ行の下に横並びのナビ、スマホ・タブレットはハンバーガーメニュー。
export default function SiteHeader({ locale, partial = {} }: { locale: Locale; partial?: PartialLocalePaths }) {
  const dict = getDictionary(locale);
  const pathname = usePathname();
  const current = stripLocale(pathname);
  const [open, setOpen] = useState(false);
  const menuId = useId();
  const buttonRef = useRef<HTMLButtonElement>(null);

  // ページを移動したらメニューを閉じる
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  // Esc でメニューを閉じ、フォーカスをボタンに戻す
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        buttonRef.current?.focus();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open]);

  const isCurrent = (key: PageKey) => (key === "home" ? current === "/" : current.startsWith(pagePaths[key]));

  return (
    <header className="sticky top-0 z-40 border-b border-line bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/85">
      <div className="mx-auto flex max-w-wide items-center justify-between gap-3 px-4 py-3 lg:px-6">
        {/* 仮: ロゴ原本が来るまでテキストのロゴ（似た画像を作って代用しない） */}
        <Link href={localizedPath(locale, "/")} aria-label={dict.header.homeLinkLabel} className="block shrink-0">
          <span className="block font-brand text-[24px] leading-none tracking-[0.06em] text-navy lg:text-[28px]">SONARIA</span>
          {/* ロゴの一部として扱う（ロゴ内の文字はコントラスト基準の対象外）。読み上げは aria-label に任せる */}
          <span className="mt-1 block text-[9px] tracking-[0.2em] text-gold lg:text-[10px]" aria-hidden="true">
            {dict.common.tagline}
          </span>
        </Link>

        <div className="flex items-center gap-2">
          <LanguageSwitcher locale={locale} label={dict.common.languageLabel} partial={partial} />
          <button
            ref={buttonRef}
            type="button"
            className="inline-flex h-11 w-11 items-center justify-center rounded-button border border-line bg-card text-navy lg:hidden"
            aria-expanded={open}
            aria-controls={menuId}
            onClick={() => setOpen((prev) => !prev)}
          >
            <span className="sr-only">{open ? dict.header.menuClose : dict.header.menuOpen}</span>
            <svg aria-hidden="true" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              {open ? (
                <path d="M6 6l12 12M18 6L6 18" />
              ) : (
                <path d="M4 7h16M4 12h16M4 17h16" />
              )}
            </svg>
          </button>
        </div>
      </div>

      {/* PC: 横並びのナビ */}
      <nav aria-label={dict.header.mainNavLabel} className="hidden border-t border-line lg:block">
        <ul className="mx-auto flex max-w-wide items-stretch justify-between px-6">
          {headerNav.map((key) => (
            <li key={key}>
              <Link
                href={localizedPath(locale, pagePaths[key])}
                aria-current={isCurrent(key) ? "page" : undefined}
                className={
                  isCurrent(key)
                    ? "block border-b-2 border-navy px-2 py-3 text-[14px] font-semibold text-navy"
                    : "block border-b-2 border-transparent px-2 py-3 text-[14px] text-ink hover:border-line"
                }
              >
                {dict.pages[key]}
              </Link>
            </li>
          ))}
        </ul>
      </nav>

      {/* スマホ・タブレット: ハンバーガーメニュー */}
      <nav
        id={menuId}
        aria-label={dict.header.mainNavLabel}
        hidden={!open}
        className="max-h-[calc(100dvh-72px)] overflow-y-auto border-t border-line bg-card lg:hidden"
      >
        <ul className="mx-auto max-w-wide px-4 py-2">
          {headerNav.map((key) => (
            <li key={key} className="border-b border-line last:border-b-0">
              <Link
                href={localizedPath(locale, pagePaths[key])}
                aria-current={isCurrent(key) ? "page" : undefined}
                className={
                  isCurrent(key)
                    ? "flex min-h-12 items-center text-[15px] font-semibold text-navy"
                    : "flex min-h-12 items-center text-[15px] text-ink"
                }
                onClick={() => setOpen(false)}
              >
                {dict.pages[key]}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </header>
  );
}
