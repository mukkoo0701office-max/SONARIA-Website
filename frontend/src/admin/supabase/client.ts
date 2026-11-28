// 管理画面から Supabase に接続する最小限のクライアント（ライブラリを使わず fetch だけで実装）。
// - ログイン: Supabase Auth のメールアドレス＋パスワード。パスワードは Supabase 側で照合し、ブラウザには保存しない
// - セッション: アクセストークンと更新用トークンを sessionStorage に置く（タブを閉じると消える）
// - データ: PostgREST（/rest/v1）。読める範囲はデータベースの RLS（管理人だけ）で決まる
// URL と公開キーは公開してよい値。秘密キー（secret / service_role）は使わない

const RAW_URL = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").trim();
const URL_BASE = (RAW_URL && !/^https?:\/\//.test(RAW_URL) ? `https://${RAW_URL}` : RAW_URL).replace(/\/$/, "");
const KEY = (process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "").trim();
const STORE = "sonaria-admin-sb-session";

export const isSupabaseConfigured = () => URL_BASE !== "" && KEY !== "";

type StoredSession = { accessToken: string; refreshToken: string; expiresAt: number; email: string };

function load(): StoredSession | null {
  try {
    const raw = sessionStorage.getItem(STORE);
    return raw ? (JSON.parse(raw) as StoredSession) : null;
  } catch {
    return null;
  }
}
function save(s: StoredSession | null) {
  try {
    if (s) sessionStorage.setItem(STORE, JSON.stringify(s));
    else sessionStorage.removeItem(STORE);
  } catch {
    // 保存できない環境では、そのページ内だけログイン状態になる
  }
}

type TokenResponse = { access_token: string; refresh_token: string; expires_in: number; user?: { email?: string } };

async function token(grant: "password" | "refresh_token", body: Record<string, string>): Promise<{ ok: true; data: TokenResponse } | { ok: false; status: number }> {
  const res = await fetch(`${URL_BASE}/auth/v1/token?grant_type=${grant}`, {
    method: "POST",
    headers: { apikey: KEY, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) return { ok: false, status: res.status };
  return { ok: true, data: (await res.json()) as TokenResponse };
}

function store(data: TokenResponse, fallbackEmail = ""): StoredSession {
  const s = { accessToken: data.access_token, refreshToken: data.refresh_token, expiresAt: Date.now() + data.expires_in * 1000, email: data.user?.email ?? fallbackEmail };
  save(s);
  return s;
}

export type SignInResult = { status: "ok" } | { status: "invalid" } | { status: "locked"; retryAfterSeconds: number } | { status: "error"; message: string };

export async function signIn(email: string, password: string): Promise<SignInResult> {
  try {
    const r = await token("password", { email, password });
    if (r.ok) {
      store(r.data, email);
      return { status: "ok" };
    }
    if (r.status === 400 || r.status === 401) return { status: "invalid" };
    if (r.status === 429) return { status: "locked", retryAfterSeconds: 60 };
    return { status: "error", message: `HTTP ${r.status}` };
  } catch (e) {
    return { status: "error", message: e instanceof Error ? e.message : "network" };
  }
}

export async function signOut(): Promise<void> {
  const s = load();
  save(null);
  if (s) {
    await fetch(`${URL_BASE}/auth/v1/logout`, { method: "POST", headers: { apikey: KEY, Authorization: `Bearer ${s.accessToken}` } }).catch(() => undefined);
  }
}

/** 有効なセッション（期限が近ければ更新する）。無ければ null */
export async function currentSupabaseSession(): Promise<StoredSession | null> {
  const s = load();
  if (!s) return null;
  if (s.expiresAt - Date.now() > 60_000) return s;
  try {
    const r = await token("refresh_token", { refresh_token: s.refreshToken });
    if (!r.ok) {
      save(null);
      return null;
    }
    return store(r.data, s.email);
  } catch {
    return null;
  }
}

export class SupabaseError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

/** PostgREST へのリクエスト（ログイン中の管理人の権限で） */
export async function rest<T>(path: string, init: { method?: string; body?: unknown; headers?: Record<string, string> } = {}): Promise<T> {
  const s = await currentSupabaseSession();
  if (!s) throw new SupabaseError(401, "no_session");
  const res = await fetch(`${URL_BASE}/rest/v1/${path}`, {
    method: init.method ?? "GET",
    headers: { apikey: KEY, Authorization: `Bearer ${s.accessToken}`, "Content-Type": "application/json", ...init.headers },
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
  });
  if (!res.ok) throw new SupabaseError(res.status, await res.text().catch(() => ""));
  const text = await res.text();
  return (text ? JSON.parse(text) : null) as T;
}

/** 非公開ストレージのファイルを短時間だけ開ける URL（管理人の権限で発行。読めるのは管理人だけ: storage のポリシー） */
export async function signedFileUrl(bucket: string, path: string, expiresIn = 300): Promise<string> {
  const s = await currentSupabaseSession();
  if (!s) throw new SupabaseError(401, "no_session");
  const res = await fetch(`${URL_BASE}/storage/v1/object/sign/${bucket}/${path}`, {
    method: "POST",
    headers: { apikey: KEY, Authorization: `Bearer ${s.accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({ expiresIn }),
  });
  if (!res.ok) throw new SupabaseError(res.status, await res.text().catch(() => ""));
  const data = (await res.json()) as { signedURL?: string; signedUrl?: string };
  const u = data.signedURL ?? data.signedUrl;
  if (!u) throw new SupabaseError(500, "no_url");
  return u.startsWith("http") ? u : `${URL_BASE}/storage/v1${u}`;
}

/** ログイン中のユーザーが管理人（public.admins）か */
export async function isAdmin(): Promise<boolean> {
  try {
    return (await rest<boolean>("rpc/is_admin", { method: "POST", body: {} })) === true;
  } catch {
    return false;
  }
}
