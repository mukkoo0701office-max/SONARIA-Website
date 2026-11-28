import { test } from "node:test";
import assert from "node:assert/strict";
import { buildReply, mailtoLink } from "../src/admin/replies/engine.ts";
import { purposesByKind } from "../src/admin/replies/engine.ts";

const perf = { case_number: "SN-261128-AB3CD", customer_name: "山田 花子", service_name: "演奏のご依頼", requested_date: "2027年3月15日(土) 午後", ensemble: "弦楽四重奏", budget: "10万〜20万円" };

test("演奏依頼の最初の返信: 入力済みの項目は聞き直さず、内容を確認する文を入れる", () => {
  const r = buildReply({ kind: "performance_quote", purpose: "first_reply", locale: "ja", facts: perf });
  assert.match(r.body, /山田 花子 様/);
  assert.match(r.body, /2027年3月15日\(土\) 午後、弦楽四重奏での演奏のご依頼/);
  assert.doesNotMatch(r.body, /ご予算/);
  assert.doesNotMatch(r.body, /候補日をお知らせ/);
  assert.match(r.subject, /SN-261128-AB3CD/);
  assert.deepEqual(r.missing, []);
});

test("予算が未定・日程が未定なら、その質問だけを足す", () => {
  const facts = { ...perf, budget: undefined, budget_undecided: "1", requested_date: undefined, schedule_undecided: "1" };
  const r = buildReply({ kind: "performance_quote", purpose: "first_reply", locale: "ja", facts });
  assert.match(r.body, /おおよそのご予算/);
  assert.match(r.body, /候補日をお知らせ/);
  assert.match(r.body, /弦楽四重奏での演奏のご依頼/);
});

test("会場・演奏時間の質問は雛形に入れない（2026-11-28 決定）", () => {
  const r = buildReply({ kind: "performance_quote", purpose: "first_reply", locale: "ja", facts: perf });
  assert.doesNotMatch(r.body, /会場|演奏時間/);
});

test("見積の金額は運営者の入力からだけ入れ、未入力なら【要入力】として知らせる", () => {
  const r = buildReply({ kind: "performance_quote", purpose: "quote", locale: "ja", facts: perf });
  assert.ok(r.missing.includes("quote_amount"));
  assert.match(r.body, /【要入力: quote_amount】/);
  const r2 = buildReply({ kind: "performance_quote", purpose: "quote", locale: "ja", facts: perf, inputs: { quote_amount: "¥135,000" } });
  assert.match(r2.body, /お見積もりは ¥135,000 です/);
  assert.deepEqual(r2.missing, []);
});

test("運営者が選び直した部品だけを使う", () => {
  const r = buildReply({ kind: "performance_quote", purpose: "first_reply", locale: "ja", facts: perf, selected: ["salutation", "signature"] });
  assert.equal(r.body, "山田 花子 様\n\nSONARIA（ソナリア）\n受付番号: SN-261128-AB3CD");
  assert.ok(r.available.find((a) => a.key === "perf_confirm")?.auto);
  assert.equal(r.available.find((a) => a.key === "perf_confirm")?.selected, false);
});

test("お客さんの値に {…} が入っていても再展開しない", () => {
  const r = buildReply({ kind: "performance_quote", purpose: "first_reply", locale: "ja", facts: { ...perf, customer_name: "{quote_amount}" } });
  assert.match(r.body, /\{quote_amount\} 様/);
  assert.deepEqual(r.missing, []);
});

test("英語の返信も組み立てられる", () => {
  const r = buildReply({ kind: "performance_quote", purpose: "first_reply", locale: "en", facts: { ...perf, customer_name: "Alex", ensemble: "string quartet", requested_date: "Mar 15, 2027", service_name: "performance request" } });
  assert.match(r.body, /^Dear Alex,/);
  assert.match(r.body, /string quartet performance on Mar 15, 2027/);
});

test("すべてのフォーム・目的・言語で組み立てられ、署名は SONARIA", () => {
  for (const [kind, purposes] of Object.entries(purposesByKind)) {
    for (const purpose of purposes) {
      for (const locale of ["ja", "en"]) {
        const r = buildReply({ kind, purpose, locale, facts: { case_number: "SN-1", customer_name: "A", service_name: "x" } });
        assert.ok(r.subject.length > 0 && r.body.includes("SONARIA"), `${kind}/${purpose}/${locale}`);
      }
    }
  }
});

test("mailto: は宛先・件名・本文をエンコードし、改行を CRLF にする", () => {
  const url = mailtoLink("hanako@example.com", "件名 & テスト", "1行目\n2行目");
  assert.ok(url.startsWith("mailto:hanako@example.com?subject="));
  assert.ok(url.includes("%26"));
  assert.ok(url.includes("%0D%0A"));
  assert.ok(!url.includes("\n"));
});

test("入力欄は、その返信で使うものだけを出す（演奏依頼の見積に納期の欄は出さない）", () => {
  assert.deepEqual(buildReply({ kind: "performance_quote", purpose: "quote", locale: "ja", facts: perf }).inputs, ["quote_amount"]);
  assert.deepEqual(buildReply({ kind: "bowing", purpose: "quote", locale: "ja", facts: perf }).inputs, ["quote_amount", "deadline"]);
});

// ── お支払いの案内（Phase 4） ──
const bow = { case_number: "SN-261129-ZZ1AA", customer_name: "Alex Kim", service_name: "運指・運弓付け" };

test("銀行振込の案内: 確定金額・振込先・期限・キャンセル規定が入り、未入力は要入力として残る", () => {
  const r = buildReply({ kind: "bowing", purpose: "payment_bank", locale: "ja", facts: bow, inputs: { confirmed_amount: "¥5,000", bank_account: "○○銀行 △△支店 普通 1234567 ムコウヤマ", pay_by: "2026年12月5日(土)", deadline: "2026年12月10日(木)" } });
  assert.match(r.body, /¥5,000（税込み）/);
  assert.match(r.body, /○○銀行/);
  assert.match(r.body, /作業を始める前のキャンセルは、お支払い済みの金額を全額返金/);
  assert.match(r.subject, /お振込みのご案内/);
  assert.deepEqual(r.missing, []);
  const empty = buildReply({ kind: "bowing", purpose: "payment_bank", locale: "ja", facts: bow });
  assert.ok(empty.missing.includes("confirmed_amount"));
  assert.ok(empty.missing.includes("bank_account"));
  assert.deepEqual(empty.inputs, ["bank_account", "pay_by", "deadline"]);
});

test("カード決済の案内（英語）: リンクと期限を入れ、確定金額は入力欄にしない", () => {
  const r = buildReply({ kind: "recording", purpose: "payment_card", locale: "en", facts: bow, inputs: { confirmed_amount: "$75.00", payment_link: "https://checkout.stripe.com/x", pay_by: "December 5, 2026" } });
  assert.match(r.body, /The total is \$75\.00 \(tax included\)/);
  assert.match(r.body, /https:\/\/checkout\.stripe\.com\/x/);
  assert.ok(!r.inputs.includes("confirmed_amount"));
});

test("演奏依頼の支払い案内はキャンセル規定（未決定）を入れず、入金で予約確定と書く", () => {
  const r = buildReply({ kind: "performance_quote", purpose: "payment_bank", locale: "ja", facts: perf, inputs: { confirmed_amount: "¥100,000", bank_account: "x", pay_by: "y" } });
  assert.match(r.body, /ご入金の確認をもって、ご予約の確定/);
  assert.doesNotMatch(r.body, /作業を始める前のキャンセル/);
});

test("支払い関連の目的はレッスンと講師登録には出さない", () => {
  for (const k of ["lesson", "teacher_application"]) {
    for (const p of ["payment_card", "payment_bank", "work_started"]) assert.ok(!purposesByKind[k].includes(p), `${k}:${p}`);
  }
});
