// ローカル Supabase に対する結合テスト（CI 専用。本番には接続しない）
// 必要な環境変数: API_URL, DB_URL, ANON_KEY（supabase status -o env）, ORIGIN（関数に許可させた Origin）
import { execFileSync } from "node:child_process";
import assert from "node:assert/strict";

const { API_URL, DB_URL, ANON_KEY, ORIGIN } = process.env;
for (const [k, v] of Object.entries({ API_URL, DB_URL, ANON_KEY, ORIGIN })) if (!v) throw new Error(`${k} is not set`);
const endpoint = `${API_URL}/functions/v1/submit`;

const psql = (q) => execFileSync("psql", [DB_URL, "-tAc", q], { encoding: "utf8" }).trim();
const post = (body, { key = crypto.randomUUID(), origin = ORIGIN, ip = "203.0.113.1" } = {}) =>
  fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json", apikey: ANON_KEY, "Idempotency-Key": key, Origin: origin, "X-Forwarded-For": ip },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });

const lesson = {
  service: "lesson",
  locale: "ja",
  estimateTotal: 6000,
  lesson: { trialTaken: true, plan: "single", candidates: [{ date: "2026-12-01", slot: "evening" }] },
  customer: { name: "テスト 花子", email: "hanako@example.com", remarks: "結合テスト" },
};
const performance = {
  kind: "performance_quote",
  locale: "en",
  schedule: { mode: "undecided", dates: [], period: "spring" },
  budget: "100k_200k",
  ensemble: "quartet",
  contact: { name: "Alex", email: "alex@example.com" },
  consent: true,
};
const teacher = {
  kind: "teacher_application",
  locale: "ja",
  public: { displayName: "テスト講師", instruments: ["violin"] },
  private: { legalName: "テスト 太郎", email: "taro@example.com" },
  agreements: { eligibility: true, publish: true, privacy: true },
};

let failed = 0;
async function check(name, fn) {
  try {
    await fn();
    console.log(`OK   ${name}`);
  } catch (e) {
    failed++;
    console.log(`NG   ${name} — ${e.message}`);
  }
}

await check("ブラウザのプリフライトに CORS ヘッダーを返す", async () => {
  // ゲートウェイがプリフライトに 200 で応答する場合がある（ブラウザは 200／204 のどちらも受け付ける）。
  // Origin の制限は POST で関数が判定する（下の「許可されていない Origin を拒否する」）
  const r = await fetch(endpoint, {
    method: "OPTIONS",
    headers: { Origin: ORIGIN, "Access-Control-Request-Method": "POST", "Access-Control-Request-Headers": "content-type,apikey,idempotency-key" },
  });
  assert.ok(r.status === 200 || r.status === 204, `status ${r.status}`);
  assert.ok([ORIGIN, "*"].includes(r.headers.get("access-control-allow-origin")), `allow-origin ${r.headers.get("access-control-allow-origin")}`);
});

await check("3 種類のフォームを保存し、受付番号を返す", async () => {
  for (const [body, kind] of [[lesson, "lesson"], [performance, "performance_quote"], [teacher, "teacher_application"]]) {
    const r = await post(body, { ip: `198.51.100.${kind.length}` });
    const j = await r.json();
    assert.equal(r.status, 200, JSON.stringify(j));
    assert.match(j.receipt, /^SN-\d{6}-[0-9A-F]{5}$/);
    assert.equal(psql(`select kind from public.submissions where receipt_no = '${j.receipt}'`), kind);
  }
  assert.equal(psql(`select client_estimate from public.submissions where kind = 'lesson'`), "6000");
});

await check("同じ送信 ID の再送は 1 件だけ保存し、同じ受付番号を返す", async () => {
  const key = crypto.randomUUID();
  const [a, b] = await Promise.all([post(lesson, { key, ip: "192.0.2.10" }), post(lesson, { key, ip: "192.0.2.10" })]);
  const [ja, jb] = [await a.json(), await b.json()];
  assert.equal(a.status, 200);
  assert.equal(b.status, 200);
  assert.equal(ja.receipt, jb.receipt);
  assert.equal(psql(`select count(*) from public.submissions where idempotency_key = '${key}'`), "1");
});

await check("入力の不備は 400 で、保存しない", async () => {
  const before = psql("select count(*) from public.submissions");
  const r = await post({ ...lesson, customer: { name: "", email: "bad" } }, { ip: "192.0.2.20" });
  assert.equal(r.status, 400);
  const r2 = await post("{not json", { ip: "192.0.2.20" });
  assert.equal(r2.status, 400);
  assert.equal(psql("select count(*) from public.submissions"), before);
});

await check("送信 ID のない送信と、許可されていない Origin を拒否する", async () => {
  const r = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: ORIGIN },
    body: JSON.stringify(lesson),
  });
  assert.equal(r.status, 400);
  const r2 = await post(lesson, { origin: "https://evil.example", ip: "192.0.2.30" });
  assert.equal(r2.status, 403);
});

await check("同じ送信元からの送信が多すぎると 429 を返す", async () => {
  const limit = Number(process.env.RATE_LIMIT_PER_HOUR ?? "5");
  const statuses = [];
  for (let i = 0; i < limit + 1; i++) statuses.push((await post(lesson, { ip: "192.0.2.99" })).status);
  assert.deepEqual(statuses.slice(0, limit), Array(limit).fill(200));
  assert.equal(statuses[limit], 429);
});

await check("IP は平文で保存しない", async () => {
  assert.equal(psql("select count(*) from private.rate_limits where ip_hash like '%192.0.2%'"), "0");
});

await check("一般利用者（anon キー）は申し込みデータを API から読めない", async () => {
  const r = await fetch(`${API_URL}/rest/v1/submissions?select=*`, { headers: { apikey: ANON_KEY, Authorization: `Bearer ${ANON_KEY}` } });
  const text = await r.text();
  assert.ok(r.status === 401 || r.status === 403 || text === "[]", `status ${r.status}: ${text.slice(0, 120)}`);
  assert.ok(!text.includes("example.com"));
});

await check("一般利用者は受付処理の関数を API から直接呼べない", async () => {
  const r = await fetch(`${API_URL}/rest/v1/rpc/accept_submission`, {
    method: "POST",
    headers: { apikey: ANON_KEY, Authorization: `Bearer ${ANON_KEY}`, "Content-Type": "application/json" },
    body: "{}",
  });
  assert.notEqual(r.status, 200);
});

await check("停止防止用の ping は一般利用者が呼べる", async () => {
  const r = await fetch(`${API_URL}/rest/v1/rpc/ping`, { method: "POST", headers: { apikey: ANON_KEY, "Content-Type": "application/json" }, body: "{}" });
  assert.equal(r.status, 200);
  assert.equal(await r.text(), "true");
});

console.log(failed ? `${failed} failed` : "all passed");
process.exit(failed ? 1 : 0);
