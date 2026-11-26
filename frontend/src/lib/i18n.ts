// 対応言語。URL は /ja/... と /en/...（docs/decisions/0001-phase1-static-site.md）
export const locales = ["ja", "en"] as const;
export type Locale = (typeof locales)[number];

export const defaultLocale: Locale = "ja";

// 本人が明示的に選んだ言語を保存する Cookie。.htaccess の振り分けでもこの名前を参照する
export const LOCALE_COOKIE = "sonaria_lang";

export function isLocale(value: string): value is Locale {
  return (locales as readonly string[]).includes(value);
}

// /ja/scores/ → /scores/ のように、先頭の言語部分を取り除く
export function stripLocale(pathname: string): string {
  const rest = pathname.replace(/^\/(ja|en)(?=\/|$)/, "");
  return rest === "" ? "/" : rest;
}

export function localizedPath(locale: Locale, path: string): string {
  const normalized = path.startsWith("/") ? path : `/${path}`;
  return `/${locale}${normalized}`;
}
