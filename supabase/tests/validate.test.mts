// 入力検証の単体テスト: node --experimental-strip-types --test supabase/tests/validate.test.mts
import { test } from "node:test";
import assert from "node:assert/strict";
import { isAllowedOrigin, validateSubmission } from "../functions/_shared/validate.ts";
import { buildNotifyMail } from "../functions/_shared/notify.ts";

const lesson = {
  service: "lesson",
  locale: "ja",
  estimateTotal: 1000,
  lesson: { trialTaken: false, plan: "trial", candidates: [{ date: "2026-12-01", slot: "evening" }] },
  customer: { name: "山田 花子", email: "hanako@example.com", remarks: "" },
};
const performance = {
  kind: "performance_quote",
  locale: "en",
  schedule: { mode: "fixed", dates: [{ date: "2027-01-10", slot: "any", time: "" }], period: "" },
  budget: "100k_200k",
  ensemble: "quartet",
  contact: { name: "Alex", email: "alex@example.com" },
  consent: true,
};
const teacher = {
  kind: "teacher_application",
  locale: "ja",
  public: { displayName: "山田先生", instruments: ["violin"] },
  private: { legalName: "山田 太郎", email: "taro@example.com" },
  agreements: { eligibility: true, publish: true, privacy: true },
};

test("各フォームの正しい送信を受け付ける", () => {
  for (const [p, kind] of [[lesson, "lesson"], [performance, "performance_quote"], [teacher, "teacher_application"]] as const) {
    const r = validateSubmission(p);
    assert.equal(r.ok, true, JSON.stringify(r));
    if (r.ok) assert.equal(r.kind, kind);
  }
});

test("統合申込の概算は参考値として整数だけ取り込む", () => {
  const r = validateSubmission(lesson);
  assert.ok(r.ok && r.estimate === 1000);
  const r2 = validateSubmission({ ...lesson, estimateTotal: -5 });
  assert.ok(r2.ok && r2.estimate === null);
});

test("種類・言語・氏名・メールの不備を拒否する", () => {
  assert.equal(validateSubmission({ ...lesson, service: "other" }).ok, false);
  assert.equal(validateSubmission({ ...lesson, locale: "fr" }).ok, false);
  assert.equal(validateSubmission({ ...lesson, customer: { name: "", email: "a@b.co" } }).ok, false);
  assert.equal(validateSubmission({ ...lesson, customer: { name: "a", email: "not-an-email" } }).ok, false);
  assert.equal(validateSubmission({ ...lesson, lesson: undefined }).ok, false);
});

test("同意がない依頼・講師登録を拒否する", () => {
  assert.equal(validateSubmission({ ...performance, consent: false }).ok, false);
  assert.equal(validateSubmission({ ...teacher, agreements: { eligibility: true, publish: false, privacy: true } }).ok, false);
});

test("長すぎる文字列・深すぎる入れ子・多すぎる要素を拒否する", () => {
  assert.equal(validateSubmission({ ...lesson, customer: { ...lesson.customer, remarks: "x".repeat(4001) } }).ok, false);
  let deep: Record<string, unknown> = {};
  const root = deep;
  for (let i = 0; i < 8; i++) deep = (deep.n = {}) as Record<string, unknown>;
  assert.equal(validateSubmission({ ...lesson, extra: root }).ok, false);
  assert.equal(validateSubmission({ ...lesson, extra: Array.from({ length: 51 }, () => 1) }).ok, false);
  assert.equal(validateSubmission("text").ok, false);
});

test("Origin は完全一致だけ許可する", () => {
  const allowed = ["https://mukkoo0701office-max.github.io"];
  assert.equal(isAllowedOrigin("https://mukkoo0701office-max.github.io", allowed), true);
  assert.equal(isAllowedOrigin("https://evil.example", allowed), false);
  assert.equal(isAllowedOrigin(null, allowed), false);
});

test("通知メールは種類・受付番号・日本時間を含み、個人情報を含まない", () => {
  const m = buildNotifyMail("performance_quote", "SN-261128-ABCDE", new Date("2026-11-27T21:30:00Z"), "https://example.com/admin");
  assert.match(m.subject, /演奏依頼/);
  assert.match(m.subject, /SN-261128-ABCDE/);
  assert.match(m.text, /2026-11-28 06:30/);
  // 文面にメールアドレス等の個人情報が入らないこと（通知先の URL 以外に @ を含まない）
  assert.ok(!m.text.includes("@"));
});
