"use client";

// 管理画面の共通の状態（言語・データの窓口・セッション）。
// すべてブラウザ側で動き、静的な HTML にはデータを書き出さない（ページの中身はマウント後に描く）

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { adminAuth, type Session } from "./auth";
import { createDemoRepository } from "./demo/demoRepository";
import { createSupabaseRepository } from "./supabase/supabaseRepository";
import { adminCopy, type AdminCopy } from "./i18n";
import type { AdminRepository } from "./repository";
import type { Locale } from "./types";

type Ctx = {
  locale: Locale;
  setLocale: (l: Locale) => void;
  t: AdminCopy;
  repo: AdminRepository | null; // セッションが無い間は null
  session: Session;
  ready: boolean;
  refreshSession: () => Promise<void>;
};

const AdminCtx = createContext<Ctx | null>(null);
const LOCALE_KEY = "sonaria-admin-locale";

export function AdminProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>("ja");
  const [session, setSession] = useState<Session>(null);
  const [ready, setReady] = useState(false);

  const refreshSession = useCallback(async () => {
    setSession(await adminAuth.currentSession());
    setReady(true);
  }, []);

  useEffect(() => {
    // 言語: ?lang=en ＞ 前回の選択 ＞ 日本語
    const q = new URLSearchParams(window.location.search).get("lang");
    let saved: string | null = null;
    try {
      saved = localStorage.getItem(LOCALE_KEY);
    } catch {
      saved = null;
    }
    const l = q === "en" || q === "ja" ? q : saved === "en" ? "en" : "ja";
    setLocaleState(l);
    document.documentElement.lang = l;
    void refreshSession();
  }, [refreshSession]);

  const setLocale = useCallback((l: Locale) => {
    setLocaleState(l);
    document.documentElement.lang = l;
    try {
      localStorage.setItem(LOCALE_KEY, l);
    } catch {
      // 保存できなくても切り替えは効く
    }
  }, []);

  // デモのセッションはデモのデータ、管理人としてログインしたら Supabase の実データ
  const repo = useMemo<AdminRepository | null>(() => (session?.kind === "demo" ? createDemoRepository() : session?.kind === "server" ? createSupabaseRepository() : null), [session]);

  const value = useMemo(() => ({ locale, setLocale, t: adminCopy[locale], repo, session, ready, refreshSession }), [locale, setLocale, repo, session, ready, refreshSession]);
  return <AdminCtx.Provider value={value}>{children}</AdminCtx.Provider>;
}

export function useAdmin(): Ctx {
  const ctx = useContext(AdminCtx);
  if (!ctx) throw new Error("useAdmin must be used inside AdminProvider");
  return ctx;
}

/** リポジトリから読み込む（読み込み中・空・エラーの状態つき） */
export function useAdminData<T>(load: (repo: AdminRepository) => Promise<T>, deps: unknown[] = []) {
  const { repo } = useAdmin();
  const [state, setState] = useState<{ status: "loading" | "ready" | "error"; data?: T }>({ status: "loading" });
  const [nonce, setNonce] = useState(0);
  useEffect(() => {
    if (!repo) return;
    let alive = true;
    setState((s) => ({ status: "loading", data: s.data }));
    load(repo)
      .then((data) => alive && setState({ status: "ready", data }))
      .catch(() => alive && setState({ status: "error" }));
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [repo, nonce, ...deps]);
  return { ...state, reload: () => setNonce((n) => n + 1) };
}
