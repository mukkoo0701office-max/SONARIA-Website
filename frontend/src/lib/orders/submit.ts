// 申込・依頼・講師登録の送信。送信先は Supabase の受付関数（supabase/functions/submit）。
// Supabase の URL と公開キーが設定されていない間は「未接続」を返し、送信できたように見せない。
// 静的書き出しのため API Routes は使わない。
// 注: NEXT_PUBLIC_* はビルド時に文字列へ置き換わるため、process.env.XXX と直接書く（動的に参照すると置き換わらない）

export type SubmitResult =
  | { status: "sent"; receipt?: string }
  | { status: "not_connected" }
  | { status: "error"; message: string };

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const PUBLISHABLE_KEY = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "";

/** 受付関数の URL。未設定なら undefined（未接続） */
export function submitEndpoint(): string | undefined {
  if (!SUPABASE_URL || !PUBLISHABLE_KEY) return undefined;
  return `${SUPABASE_URL.replace(/\/$/, "")}/functions/v1/submit`;
}

// 二重送信防止: 同じ内容の再送（通信エラー後の再試行・連打）には同じ送信 ID を使い、サーバー側で 1 件にまとめる
const keys = new Map<string, string>();
function idempotencyKey(body: string): string {
  let key = keys.get(body);
  if (!key) {
    key = crypto.randomUUID();
    keys.set(body, key);
  }
  return key;
}

async function post(payload: unknown): Promise<SubmitResult> {
  const endpoint = submitEndpoint();
  if (!endpoint) return { status: "not_connected" };
  const body = JSON.stringify(payload);
  try {
    const res = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: PUBLISHABLE_KEY, "Idempotency-Key": idempotencyKey(body) },
      body,
    });
    if (!res.ok) return { status: "error", message: `HTTP ${res.status}` };
    const data = (await res.json().catch(() => ({}))) as { receipt?: unknown };
    return { status: "sent", receipt: typeof data.receipt === "string" ? data.receipt : undefined };
  } catch (e) {
    return { status: "error", message: e instanceof Error ? e.message : "network" };
  }
}

/** サービスの統合申込（レッスン／運指・運弓／録音） */
export function submitOrder(payload: unknown): Promise<SubmitResult> {
  return post(payload);
}

/** 演奏依頼の見積もり依頼 */
export function submitPerformanceQuote(payload: unknown): Promise<SubmitResult> {
  return post(payload);
}

/** 講師の登録申請（本人確認用の情報は管理人だけが読める） */
export function submitTeacherApplication(payload: unknown): Promise<SubmitResult> {
  return post(payload);
}
