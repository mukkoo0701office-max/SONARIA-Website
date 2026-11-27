// 管理者の認証（クライアント側の窓口）。
// 【重要】パスワードの照合は必ずサーバー側で行う。このファイルには正解のパスワードもハッシュも置かない。
// 設計（docs/admin/ADMIN_SYSTEM_DESIGN.md §2）:
//   POST {ADMIN_API}/auth/login  { password } → サーバーが Argon2id のハッシュと照合し、
//   Secure・HttpOnly・SameSite=Strict の Cookie でセッションを返す。試行回数はサーバー側で制限する。
//   将来は passkey（WebAuthn。Face ID / Touch ID）と TOTP を 2 要素目として追加する（AdminUser.authMethods）
// 現在はサーバーが無いため、ログインは常に「未接続」を返す。

export type LoginResult =
  | { status: "ok" }
  | { status: "invalid" } // パスワードが違う
  | { status: "locked"; retryAfterSeconds: number } // 試行回数の上限
  | { status: "not_connected" } // 認証サーバー未接続
  | { status: "error"; message: string };

export type Session = { kind: "server"; adminName: string } | { kind: "demo" } | null;

export interface AdminAuth {
  login(password: string): Promise<LoginResult>;
  logout(): Promise<void>;
  currentSession(): Promise<Session>;
}

// 管理者 API の URL。未設定 = 未接続。値はビルド時に埋め込まれるが、URL だけで秘密情報ではない
const ADMIN_API = process.env.NEXT_PUBLIC_ADMIN_API ?? "";

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
  async login(password) {
    if (!password) return { status: "invalid" };
    if (!ADMIN_API) return { status: "not_connected" };
    try {
      // credentials: "include" で HttpOnly Cookie を受け取る。パスワードは HTTPS で送るだけで、保存しない
      const res = await fetch(`${ADMIN_API}/auth/login`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      if (res.ok) return { status: "ok" };
      if (res.status === 401) return { status: "invalid" };
      if (res.status === 429) return { status: "locked", retryAfterSeconds: Number(res.headers.get("Retry-After") ?? 60) };
      return { status: "error", message: `HTTP ${res.status}` };
    } catch (e) {
      return { status: "error", message: e instanceof Error ? e.message : "network" };
    }
  },
  async logout() {
    try {
      sessionStorage.removeItem(DEMO_KEY);
    } catch {
      // 何もしない
    }
    if (ADMIN_API) await fetch(`${ADMIN_API}/auth/logout`, { method: "POST", credentials: "include" }).catch(() => undefined);
  },
  async currentSession() {
    try {
      if (sessionStorage.getItem(DEMO_KEY) === "1") return { kind: "demo" };
    } catch {
      // 何もしない
    }
    if (!ADMIN_API) return null;
    try {
      const res = await fetch(`${ADMIN_API}/auth/session`, { credentials: "include" });
      if (!res.ok) return null;
      const json = (await res.json()) as { name?: string };
      return { kind: "server", adminName: json.name ?? "" };
    } catch {
      return null;
    }
  },
};

export const isAuthConnected = () => ADMIN_API !== "";
