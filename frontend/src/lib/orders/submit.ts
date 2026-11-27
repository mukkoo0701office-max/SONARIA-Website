// 申込・問い合わせの送信。送信先が設定されていない間は「未接続」を返し、送信できたように見せない。
// 静的書き出しのため API Routes は使わない。送信先の候補は docs/proposals/service-order-forms.md（PR #7 のバックエンドなど）
// 注: NEXT_PUBLIC_* はビルド時に文字列へ置き換わるため、process.env.XXX と直接書く（動的に参照すると置き換わらない）

export type SubmitResult = { status: "sent" } | { status: "not_connected" } | { status: "error"; message: string };

async function postJson(endpoint: string | undefined, payload: unknown): Promise<SubmitResult> {
  if (!endpoint) return { status: "not_connected" };
  try {
    const res = await fetch(endpoint, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    return res.ok ? { status: "sent" } : { status: "error", message: `HTTP ${res.status}` };
  } catch (e) {
    return { status: "error", message: e instanceof Error ? e.message : "network" };
  }
}

/** サービスの統合申込（レッスン／運指・運弓／録音） */
export function submitOrder(payload: unknown): Promise<SubmitResult> {
  return postJson(process.env.NEXT_PUBLIC_ORDER_ENDPOINT, payload);
}

/** 演奏依頼の見積もり依頼。未設定なら統合申込の送信先を使う（同じバックエンドで受ける想定） */
export function submitPerformanceQuote(payload: unknown): Promise<SubmitResult> {
  return postJson(process.env.NEXT_PUBLIC_PERFORMANCE_ENDPOINT || process.env.NEXT_PUBLIC_ORDER_ENDPOINT, payload);
}

/** 講師の登録申請。個人情報（本人確認用の情報）を含むため、統合申込とは別の送信先にする */
export function submitTeacherApplication(payload: unknown): Promise<SubmitResult> {
  return postJson(process.env.NEXT_PUBLIC_TEACHER_APPLICATION_ENDPOINT, payload);
}
