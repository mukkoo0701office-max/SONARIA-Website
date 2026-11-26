// 申込の送信。送信先（NEXT_PUBLIC_ORDER_ENDPOINT）が設定されていない間は「未接続」を返し、送信できたように見せない。
// 静的書き出しのため API Routes は使わない。送信先の候補は docs/proposals/service-order-forms.md（PR #7 のバックエンドなど）

export type SubmitResult = { status: "sent" } | { status: "not_connected" } | { status: "error"; message: string };

export async function submitOrder(payload: unknown): Promise<SubmitResult> {
  const endpoint = process.env.NEXT_PUBLIC_ORDER_ENDPOINT;
  if (!endpoint) return { status: "not_connected" };
  try {
    const res = await fetch(endpoint, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    return res.ok ? { status: "sent" } : { status: "error", message: `HTTP ${res.status}` };
  } catch (e) {
    return { status: "error", message: e instanceof Error ? e.message : "network" };
  }
}
