"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useAdmin } from "../AdminContext";
import { adminAuth, enterDemoSession, isAuthConnected, type LoginResult } from "../auth";
import { adminRoutes, Badge, buttonPrimary, buttonSecondary, inputClass } from "../ui";

export default function LoginView() {
  const { t, locale, setLocale, session, ready, refreshSession } = useAdmin();
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [result, setResult] = useState<LoginResult | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (ready && session) router.replace(adminRoutes.dashboard);
  }, [ready, session, router]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const r = await adminAuth.login(password);
    setBusy(false);
    setPassword(""); // 入力したパスワードを画面に残さない
    setResult(r);
    if (r.status === "ok") {
      await refreshSession();
      router.replace(adminRoutes.dashboard);
    }
  }

  async function demo() {
    enterDemoSession();
    await refreshSession();
    router.replace(adminRoutes.dashboard);
  }

  const message =
    result?.status === "invalid"
      ? t.login.invalid
      : result?.status === "locked"
        ? t.login.locked(result.retryAfterSeconds)
        : result?.status === "not_connected"
          ? t.login.notConnected
          : result?.status === "error"
            ? t.login.error
            : null;

  return (
    <div className="grid min-h-dvh place-items-center bg-paper px-4 py-10">
      <div className="w-full max-w-[420px]">
        <div className="mb-4 flex justify-end">
          <button type="button" onClick={() => setLocale(locale === "ja" ? "en" : "ja")} className="rounded-control border border-line bg-card px-3 py-1.5 text-[13px]">
            {t.langSwitch}
          </button>
        </div>
        <div className="rounded-card border border-line bg-card p-6 sm:p-8">
          {/* 仮: ロゴの原本が来るまでテキストのロゴ（CLAUDE.md） */}
          <p className="text-center font-brand text-2xl tracking-[0.14em] text-navy">SONARIA</p>
          <h1 className="mt-4 text-center text-lg font-bold">{t.login.title}</h1>
          <p className="mt-1 text-center text-[13px] text-muted">{t.login.lead}</p>

          <form onSubmit={submit} className="mt-6 grid gap-3" noValidate>
            <label htmlFor="admin-password" className="text-[13px] font-semibold">
              {t.login.password}
            </label>
            <input
              id="admin-password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              aria-invalid={result?.status === "invalid"}
              aria-describedby={message ? "admin-login-msg" : undefined}
              className={inputClass}
            />
            {message && (
              <p id="admin-login-msg" role="alert" className="rounded-control border border-[#f2a7a7] bg-[#fdeeee] p-3 text-[13px] leading-relaxed">
                {message}
              </p>
            )}
            <button type="submit" disabled={busy || !password} className={`${buttonPrimary} py-3`}>
              {busy ? t.login.submitting : t.login.submit}
            </button>
            {!isAuthConnected() && (
              <p className="text-center">
                <Badge tone="warn">{t.common.notConnected}</Badge>
              </p>
            )}
          </form>
          <p className="mt-5 text-[12px] leading-relaxed text-muted">{t.login.security}</p>
        </div>

        {/* デモ閲覧: このビルド（SONARIA_ADMIN_PREVIEW=1）にだけ存在する。本番ビルドには管理画面自体が無い */}
        <div className="mt-4 rounded-card border border-dashed border-muted bg-card p-5">
          <p className="text-[14px] font-bold">{t.login.demoTitle}</p>
          <p className="mt-1 text-[12px] leading-relaxed text-muted">{t.login.demoLead}</p>
          <button type="button" onClick={demo} className={`${buttonSecondary} mt-3 w-full`}>
            {t.login.demoButton}
          </button>
        </div>
      </div>
    </div>
  );
}
