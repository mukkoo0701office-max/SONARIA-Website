// バックエンドの結合テスト（CI 専用）。ローカルの Supabase（supabase start）に対して実行する。
// 使い方: API_URL=... ANON_KEY=... SERVICE_ROLE_KEY=... node supabase/tests/backend.test.mjs
// 実在の個人情報は使わない（example.com のテスト用アドレスのみ）。
import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";

const { API_URL, ANON_KEY, SERVICE_ROLE_KEY } = process.env;
const FN = `${API_URL}/functions/v1/submit-application`;
const results = [];
const check = (name, ok, detail = "") => {
  results.push({ name, ok });
  console.log(`${ok ? "OK  " : "FAIL"} ${name}${detail ? " — " + detail : ""}`);
};

const service = createClient(API_URL, SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const anon = createClient(API_URL, ANON_KEY, { auth: { persistSession: false } });

async function submit(body) {
  const res = await fetch(FN, {
    method: "POST",
    headers: { "Content-Type": "application/json", apikey: ANON_KEY, Authorization: `Bearer ${ANON_KEY}` },
    body: JSON.stringify(body),
  });
  let json = null;
  try {
    json = await res.json();
  } catch {}
  return { status: res.status, json };
}

const lessonData = {
  name: "テスト 太郎",
  email: "test-lesson@example.com",
  phone: "090-0000-0000",
  plan: "single",
  format: "in_person",
  preferred1: "2026-12-01T10:00",
  experience: "none",
  concerns: ["pitch", "bowing"],
  goals: "基礎から学びたい",
  consent: true,
};

// ---- 1. 正常な申し込み（レッスン） ----
const lessonReq = randomUUID();
const r1 = await submit({ service: "lesson", locale: "ja", requestId: lessonReq, data: lessonData });
check("lesson: valid submit returns receipt", r1.status === 200 && /^SON-\d{6}-\d{5}$/.test(r1.json?.receiptNo ?? ""), JSON.stringify(r1.json));
check("lesson: applicant email disabled until domain verified", r1.json?.applicantEmail === "disabled");

// ---- 2. 二重送信（同じ requestId） ----
const r1b = await submit({ service: "lesson", locale: "ja", requestId: lessonReq, data: lessonData });
check("duplicate: same requestId returns same receipt", r1b.status === 200 && r1b.json?.receiptNo === r1.json?.receiptNo && r1b.json?.duplicate === true);
const { count: dupCount } = await service.from("applications").select("id", { count: "exact", head: true }).eq("client_request_id", lessonReq);
check("duplicate: only one row stored", dupCount === 1, `count=${dupCount}`);

// 保存内容（サーバー側で整形・未知の項目は除去）
const { data: row1 } = await service.from("applications").select("*").eq("client_request_id", lessonReq).single();
check("lesson: stored with status new", row1?.status === "new" && row1?.service === "lesson");
check("lesson: consent not stored in payload, contact split out", row1 && !("consent" in row1.payload) && !("email" in row1.payload) && row1.email === lessonData.email);
check("lesson: plan price stored server-side", row1?.quote?.yen === 6000 && row1?.quote?.minutes === 60);
check("lesson: admin notify not_configured without Resend key", row1?.notify_admin_status === "not_configured");

// ---- 3. 入力エラー ----
const r3 = await submit({ service: "lesson", locale: "ja", requestId: randomUUID(), data: { ...lessonData, email: "not-an-email", consent: false } });
check("validation: bad email & no consent rejected", r3.status === 400 && r3.json?.errors?.email === "email" && r3.json?.errors?.consent === "consent");
const r3b = await submit({ service: "lesson", locale: "ja", requestId: randomUUID(), data: { ...lessonData, format: "visiting" } });
check("validation: travel area required for visiting", r3b.status === 400 && r3b.json?.errors?.travelArea === "required");
const r3c = await submit({ service: "lesson", locale: "ja", requestId: "not-a-uuid", data: lessonData });
check("validation: invalid requestId rejected", r3c.status === 400);
const r3d = await submit({ service: "evil", locale: "ja", requestId: randomUUID(), data: lessonData });
check("validation: unknown service rejected", r3d.status === 400);
const r3e = await submit({ service: "lesson", locale: "ja", requestId: randomUUID(), data: lessonData, website: "http://spam" });
check("spam: honeypot rejected", r3e.status === 400 && r3e.json?.error === "rejected");

// ---- 4. 運指・ボウイング: 料金計算はサーバー側 ----
const bowingData = {
  name: "テスト 花子",
  email: "test-bowing@example.com",
  instrument: "violin",
  title: "Partita No.2",
  composer: "J. S. Bach",
  service: "both",
  pages: "3",
  rightsConfirm: true,
  consent: true,
  // 画面から料金を偽って送っても無視されること
  totalYen: 1,
};
const pdf = Buffer.from("%PDF-1.4\n1 0 obj << /Type /Page >> endobj\n%%EOF\n");
const bowingReq = randomUUID();
const r4 = await submit({
  service: "bowing",
  locale: "ja",
  requestId: bowingReq,
  data: bowingData,
  files: [{ name: "score.pdf", size: pdf.length, type: "application/pdf" }],
});
check("bowing: valid submit with file", r4.status === 200 && r4.json?.uploads?.length === 1, JSON.stringify(r4.json));
check("pricing: both × 3 pages = 4500 (server)", r4.json?.quote?.totalYen === 4500 && r4.json?.quote?.unitYen === 1500);
const { data: row4 } = await service.from("applications").select("payload, quote").eq("client_request_id", bowingReq).single();
check("pricing: client-sent price ignored", row4 && !("totalYen" in row4.payload) && row4.quote.totalYen === 4500);
check("pricing: tax mode from settings", row4?.quote?.taxMode === "undecided");

const r4b = await submit({ service: "bowing", locale: "ja", requestId: randomUUID(), data: { ...bowingData, pages: "1.5" }, files: [{ name: "a.pdf", size: 10, type: "application/pdf" }] });
check("pricing: non-integer pages rejected", r4b.status === 400 && r4b.json?.errors?.pages === "integer");
const r4c = await submit({ service: "bowing", locale: "ja", requestId: randomUUID(), data: { ...bowingData, pages: "0" }, files: [{ name: "a.pdf", size: 10, type: "application/pdf" }] });
check("pricing: zero pages rejected", r4c.status === 400 && r4c.json?.errors?.pages === "range");
const r4d = await submit({ service: "bowing", locale: "ja", requestId: randomUUID(), data: { ...bowingData, pages: "11" }, files: [{ name: "a.pdf", size: 10, type: "application/pdf" }] });
check("pricing: 11 pages flags consultation, no auto discount", r4d.status === 200 && r4d.json?.quote?.consultDiscount === true && r4d.json?.quote?.totalYen === 16500);

// ---- 5. ファイル ----
const r5 = await submit({ service: "bowing", locale: "ja", requestId: randomUUID(), data: bowingData, files: [{ name: "evil.exe", size: 10, type: "application/x-msdownload" }] });
check("files: disallowed type rejected", r5.status === 400 && r5.json?.fileError === "type");
const r5b = await submit({ service: "bowing", locale: "ja", requestId: randomUUID(), data: bowingData, files: [{ name: "big.pdf", size: 30 * 1024 * 1024, type: "application/pdf" }] });
check("files: too large rejected", r5b.status === 400 && r5b.json?.fileError === "tooLarge");
const r5c = await submit({ service: "bowing", locale: "ja", requestId: randomUUID(), data: bowingData, files: [] });
check("files: required for bowing", r5c.status === 400 && r5c.json?.fileError === "required");

const up = r4.json.uploads[0];
const { error: upErr } = await anon.storage.from("application-files").uploadToSignedUrl(up.path, up.token, pdf, { contentType: "application/pdf" });
check("files: upload via signed URL", !upErr, upErr?.message);
const comp = await submit({ action: "complete", requestId: bowingReq });
check("files: complete marks uploaded", comp.status === 200 && comp.json?.missing === 0);

// バケット側の制限（Edge Function を通さず、許可されていない種類を署名付き URL で上げようとする）
const { data: sneak } = await service.storage.from("application-files").createSignedUploadUrl(`${randomUUID()}/x.html`);
const { error: sneakErr } = await anon.storage.from("application-files").uploadToSignedUrl(sneak.path, sneak.token, Buffer.from("<script>"), { contentType: "text/html" });
check("files: bucket rejects disallowed mime even with signed URL", !!sneakErr, sneakErr?.message);

// ---- 6. 権限のない利用者 ----
const { data: anonRows } = await anon.from("applications").select("id");
check("rls: anon cannot read applications", (anonRows ?? []).length === 0);
const { error: anonInsErr } = await anon.from("applications").insert({ client_request_id: randomUUID(), service: "lesson", name: "x", email: "x@example.com", consent_at: new Date().toISOString() });
check("rls: anon cannot insert directly", !!anonInsErr);
const { data: anonFiles } = await anon.from("application_files").select("id");
check("rls: anon cannot read file rows", (anonFiles ?? []).length === 0);
const { error: anonDl } = await anon.storage.from("application-files").download(up.path);
check("storage: anon cannot download", !!anonDl);
const { data: anonSettings } = await anon.from("settings").select("key");
check("settings: anon sees only public settings", (anonSettings ?? []).length === 1 && anonSettings[0].key === "bowing_tax_mode", JSON.stringify(anonSettings));
const { error: anonRpc } = await anon.rpc("admin_set_status", { p_id: row1.id, p_status: "completed" });
check("rls: anon cannot change status", !!anonRpc);

// ログインしているが管理人ではない利用者
const pw = `Pw-${randomUUID()}`;
await service.auth.admin.createUser({ email: "notadmin@example.com", password: pw, email_confirm: true });
const user = createClient(API_URL, ANON_KEY, { auth: { persistSession: false } });
await user.auth.signInWithPassword({ email: "notadmin@example.com", password: pw });
const { data: userRows } = await user.from("applications").select("id");
check("rls: non-admin user cannot read applications", (userRows ?? []).length === 0);
const { error: userRpc } = await user.rpc("admin_set_status", { p_id: row1.id, p_status: "completed" });
check("rls: non-admin user cannot change status", !!userRpc);
const { error: userDl } = await user.storage.from("application-files").download(up.path);
check("storage: non-admin user cannot download", !!userDl);
const { error: userUpd } = await user.from("settings").update({ value: "included" }).eq("key", "bowing_tax_mode");
const { data: taxAfter } = await service.from("settings").select("value").eq("key", "bowing_tax_mode").single();
check("rls: non-admin user cannot change settings", taxAfter.value === "undecided", userUpd?.message);

// ---- 7. 管理人 ----
const { data: created } = await service.auth.admin.createUser({ email: "admin@example.com", password: pw, email_confirm: true });
await service.from("admins").insert({ user_id: created.user.id });
const adm = createClient(API_URL, ANON_KEY, { auth: { persistSession: false } });
await adm.auth.signInWithPassword({ email: "admin@example.com", password: pw });
const { data: isAdmin } = await adm.rpc("is_admin");
check("admin: is_admin true", isAdmin === true);
const { data: admRows } = await adm.from("applications").select("id, receipt_no");
check("admin: can read applications", (admRows ?? []).length >= 3, `rows=${admRows?.length}`);
const { error: setErr } = await adm.rpc("admin_set_status", { p_id: row1.id, p_status: "reviewing", p_note: "確認開始" });
const { data: hist } = await adm.from("application_status_history").select("*").eq("application_id", row1.id);
check("admin: status change logged with note", !setErr && hist?.length === 1 && hist[0].to_status === "reviewing" && hist[0].note === "確認開始", setErr?.message);
const { error: badStatus } = await adm.rpc("admin_set_status", { p_id: row1.id, p_status: "hacked" });
check("admin: invalid status rejected by DB", !!badStatus);
const { error: noteErr } = await adm.from("applications").update({ admin_note: "メモ" }).eq("id", row1.id);
check("admin: can edit admin note", !noteErr, noteErr?.message);
const { error: emailEdit } = await adm.from("applications").update({ email: "changed@example.com" }).eq("id", row1.id);
check("admin: cannot rewrite applicant fields directly", !!emailEdit);
const { data: signedDl, error: dlErr } = await adm.storage.from("application-files").createSignedUrl(up.path, 60);
check("admin: can create download URL for attachment", !dlErr && !!signedDl?.signedUrl, dlErr?.message);
const { error: taxErr } = await adm.from("settings").update({ value: "included" }).eq("key", "bowing_tax_mode");
check("admin: can change tax mode", !taxErr, taxErr?.message);
await adm.storage.from("application-files").remove([up.path]);
const { data: bowRow } = await service.from("applications").select("id").eq("client_request_id", bowingReq).single();
const { error: redErr } = await adm.rpc("admin_redact_application", { p_id: bowRow.id });
const { data: redacted } = await service.from("applications").select("name, email, payload, redacted_at").eq("id", bowRow.id).single();
check("admin: redact removes personal data", !redErr && redacted.email === "deleted@invalid" && Object.keys(redacted.payload).length === 0 && !!redacted.redacted_at, redErr?.message);

// ---- 8. 送信回数制限（最後に実行） ----
let limited = false;
for (let i = 0; i < 40 && !limited; i++) {
  const r = await submit({ service: "lesson", locale: "ja", requestId: randomUUID(), data: lessonData });
  if (r.status === 429) limited = true;
}
check("rate limit: eventually returns 429", limited);

const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} passed`);
process.exit(failed.length ? 1 : 0);
