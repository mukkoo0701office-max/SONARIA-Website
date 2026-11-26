import Link from "next/link";
import { getDictionary } from "@/data/dictionaries";
import { navItems } from "@/data/site";
import { localizedPath, type Locale } from "@/lib/i18n";
import LanguageSwitcher from "./LanguageSwitcher";

export default function Header({ locale }: { locale: Locale }) {
  const dict = getDictionary(locale);

  return (
    <header className="border-b border-line pb-5 pt-2">
      <div className="flex items-center justify-between gap-3">
        {/* 仮: ロゴ原本が来るまでテキストのロゴ（似た画像を作って代用しない） */}
        <Link href={localizedPath(locale, "/")} className="block">
          <span className="block font-brand text-[25px] tracking-[0.06em] sm:text-[30px]">SONARIA</span>
          {/* ゴールドの小さい文字は白地で読みにくいため、ロゴの一部として aria-hidden にし、読み上げは本文に任せる */}
          <span className="block text-[10px] tracking-[0.2em] text-gold" aria-hidden="true">
            {dict.common.tagline}
          </span>
        </Link>
        <LanguageSwitcher locale={locale} label={dict.common.languageLabel} names={dict.common.languageNames} />
      </div>
      <nav aria-label={dict.nav.mainNavLabel} className="mt-4">
        <ul className="flex flex-wrap gap-x-5 gap-y-2 text-sm">
          {navItems.map((item) => (
            <li key={item.key}>
              <Link href={localizedPath(locale, item.path)} className="text-navy hover:underline">
                {dict.nav[item.key]}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </header>
  );
}
