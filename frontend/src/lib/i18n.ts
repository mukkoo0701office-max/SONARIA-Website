// 言語の定義（多言語対応の基盤）。URL は /ja/... /en/...（docs/decisions/0001-phase1-static-site.md）
//
// 仕組み（docs/i18n/I18N_FOUNDATION.md）:
//   - localeRegistry: 対応予定の全言語。published が true の言語だけ、ページを作り・リンクし・サイトマップと hreflang に載せる
//   - locales: 公開中の言語（ページ生成・型の基準）。localeRegistry の published と必ず一致させる（テストで確認）
//   - 未公開の言語は URL を作らないので、翻訳のないページが検索エンジンに出ることはない
// 注: このファイルは Node のテストと postbuild（.htaccess の生成）からも読むため、値の import をしない

export type SupportedLocale = "ja" | "en" | "de" | "fr" | "es" | "it";

export type LocaleConfig = {
  code: SupportedLocale;
  nativeName: string; // その言語自身での名前（言語の切り替えに出す）
  htmlLang: string; // <html lang> と hreflang の値
  ogLocale: string; // OGP の og:locale
  intl: string; // 日付・数値の書式（Intl）
  published: boolean;
  /** 翻訳が無い項目を補う言語（null は補わない＝原文の言語） */
  fallback: SupportedLocale | null;
};

// 欧州 4 言語は Phase 2 以降で順に公開する（2026-11-28 決定: 10 言語ではなく欧州の代表言語に絞る）
export const localeRegistry: readonly LocaleConfig[] = [
  { code: "ja", nativeName: "日本語", htmlLang: "ja", ogLocale: "ja_JP", intl: "ja-JP", published: true, fallback: null },
  { code: "en", nativeName: "English", htmlLang: "en", ogLocale: "en_US", intl: "en-US", published: true, fallback: null },
  { code: "de", nativeName: "Deutsch", htmlLang: "de", ogLocale: "de_DE", intl: "de-DE", published: false, fallback: "en" },
  { code: "fr", nativeName: "Français", htmlLang: "fr", ogLocale: "fr_FR", intl: "fr-FR", published: false, fallback: "en" },
  { code: "es", nativeName: "Español", htmlLang: "es", ogLocale: "es_ES", intl: "es-ES", published: false, fallback: "en" },
  { code: "it", nativeName: "Italiano", htmlLang: "it", ogLocale: "it_IT", intl: "it-IT", published: false, fallback: "en" },
];

/** 公開中の言語。言語を公開するときは、localeRegistry の published と、ここの両方を変える */
export const locales = ["ja", "en"] as const;
export type Locale = (typeof locales)[number];

export const defaultLocale: Locale = "ja";
export const supportedLocales: readonly SupportedLocale[] = localeRegistry.map((l) => l.code);

// 本人が明示的に選んだ言語を保存する Cookie。.htaccess の振り分けでもこの名前を参照する
export const LOCALE_COOKIE = "sonaria_lang";

export function isLocale(value: string): value is Locale {
  return (locales as readonly string[]).includes(value);
}

export function localeConfig(code: SupportedLocale): LocaleConfig {
  const c = localeRegistry.find((l) => l.code === code);
  if (!c) throw new Error(`unknown locale: ${code}`);
  return c;
}

// /ja/scores/ → /scores/ のように、先頭の言語部分を取り除く（未公開の言語の URL も対象）
const LOCALE_PREFIX = new RegExp(`^/(${supportedLocales.map((c) => c.replace("-", "\\-")).join("|")})(?=/|$)`);
export function stripLocale(pathname: string): string {
  const rest = pathname.replace(LOCALE_PREFIX, "");
  return rest === "" ? "/" : rest;
}

export function localizedPath(locale: Locale, path: string): string {
  const normalized = path.startsWith("/") ? path : `/${path}`;
  return `/${locale}${normalized}`;
}

/** 言語ごとの文（ja・en は必須、他は任意） */
export type LocalizedText = { ja: string; en: string } & Partial<Record<SupportedLocale, string>>;

/** その言語の文。無ければ補う言語 → 英語 → 日本語の順。補ったかどうかも返す（原文であることを示すため） */
export function pickLocalized(text: LocalizedText, locale: SupportedLocale): { text: string; locale: SupportedLocale; fallback: boolean } {
  const chain: SupportedLocale[] = [locale];
  const fb = localeRegistry.find((l) => l.code === locale)?.fallback;
  if (fb) chain.push(fb);
  chain.push("en", "ja");
  for (const c of chain) {
    const v = text[c];
    if (v && v.trim()) return { text: v, locale: c, fallback: c !== locale };
  }
  return { text: "", locale, fallback: true };
}

/**
 * hreflang の対応表（言語 → URL）。存在する言語だけを入れ、全ページで同じ表になる（相互参照）。
 * x-default は言語を自動で振り分けるトップ（/）ではなく、各ページの既定言語（日本語）の URL を指す。
 */
export function alternateLanguages(path: string, available: readonly Locale[], toUrl: (p: string) => string | null): Record<string, string> {
  const out: Record<string, string> = {};
  const list = locales.filter((l) => available.includes(l));
  if (list.length < 2) return out;
  for (const l of list) {
    const u = toUrl(`/${l}${path}`);
    if (u) out[localeConfig(l).htmlLang] = u;
  }
  const def = list.includes(defaultLocale) ? defaultLocale : list[0];
  const d = toUrl(`/${def}${path}`);
  if (d && Object.keys(out).length > 1) out["x-default"] = d;
  return out;
}
