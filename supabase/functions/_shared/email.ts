// メール送信（Resend）。API キーは Edge Function の環境変数だけに置く。
// 設定がないときは送信したふりをせず "not_configured" を返す。

export type SendResult = "sent" | "failed" | "not_configured";

export async function sendEmail(params: { to: string; subject: string; text: string }): Promise<SendResult> {
  const apiKey = Deno.env.get("RESEND_API_KEY");
  if (!apiKey) return "not_configured";
  // 送信元ドメインを認証するまでは Resend のテスト用アドレス（自分のアドレスにしか届かない）
  const from = Deno.env.get("MAIL_FROM") ?? "SONARIA <onboarding@resend.dev>";
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from, to: [params.to], subject: params.subject, text: params.text }),
    });
    if (!res.ok) {
      console.error("resend error", res.status, await res.text());
      return "failed";
    }
    return "sent";
  } catch (e) {
    console.error("resend exception", e);
    return "failed";
  }
}
