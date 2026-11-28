"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useAdmin } from "./AdminContext";
import { adminAuth } from "./auth";
import { adminRoutes } from "./ui";

type Section = "dashboard" | "inquiries" | "calendar" | "teachers" | "revenue" | "prices" | "ads" | "analytics" | "pdf" | "notifications";
const sections: Section[] = ["dashboard", "inquiries", "calendar", "teachers", "revenue", "prices", "ads", "analytics", "pdf", "notifications"];

// 管理画面の共通レイアウト。セッションが無ければログイン画面へ戻す。
// 注: これは画面の出し分けで、アクセス制御ではない。本当の制御はサーバー側（管理者 API がセッションを検証）で行う
export default function AdminShell({ children }: { children: React.ReactNode }) {
  const { t, locale, setLocale, session, ready, refreshSession } = useAdmin();
  const router = useRouter();
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    if (ready && !session) router.replace(adminRoutes.login);
  }, [ready, session, router]);

  useEffect(() => setMenuOpen(false), [pathname]);

  if (!ready || !session) {
    return (
      <div role="status" className="grid min-h-dvh place-items-center text-[13px] text-muted">
        {t.common.loading}
      </div>
    );
  }

  const current = sections.find((s) => pathname?.includes(`/admin/${s}`)) ?? "dashboard";

  async function logout() {
    await adminAuth.logout();
    await refreshSession();
    router.replace(adminRoutes.login);
  }

  const nav = (
    <nav aria-label={t.menu}>
      <ul className="grid gap-0.5">
        {sections.map((s) => (
          <li key={s}>
            <Link
              href={adminRoutes[s]}
              aria-current={current === s ? "page" : undefined}
              className={`block rounded-control px-3 py-2 text-[14px] ${current === s ? "bg-navy font-semibold text-white" : "text-ink hover:bg-subtle"}`}
            >
              {t.nav[s]}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );

  return (
    <div className="min-h-dvh bg-paper">
      {session.kind === "demo" && (
        <div role="note" className="border-b border-[#f5cf7a] bg-[#fff8e6] px-4 py-2 text-[12px] leading-relaxed text-[#6b4a00]">
          <span className="mr-2 rounded-full border border-[#f5cf7a] bg-card px-2 py-0.5 font-bold">{t.common.demo}</span>
          {t.demoBanner}
        </div>
      )}
      <header className="sticky top-0 z-30 border-b border-line bg-card/95 backdrop-blur">
        <div className="mx-auto flex max-w-[1400px] items-center justify-between gap-2 px-3 py-3 sm:gap-3 sm:px-4">
          <div className="flex min-w-0 items-center gap-2 sm:gap-3">
            <button
              type="button"
              className="whitespace-nowrap rounded-control border border-line px-2.5 py-1.5 text-[13px] lg:hidden"
              aria-expanded={menuOpen}
              aria-controls="admin-mobile-nav"
              onClick={() => setMenuOpen((o) => !o)}
            >
              {t.menu}
            </button>
            {/* 仮: ロゴの原本が来るまでテキストのロゴ（CLAUDE.md） */}
            <Link href={adminRoutes.dashboard} className="font-brand text-lg tracking-[0.12em] text-navy">
              SONARIA <span className="ml-1 hidden align-middle font-sans text-[12px] tracking-normal text-muted sm:inline">{t.brand.replace("SONARIA ", "")}</span>
            </Link>
          </div>
          <div className="flex flex-none items-center gap-1.5 sm:gap-2">
            <button type="button" onClick={() => setLocale(locale === "ja" ? "en" : "ja")} className="whitespace-nowrap rounded-control border border-line px-2.5 py-1.5 text-[13px] hover:bg-subtle sm:px-3" lang={locale === "ja" ? "en" : "ja"}>
              {t.langSwitch}
            </button>
            <button type="button" onClick={logout} className="whitespace-nowrap rounded-control border border-navy px-2.5 py-1.5 text-[13px] text-navy hover:bg-subtle sm:px-3">
              {t.logout}
            </button>
          </div>
        </div>
        {menuOpen && (
          <div id="admin-mobile-nav" className="border-t border-line bg-card px-4 py-3 lg:hidden">
            {nav}
          </div>
        )}
      </header>
      <div className="mx-auto grid max-w-[1400px] gap-6 px-4 py-6 lg:grid-cols-[220px_1fr]">
        <aside className="hidden lg:block">
          <div className="sticky top-20">{nav}</div>
        </aside>
        <main id="admin-main" className="min-w-0">
          {children}
        </main>
      </div>
    </div>
  );
}
