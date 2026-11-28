// ローカル Supabase に対する結合テスト（CI 専用。本番には接続しない）
// 必要な環境変数: API_URL, DB_URL, ANON_KEY（supabase status -o env）, ORIGIN（関数に許可させた Origin）
import { execFileSync } from "node:child_process";
import assert from "node:assert/strict";

const { API_URL, DB_URL, ANON_KEY, ORIGIN, SERVICE_ROLE_KEY } = process.env;
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

// ── 管理画面（管理人だけが読める・変えられる）──────────────────
async function createUser(email, password) {
  const r = await fetch(`${API_URL}/auth/v1/admin/users`, {
    method: "POST",
    headers: { apikey: SERVICE_ROLE_KEY, Authorization: `Bearer ${SERVICE_ROLE_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ email, password, email_confirm: true }),
  });
  const j = await r.json();
  if (!r.ok) throw new Error(`create user ${r.status} ${JSON.stringify(j)}`);
  return j.id;
}
async function signIn(email, password) {
  const r = await fetch(`${API_URL}/auth/v1/token?grant_type=password`, { method: "POST", headers: { apikey: ANON_KEY, "Content-Type": "application/json" }, body: JSON.stringify({ email, password }) });
  const j = await r.json();
  if (!r.ok) throw new Error(`sign in ${r.status}`);
  return j.access_token;
}
const asUser = (token) => (path, init = {}) =>
  fetch(`${API_URL}/rest/v1/${path}`, { ...init, headers: { apikey: ANON_KEY, Authorization: `Bearer ${token}`, "Content-Type": "application/json" } });

if (SERVICE_ROLE_KEY) {
  const adminId = await createUser("admin@example.com", "admin-pass-123456");
  await createUser("someone@example.com", "someone-pass-123456");
  psql(`insert into public.admins (user_id) values ('${adminId}')`);
  const admin = asUser(await signIn("admin@example.com", "admin-pass-123456"));
  const someone = asUser(await signIn("someone@example.com", "someone-pass-123456"));
  const targetId = psql("select id from public.submissions where kind = 'performance_quote' limit 1");

  await check("管理人は申し込みを読める・ログインしただけの人は読めない", async () => {
    const a = await (await admin("submissions?select=id,contact_email")).json();
    assert.ok(Array.isArray(a) && a.length > 0, JSON.stringify(a).slice(0, 100));
    const r = await someone("submissions?select=id,contact_email");
    const t = await r.text();
    assert.ok(r.status !== 200 || t === "[]", `status ${r.status}: ${t.slice(0, 100)}`);
  });

  await check("管理人は状態・既読・メモ・運営側の項目を変えられ、履歴が残る", async () => {
    const r = await admin("rpc/admin_update_submission", { method: "POST", body: JSON.stringify({ p_id: targetId, p_patch: { status: "quoted", read: true, admin_note: "見積送付済み", admin_data: { dueDate: "2027-01-10" } }, p_note: "見積を送った" }) });
    const j = await r.json();
    assert.equal(r.status, 200, JSON.stringify(j));
    assert.equal(j.status, "quoted");
    assert.ok(j.read_at);
    assert.equal(j.admin_note, "見積送付済み");
    assert.equal(j.admin_data.dueDate, "2027-01-10");
    assert.equal(psql(`select to_status || ':' || coalesce(note,'') from public.submission_events where submission_id = '${targetId}'`), "quoted:見積を送った");
    const ev = await (await admin(`submission_events?select=to_status&submission_id=eq.${targetId}`)).json();
    assert.equal(ev.length, 1);
  });

  await check("管理人でも、お客さんの入力内容（payload・氏名・連絡先）は変えられない", async () => {
    const before = psql(`select contact_name || payload::text from public.submissions where id = '${targetId}'`);
    await admin("rpc/admin_update_submission", { method: "POST", body: JSON.stringify({ p_id: targetId, p_patch: { contact_name: "改ざん", payload: {} } }) });
    const r = await admin(`submissions?id=eq.${targetId}`, { method: "PATCH", body: JSON.stringify({ contact_name: "改ざん" }) });
    assert.notEqual(r.status, 204, "direct PATCH must be refused");
    assert.equal(psql(`select contact_name || payload::text from public.submissions where id = '${targetId}'`), before);
  });

  await check("管理人以外は更新の関数を使えない・ありえない状態は拒否される", async () => {
    const r = await someone("rpc/admin_update_submission", { method: "POST", body: JSON.stringify({ p_id: targetId, p_patch: { status: "completed" } }) });
    assert.notEqual(r.status, 200);
    const r2 = await admin("rpc/admin_update_submission", { method: "POST", body: JSON.stringify({ p_id: targetId, p_patch: { status: "hacked" } }) });
    assert.notEqual(r2.status, 200);
    assert.equal(psql(`select status from public.submissions where id = '${targetId}'`), "quoted");
  });

  await check("管理人は迷惑な送信を非表示にでき、完全に削除もできる（管理人以外は削除できない）", async () => {
    const ids = psql("select id from public.submissions where kind = 'lesson' order by created_at limit 2").split("\n");
    const [hideId, delId] = ids;
    const h = await admin("rpc/admin_update_submission", { method: "POST", body: JSON.stringify({ p_id: hideId, p_patch: { status: "spam" } }) });
    assert.equal(h.status, 200);
    const r0 = await someone("rpc/admin_delete_submission", { method: "POST", body: JSON.stringify({ p_id: delId }) });
    assert.notEqual(r0.status, 200);
    assert.equal(psql(`select count(*) from public.submissions where id = '${delId}'`), "1");
    await admin("rpc/admin_update_submission", { method: "POST", body: JSON.stringify({ p_id: delId, p_patch: { status: "quoted" } }) });
    const r = await admin("rpc/admin_delete_submission", { method: "POST", body: JSON.stringify({ p_id: delId }) });
    assert.equal(r.status, 200, await r.text());
    assert.equal(psql(`select count(*) from public.submissions where id = '${delId}'`), "0");
    assert.equal(psql(`select count(*) from public.submission_events where submission_id = '${delId}'`), "0");
  });

  await check("返信の下書きを保存でき、送った記録は二重にならず、送ったら下書きが消える", async () => {
    const id = psql("select id from public.submissions where kind = 'teacher_application' limit 1");
    const d = await admin("rpc/admin_save_reply_draft", { method: "POST", body: JSON.stringify({ p_submission: id, p_purpose: "received", p_locale: "ja", p_selected: ["salutation"], p_inputs: {}, p_subject: "件名", p_body: "本文" }) });
    assert.equal(d.status, 200, await d.text());
    const got = await (await admin(`reply_drafts?select=subject,body&submission_id=eq.${id}`)).json();
    assert.equal(got[0]?.body, "本文");
    const denied = await someone("rpc/admin_save_reply_draft", { method: "POST", body: JSON.stringify({ p_submission: id, p_purpose: "x", p_locale: "ja", p_selected: [], p_inputs: {}, p_subject: "", p_body: "" }) });
    assert.notEqual(denied.status, 200);
    const rid = crypto.randomUUID();
    const body = JSON.stringify({ p_submission: id, p_kind: "reply_sent", p_request_id: rid, p_data: { subject: "件名", body: "本文" } });
    const [a, b] = await Promise.all([admin("rpc/admin_add_activity", { method: "POST", body }), admin("rpc/admin_add_activity", { method: "POST", body })]);
    assert.equal(a.status, 200, await a.text());
    assert.equal(b.status, 200);
    assert.equal(psql(`select count(*) from public.case_activities where request_id = '${rid}'`), "1");
    assert.equal(psql(`select count(*) from public.reply_drafts where submission_id = '${id}'`), "0");
    assert.ok(psql(`select replied_at is not null from public.submissions where id = '${id}'`) === "t");
    assert.equal(psql(`select occurred_at is null from public.case_activities where request_id = '${rid}'`), "t");
    const someoneRead = await someone(`case_activities?select=id&submission_id=eq.${id}`);
    const txt = await someoneRead.text();
    assert.ok(someoneRead.status !== 200 || txt === "[]", txt.slice(0, 80));
  });

  await check("ログイン直後の管理人判定（is_admin）が正しい", async () => {
    assert.equal(await (await admin("rpc/is_admin", { method: "POST", body: "{}" })).text(), "true");
    assert.equal(await (await someone("rpc/is_admin", { method: "POST", body: "{}" })).text(), "false");
  });

  // ── 料金マスタ・決済（Phase 2）──────────────────────────────
  await check("料金の改定は管理人だけ・過去の日付は不可・未来の日付は可", async () => {
    const args = (d) => JSON.stringify({ p_service: "bowing", p_item: "both", p_mode: "per_unit", p_jpy: 1600, p_usd_cents: 2300, p_effective_from: d });
    assert.notEqual((await someone("rpc/admin_add_price", { method: "POST", body: args("2099-01-01") })).status, 200);
    assert.notEqual((await admin("rpc/admin_add_price", { method: "POST", body: args("2000-01-01") })).status, 200);
    const r = await admin("rpc/admin_add_price", { method: "POST", body: args("2099-01-01") });
    assert.equal(r.status, 200, await r.text());
    // 今日の金額は変わらない（未来の行は有効開始日まで使われない）
    assert.equal(psql("select count(*) from public.price_items where service='bowing' and item='both'"), "2");
  });
}

// 受付時の金額はサーバーが料金マスタで計算する（画面の値は使わない）
const bowing = (region, extra = {}) => ({
  service: "bowing",
  locale: "en",
  billingRegion: region,
  estimateTotal: 1,
  bowing: { type: "bowing", pages: 5, score: "test", delivery: "threePlus", unitPrice: 1 },
  customer: { name: "Test", email: "test@example.com", remarks: "" },
  ...extra,
});
const quoteOf = (receipt) => JSON.parse(psql(`select json_build_object('q', server_quote, 'r', region, 'c', currency, 'm', payment_method)::text from public.submissions where receipt_no = '${receipt}'`));

await check("料金は誰でも読める・一般利用者は料金を書き換えられない", async () => {
  const r = await fetch(`${API_URL}/rest/v1/price_items?select=service,item,jpy,usd_cents`, { headers: { apikey: ANON_KEY, Authorization: `Bearer ${ANON_KEY}` } });
  const rows = await r.json();
  assert.equal(r.status, 200);
  assert.ok(rows.some((x) => x.service === "recording" && x.item === "violin" && x.jpy === 9000 && x.usd_cents === 6000));
  const w = await fetch(`${API_URL}/rest/v1/price_items`, { method: "POST", headers: { apikey: ANON_KEY, Authorization: `Bearer ${ANON_KEY}`, "Content-Type": "application/json" }, body: JSON.stringify({ service: "bowing", item: "x", mode: "fixed", jpy: 1, effective_from: "2026-11-28" }) });
  assert.notEqual(w.status, 201);
});

await check("運指・運弓 5 ページ: 日本は 5,000 円、海外は 75 USD（画面の金額を改ざんしても無視）", async () => {
  const jp = await (await post(bowing("jp"), { ip: "203.0.113.51" })).json();
  const q1 = quoteOf(jp.receipt);
  assert.equal(q1.c, "JPY");
  assert.equal(q1.q.total, 5000, JSON.stringify(q1));
  const intl = await (await post(bowing("intl"), { ip: "203.0.113.52" })).json();
  const q2 = quoteOf(intl.receipt);
  assert.equal(q2.c, "USD");
  assert.equal(q2.q.total, 7500, JSON.stringify(q2));
});

await check("銀行振込は日本だけ（海外の申告はカードにする）", async () => {
  const intl = await (await post(bowing("intl", { paymentMethod: "bank_transfer" }), { ip: "203.0.113.53" })).json();
  assert.equal(quoteOf(intl.receipt).m, "card");
  const jp = await (await post(bowing("jp", { paymentMethod: "bank_transfer" }), { ip: "203.0.113.54" })).json();
  assert.equal(quoteOf(jp.receipt).m, "bank_transfer");
});

await check("請求先が不明なら通貨を決めない（金額を作らない）", async () => {
  const b = bowing("jp");
  delete b.billingRegion;
  const r = await (await post(b, { ip: "203.0.113.55" })).json();
  const q = quoteOf(r.receipt);
  assert.equal(q.c, null);
  assert.equal(q.q, null);
});

// ── 楽譜 PDF のアップロード（Phase 5） ──
const uploadEndpoint = `${API_URL}/functions/v1/upload-url`;
const askUpload = (body, { origin = ORIGIN, ip = "203.0.113.80" } = {}) =>
  fetch(uploadEndpoint, { method: "POST", headers: { "Content-Type": "application/json", apikey: ANON_KEY, Origin: origin, "X-Forwarded-For": ip }, body: JSON.stringify(body) });
// 関数の中の SUPABASE_URL はコンテナ内の名前（kong）なので、テストからは API_URL に置き換えて送る
const reachable = (u) => { const x = new URL(u); return `${API_URL}${x.pathname}${x.search}`; };
const tinyPdf = new Blob(["%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n"], { type: "application/pdf" });
async function uploadOne(ip) {
  const r = await askUpload({ name: "score.pdf", size: tinyPdf.size, type: "application/pdf" }, { ip });
  assert.equal(r.status, 200, await r.clone().text());
  const { path, uploadUrl } = await r.json();
  const form = new FormData();
  form.append("cacheControl", "3600");
  form.append("", tinyPdf, "score.pdf");
  const put = await fetch(reachable(uploadUrl), { method: "PUT", headers: { "x-upsert": "false", apikey: ANON_KEY }, body: form });
  assert.equal(put.status, 200, await put.text());
  return path;
}
let uploadedPath = null;

await check("アップロード URL: PDF 以外・20 MB 超・許可していない Origin は拒否", async () => {
  assert.equal((await askUpload({ name: "a.png", size: 100, type: "image/png" })).status, 400);
  assert.equal((await askUpload({ name: "a.pdf", size: 21 * 1024 * 1024, type: "application/pdf" })).status, 400);
  assert.equal((await askUpload({ name: "a.pdf", size: 100, type: "application/pdf" }, { origin: "https://evil.example" })).status, 403);
});

await check("PDF を送り、そのパスを付けて申込できる（保存先は検査済みの形）", async () => {
  uploadedPath = await uploadOne("203.0.113.81");
  assert.match(uploadedPath, /^pending\/\d{4}-\d{2}-\d{2}\/[0-9a-f-]{36}\.pdf$/);
  const b = bowing("jp");
  b.bowing = { ...b.bowing, files: [{ path: uploadedPath, name: "score.pdf", size: tinyPdf.size, extra: "x" }] };
  const r = await post(b, { ip: "203.0.113.82" });
  assert.equal(r.status, 200, await r.clone().text());
  const { receipt } = await r.json();
  const files = JSON.parse(psql(`select (payload -> 'bowing' -> 'files')::text from public.submissions where receipt_no = '${receipt}'`));
  assert.deepEqual(files, [{ path: uploadedPath, name: "score.pdf", size: tinyPdf.size }]);
});

await check("アップロードしていないパス・形の違うパスは拒否", async () => {
  const b = bowing("jp");
  b.bowing = { ...b.bowing, files: [{ path: `pending/2026-01-01/${crypto.randomUUID()}.pdf`, name: "x.pdf", size: 10 }] };
  assert.equal((await post(b, { ip: "203.0.113.83" })).status, 400);
  b.bowing.files = [{ path: "../secret.pdf", name: "x.pdf", size: 10 }];
  assert.equal((await post(b, { ip: "203.0.113.84" })).status, 400);
});

await check("利用者（公開キー）は添付ファイルを読めない・一覧できない", async () => {
  const r = await fetch(`${API_URL}/storage/v1/object/submission-files/${uploadedPath}`, { headers: { apikey: ANON_KEY, Authorization: `Bearer ${ANON_KEY}` } });
  assert.notEqual(r.status, 200);
  const l = await fetch(`${API_URL}/storage/v1/object/list/submission-files`, { method: "POST", headers: { apikey: ANON_KEY, Authorization: `Bearer ${ANON_KEY}`, "Content-Type": "application/json" }, body: JSON.stringify({ prefix: "pending" }) });
  const t = await l.text();
  assert.ok(l.status !== 200 || t === "[]", t.slice(0, 80));
});

await check("アップロード URL の発行回数を制限する", async () => {
  let limited = false;
  for (let i = 0; i < 25 && !limited; i++) {
    const r = await askUpload({ name: "a.pdf", size: 100, type: "application/pdf" }, { ip: "203.0.113.85" });
    if (r.status === 429) limited = true;
  }
  assert.ok(limited);
});

if (SERVICE_ROLE_KEY) {
  const admin = asUser(await signIn("admin@example.com", "admin-pass-123456"));
  await check("管理人は添付ファイルを短時間の署名付き URL で開ける", async () => {
    const r = await admin(`../storage/v1/object/sign/submission-files/${uploadedPath}`, { method: "POST", body: JSON.stringify({ expiresIn: 60 }) });
    assert.equal(r.status, 200, await r.clone().text());
    const { signedURL } = await r.json();
    const f = await fetch(`${API_URL}/storage/v1${signedURL}`);
    assert.equal(f.status, 200);
    assert.match(await f.text(), /^%PDF/);
  });

  const rec = await (await post(bowing("jp"), { ip: "203.0.113.56" })).json();
  const id = psql(`select id from public.submissions where receipt_no = '${rec.receipt}'`);
  const rpc = (name, body) => admin(`rpc/${name}`, { method: "POST", body: JSON.stringify(body) });

  await check("確定金額のある案件は、入金確認前に「制作中」「入金済み」にできない", async () => {
    const c = await rpc("admin_confirm_price", { p_id: id, p_amount: 5000, p_currency: "JPY", p_note: "5ページ" });
    assert.equal(c.status, 200, await c.text());
    const r = await rpc("admin_update_submission", { p_id: id, p_patch: { status: "in_progress" } });
    assert.notEqual(r.status, 200);
    assert.match(await r.text(), /payment_required/);
    psql(`insert into public.payments (submission_id, method, currency, amount, status, received_amount, paid_at) values ('${id}', 'bank_transfer', 'JPY', 5000, 'paid', 5000, now())`);
    const ok = await rpc("admin_update_submission", { p_id: id, p_patch: { status: "in_progress" } });
    assert.equal(ok.status, 200, await ok.text());
  });

  await check("入金済みの案件の金額は変えられない・決済のある案件は削除できない", async () => {
    const r = await rpc("admin_confirm_price", { p_id: id, p_amount: 9999, p_currency: "JPY" });
    assert.notEqual(r.status, 200);
    assert.equal(psql(`select confirmed_amount from public.submissions where id = '${id}'`), "5000");
    const d = await rpc("admin_delete_submission", { p_id: id });
    assert.notEqual(d.status, 200);
  });

  await check("金額を変えると未払いの古い請求を取り消す", async () => {
    const r2 = await (await post(bowing("intl"), { ip: "203.0.113.57" })).json();
    const id2 = psql(`select id from public.submissions where receipt_no = '${r2.receipt}'`);
    assert.equal((await rpc("admin_confirm_price", { p_id: id2, p_amount: 7500, p_currency: "USD" })).status, 200);
    psql(`insert into public.payments (submission_id, method, currency, amount, status) values ('${id2}', 'card', 'USD', 7500, 'link_sent')`);
    assert.equal((await rpc("admin_confirm_price", { p_id: id2, p_amount: 9000, p_currency: "USD" })).status, 200);
    assert.equal(psql(`select status from public.payments where submission_id = '${id2}'`), "cancelled");
  });

  // ── 銀行振込の手動管理（Phase 4） ──
  const newBank = async (ip) => {
    const r = await (await post(bowing("jp", { paymentMethod: "bank_transfer" }), { ip })).json();
    const sid = psql(`select id from public.submissions where receipt_no = '${r.receipt}'`);
    assert.equal((await rpc("admin_confirm_price", { p_id: sid, p_amount: 5000, p_currency: "JPY" })).status, 200);
    return sid;
  };
  const json = async (res) => { const t = await res.text(); assert.equal(res.status, 200, t); return JSON.parse(t); };

  await check("振込案内の記録 → 入金待ち。同じ操作の再送は 1 件", async () => {
    const sid = await newBank("203.0.113.60");
    const req = crypto.randomUUID();
    const p1 = await json(await rpc("admin_record_bank_notice", { p_id: sid, p_request_id: req }));
    const p2 = await json(await rpc("admin_record_bank_notice", { p_id: sid, p_request_id: req }));
    assert.equal(p1.id, p2.id);
    assert.equal(p1.status, "link_sent");
    assert.equal(psql(`select count(*) from public.payments where submission_id = '${sid}'`), "1");
    assert.equal(psql(`select status from public.submissions where id = '${sid}'`), "awaiting_payment");
  });

  await check("不足 → 追加の着金で入金済み。案件は「入金済み」へ。二重記録はしない", async () => {
    const sid = await newBank("203.0.113.61");
    const pay = await json(await rpc("admin_record_bank_notice", { p_id: sid, p_request_id: crypto.randomUUID() }));
    const today = psql(`select (now() at time zone 'Asia/Tokyo')::date`);
    const r1 = crypto.randomUUID();
    const a = await json(await rpc("admin_record_bank_receipt", { p_payment: pay.id, p_amount: 3000, p_received_on: today, p_request_id: r1 }));
    assert.equal(a.status, "underpaid");
    await json(await rpc("admin_record_bank_receipt", { p_payment: pay.id, p_amount: 3000, p_received_on: today, p_request_id: r1 }));
    assert.equal(psql(`select received_amount from public.payments where id = '${pay.id}'`), "3000");
    assert.notEqual(psql(`select status from public.submissions where id = '${sid}'`), "paid");
    const b = await json(await rpc("admin_record_bank_receipt", { p_payment: pay.id, p_amount: 2000, p_received_on: today, p_request_id: crypto.randomUUID() }));
    assert.equal(b.status, "paid");
    assert.equal(psql(`select status from public.submissions where id = '${sid}'`), "paid");
    // 入金が確定金額に届いたので「対応中」へ進められる
    assert.equal((await rpc("admin_update_submission", { p_id: sid, p_patch: { status: "in_progress" } })).status, 200);
  });

  await check("超過 → 超過分の返金で入金済みに戻る・未来の着金日は拒否", async () => {
    const sid = await newBank("203.0.113.62");
    const pay = await json(await rpc("admin_record_bank_notice", { p_id: sid, p_request_id: crypto.randomUUID() }));
    const today = psql(`select (now() at time zone 'Asia/Tokyo')::date`);
    const future = psql(`select (now() at time zone 'Asia/Tokyo')::date + 3`);
    assert.notEqual((await rpc("admin_record_bank_receipt", { p_payment: pay.id, p_amount: 5000, p_received_on: future, p_request_id: crypto.randomUUID() })).status, 200);
    const o = await json(await rpc("admin_record_bank_receipt", { p_payment: pay.id, p_amount: 10000, p_received_on: today, p_request_id: crypto.randomUUID() }));
    assert.equal(o.status, "overpaid");
    const back = await json(await rpc("admin_record_bank_refund", { p_payment: pay.id, p_amount: 5000, p_request_id: crypto.randomUUID() }));
    assert.equal(back.status, "paid");
    assert.notEqual((await rpc("admin_record_bank_refund", { p_payment: pay.id, p_amount: 6000, p_request_id: crypto.randomUUID() })).status, 200);
    const all = await json(await rpc("admin_record_bank_refund", { p_payment: pay.id, p_amount: 5000, p_request_id: crypto.randomUUID() }));
    assert.equal(all.status, "refunded");
  });

  await check("銀行振込は円の案件だけ。ドルで確定すると料金区分は日本以外・支払いはカードになる", async () => {
    const sid = await newBank("203.0.113.63");
    assert.equal((await rpc("admin_confirm_price", { p_id: sid, p_amount: 7500, p_currency: "USD" })).status, 200);
    assert.equal(psql(`select region || ',' || currency || ',' || payment_method from public.submissions where id = '${sid}'`), "intl,USD,card");
    const r = await rpc("admin_record_bank_notice", { p_id: sid, p_request_id: crypto.randomUUID() });
    assert.notEqual(r.status, 200);
    assert.match(await r.text(), /bank_transfer_jp_only/);
  });

  await check("未払いの振込案内は取り消せる・入金後は取り消せない", async () => {
    const sid = await newBank("203.0.113.64");
    const pay = await json(await rpc("admin_record_bank_notice", { p_id: sid, p_request_id: crypto.randomUUID() }));
    const c = await json(await rpc("admin_cancel_payment", { p_payment: pay.id, p_note: "取り下げ" }));
    assert.equal(c.status, "cancelled");
    const sid2 = await newBank("203.0.113.65");
    const pay2 = await json(await rpc("admin_record_bank_notice", { p_id: sid2, p_request_id: crypto.randomUUID() }));
    const today = psql(`select (now() at time zone 'Asia/Tokyo')::date`);
    await json(await rpc("admin_record_bank_receipt", { p_payment: pay2.id, p_amount: 5000, p_received_on: today, p_request_id: crypto.randomUUID() }));
    assert.notEqual((await rpc("admin_cancel_payment", { p_payment: pay2.id })).status, 200);
  });

  await check("管理人でない利用者は振込の記録関数を使えない", async () => {
    const someone = asUser(await signIn("someone@example.com", "someone-pass-123456"));
    const r = await someone("rpc/admin_record_bank_notice", { method: "POST", body: JSON.stringify({ p_id: id, p_request_id: crypto.randomUUID() }) });
    assert.notEqual(r.status, 200);
  });

  await check("決済の記録は管理人だけが読める", async () => {
    const someone = asUser(await signIn("someone@example.com", "someone-pass-123456"));
    const r = await someone("payments?select=id");
    const t = await r.text();
    assert.ok(r.status !== 200 || t === "[]", t.slice(0, 80));
  });
}

console.log(failed ? `${failed} failed` : "all passed");
process.exit(failed ? 1 : 0);
