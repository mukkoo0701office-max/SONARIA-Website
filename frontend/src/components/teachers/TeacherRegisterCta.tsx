import Link from "next/link";
import { getDictionary } from "@/data/dictionaries";
import { pagePaths } from "@/data/site";
import { localizedPath, type Locale } from "@/lib/i18n";

// 講師検索の近くに置く「講師として無料登録」の案内（PR #24 §2）。
// 広告と誤認させないよう、サイトの通常の配色・枠で表示する。compact はトップページ用（1 行に収める）
export default function TeacherRegisterCta({ locale, compact = false }: { locale: Locale; compact?: boolean }) {
  const t = getDictionary(locale).teacherRegister.cta;
  const href = localizedPath(locale, pagePaths.teacherRegister);

  if (compact) {
    return (
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-control border border-line bg-paper px-4 py-3">
        <p className="text-[13px] leading-relaxed">
          <span className="font-bold">{t.heading}</span>
          <span className="ml-2 text-muted">{t.body}</span>
        </p>
        <Link href={href} className="shrink-0 rounded-button border border-navy bg-card px-4 py-2 text-[13px] font-semibold text-navy hover:bg-subtle">
          {t.button}
        </Link>
      </div>
    );
  }

  return (
    <aside aria-labelledby="teacher-register-cta" className="flex flex-col gap-3 rounded-card border border-line bg-card p-5 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <h2 id="teacher-register-cta" className="text-base font-bold">
          {t.heading}
        </h2>
        <p className="mt-1 text-[13px] leading-relaxed text-muted">{t.body}</p>
      </div>
      <Link href={href} className="shrink-0 self-start rounded-button bg-navy px-5 py-3 text-[14px] font-bold text-white hover:brightness-110 sm:self-center">
        {t.button}
      </Link>
    </aside>
  );
}
