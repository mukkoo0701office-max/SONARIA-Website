// 管理者の認証（クライアント側の窓口）。
// 【重要】パスワードの照合は必ずサーバー側で行う。このファイルには正解のパスワードもハッシュも置かない。
// 現在の方式: Supabase Auth（メールアドレス＋パスワード）。照合・試行回数の制限は Supabase 側で行う。
//   ログインできても、public.admins に登録された人でなければ管理人として扱わない（データも RLS で読めない）
//   将来は passkey（WebAuthn）や TOTP を 2 要素目として追加する（Supabase Auth の MFA）
// Supabase の URL・公開キーが未設定のビルドでは「未接続」を返す。

import { currentSupabaseSession, isAdmin, isSupabaseConfigured, signIn, signOut } from "./supabase/client";

export type LoginResult =
  | { status: "ok" }
  | { status: "invalid" } // メールアドレスかパスワードが違う
  | { status: "not_admin" } // ログインはできたが管理人として登録されていない
  | { status: "locked"; retryAfterSeconds: number } // 試行回数の上限
  | { status: "not_connected" } // 認証サーバー未接続
  | { status: "error"; message: string };

export type Session = { kind: "server"; adminName: string } | { kind: "demo" } | null;

export interface AdminAuth {
  login(email: string, password: string): Promise<LoginResult>;
  logout(): Promise<void>;
  currentSession(): Promise<Session>;
}

// デモ閲覧の印（プレビュー用ビルドだけ。sessionStorage なのでタブを閉じると消える）
const DEMO_KEY = "sonaria-admin-demo";

export function enterDemoSession() {
  try {
    sessionStorage.setItem(DEMO_KEY, "1");
  } catch {
    // 保存できない環境では、そのページ内だけデモ表示になる
  }
}

export const adminAuth: AdminAuth = {
  async login(email, password) {
    if (!email || !password) return { status: "invalid" };
    if (!isSupabaseConfigured()) return { status: "not_connected" };
    const r = await signIn(email.trim(), password);
    if (r.status !== "ok") return r;
    if (!(await isAdmin())) {
      await signOut();
      return { status: "not_admin" };
    }
    return { status: "ok" };
  },
  async logout() {
    try {
      sessionStorage.removeItem(DEMO_KEY);
    } catch {
      // 何もしない
    }
    if (isSupabaseConfigured()) await signOut();
  },
  async currentSession() {
    try {
      if (sessionStorage.getItem(DEMO_KEY) === "1") return { kind: "demo" };
    } catch {
      // 何もしない
    }
    if (!isSupabaseConfigured()) return null;
    const s = await currentSupabaseSession();
    if (!s) return null;
    if (!(await isAdmin())) return null;
    return { kind: "server", adminName: s.email };
  },
};

export const isAuthConnected = () => isSupabaseConfigured();
