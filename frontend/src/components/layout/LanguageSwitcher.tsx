"use client";

import { usePathname, useRouter } from "next/navigation";
import { LOCALE_COOKIE, locales, stripLocale, type Locale } from "@/lib/i18n";

type Props = {
  locale: Locale;
  label: string;
  names: Record<Locale, string>;
};

export default function LanguageSwitcher({ locale, label, names }: Props) {
  const pathname = usePathname();
  const router = useRouter();

  function handleChange(event: React.ChangeEvent<HTMLSelectElement>) {
    const next = event.target.value as Locale;
    // 本人が選んだ言語を保存し、次回以降は自動判定より優先する（.htaccess も同じ Cookie を見る）
    document.cookie = `${LOCALE_COOKIE}=${next}; path=/; max-age=31536000; samesite=lax`;
    // 同じページの別言語へ移動する。検索条件（クエリ）は引き継ぐ
    const rest = stripLocale(pathname);
    router.push(`/${next}${rest}${window.location.search}`);
  }

  return (
    <select
      aria-label={label}
      value={locale}
      onChange={handleChange}
      className="w-auto rounded-control border border-line bg-card px-3 py-2.5 text-sm text-ink"
    >
      {locales.map((code) => (
        <option key={code} value={code} lang={code}>
          {names[code]}
        </option>
      ))}
    </select>
  );
}
