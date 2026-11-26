// 画面からバックエンドまでの通しテスト（CI 専用）。
// ローカルの Supabase に接続したビルドをブラウザで開き、実際にフォームを入力・送信して、
// データベース・非公開ストレージ・管理画面に反映されることを確認する。
// 使い方: node scripts/e2e.mjs <サイトの URL> <出力先>  （API_URL, SERVICE_ROLE_KEY を環境変数で渡す）
import { createClient } from "@supabase/supabase-js";
import { chromium } from "playwright";
import { mkdirSync, writeFileSync } from "node:fs";

const [base, outDir] = process.argv.slice(2);
mkdirSync(outDir, { recursive: true });
const service = createClient(process.env.API_URL, process.env.SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const log = [];
const check = (name, ok, detail = "") => {
  log.push(`${ok ? "OK  " : "FAIL"} ${name}${detail ? " — " + detail : ""}`);
  console.log(log[log.length - 1]);
};

const browser = await chromium.launch();

async function run(viewport, label) {
  const context = await browser.newContext({ viewport, locale: "ja-JP" });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));

  // ---------- レッスン申し込み ----------
  await page.goto(`${base}/ja/lessons/apply/`, { waitUntil: "networkidle" });
  check(`${label}: lesson form shows no 'not connected' notice`, (await page.getByText("オンラインでのお申し込みは準備中").count()) === 0);
  await page.screenshot({ path: `${outDir}/${label}-lesson-step1.png`, fullPage: true });

  // 未入力で次へ → エラー
  await page.getByRole("button", { name: "次へ" }).click();
  check(`${label}: lesson step1 shows required errors`, (await page.getByText("入力してください。").count()) >= 3);
  await page.screenshot({ path: `${outDir}/${label}-lesson-errors.png`, fullPage: true });

  await page.fill("#field-name", "テスト 太郎");
  await page.fill("#field-email", "bad-email");
  await page.fill("#field-phone", "090-0000-0000");
  await page.getByRole("button", { name: "次へ" }).click();
  check(`${label}: invalid email blocked`, (await page.getByText("メールアドレスの形式で入力してください。").count()) === 1);
  await page.fill("#field-email", "e2e-lesson@example.com");
  await page.getByRole("button", { name: "次へ" }).click();

  await page.getByLabel(/単発レッスン/).check();
  await page.getByLabel(/出張を希望する/).check();
  check(`${label}: travel area appears for visiting`, (await page.locator("#field-travelArea").count()) === 1);
  await page.fill("#field-travelArea", "川崎市中原区");
  await page.fill("#field-preferred1", "2026-12-05T10:00");
  await page.screenshot({ path: `${outDir}/${label}-lesson-step2.png`, fullPage: true });
  await page.getByRole("button", { name: "次へ" }).click();

  await page.selectOption("#field-experience", "1to3");
  await page.getByLabel("音程").check();
  await page.getByLabel("運弓（ボウイング）").check();
  await page.fill("#field-goals", "音程を安定させたい");
  await page.locator("#field-consent").check();
  await page.getByRole("button", { name: "入力内容を確認する" }).click();
  check(`${label}: confirm screen shows plan with price`, (await page.getByText("単発レッスン（60分 6,000円）").count()) === 1);
  await page.screenshot({ path: `${outDir}/${label}-lesson-confirm.png`, fullPage: true });

  // 二重送信: ボタンを素早く 2 回押す
  const submitBtn = page.getByRole("button", { name: "この内容で申し込む" });
  await Promise.all([submitBtn.click(), submitBtn.click({ force: true }).catch(() => {})]);
  await page.getByText("お申し込みを受け付けました").waitFor({ timeout: 20000 });
  const receipt = (await page.locator("p.font-mono").first().textContent())?.trim();
  check(`${label}: lesson done screen shows receipt`, /^SON-\d{6}-\d{5}$/.test(receipt ?? ""), receipt);
  await page.screenshot({ path: `${outDir}/${label}-lesson-done.png`, fullPage: true });
  const { data: lessonRows } = await service.from("applications").select("*").eq("email", "e2e-lesson@example.com").eq("name", "テスト 太郎");
  const mine = (lessonRows ?? []).filter((r) => r.receipt_no === receipt);
  check(`${label}: lesson saved once in DB`, mine.length === 1 && (lessonRows ?? []).filter((r) => r.created_at >= mine[0]?.created_at).length === 1, `rows=${lessonRows?.length}`);
  check(`${label}: lesson payload saved`, mine[0]?.payload?.travelArea === "川崎市中原区" && mine[0]?.payload?.concerns?.includes("bowing"));

  // ---------- 運指・ボウイング ----------
  await page.goto(`${base}/ja/bowing/apply/`, { waitUntil: "networkidle" });
  await page.fill("#field-name", "テスト 花子");
  await page.fill("#field-email", "e2e-bowing@example.com");
  await page.getByRole("button", { name: "次へ" }).click();
  await page.selectOption("#field-instrument", "violin");
  await page.fill("#field-title", "パルティータ 第2番");
  await page.fill("#field-composer", "J. S. バッハ");
  await page.getByLabel("運指のみ").check();
  await page.fill("#field-pages", "3");
  const priceText = async () => (await page.locator("aside[aria-live]").textContent()) ?? "";
  check(`${label}: price fingering 3p = 3,000円`, (await priceText()).includes("3,000円"));
  await page.getByLabel("運指＋ボウイング").check();
  check(`${label}: price both 3p = 4,500円 (recalculated)`, (await priceText()).includes("4,500円"));
  await page.fill("#field-pages", "12");
  check(`${label}: >10 pages shows consultation, no auto discount`, (await priceText()).includes("18,000円") && (await priceText()).includes("割引・個別のお見積もり"));
  await page.fill("#field-pages", "3");
  // ファイル: PDF を 1 つ（3 ページ分の目印を含む）
  const pdf = Buffer.from("%PDF-1.4\n1 0 obj<</Type /Page>>endobj\n2 0 obj<</Type /Page>>endobj\n3 0 obj<</Type /Page>>endobj\n4 0 obj<</Type /Pages>>endobj\n%%EOF\n");
  await page.setInputFiles("#field-files", { name: "score.pdf", mimeType: "application/pdf", buffer: pdf });
  await page.waitForTimeout(300);
  check(`${label}: PDF page count hint`, (await page.getByText("読み取ったページ数は 3 ページ").count()) === 1);
  await page.screenshot({ path: `${outDir}/${label}-bowing-step2.png`, fullPage: true });
  await page.getByRole("button", { name: "次へ" }).click();
  await page.locator("#field-rightsConfirm").check();
  await page.locator("#field-consent").check();
  await page.getByRole("button", { name: "入力内容を確認する" }).click();
  await page.getByRole("button", { name: "この内容で申し込む" }).click();
  await page.getByText("お申し込みを受け付けました").waitFor({ timeout: 20000 });
  const receipt2 = (await page.locator("p.font-mono").first().textContent())?.trim();
  check(`${label}: bowing done (no upload failure)`, (await page.getByText("送信できませんでした").count()) === 0, receipt2);
  const { data: bow } = await service.from("applications").select("id, quote").eq("receipt_no", receipt2).single();
  check(`${label}: bowing price stored server-side`, bow?.quote?.totalYen === 4500);
  const { data: files } = await service.from("application_files").select("uploaded, storage_path").eq("application_id", bow?.id);
  check(`${label}: attachment uploaded to private storage`, files?.length === 1 && files[0].uploaded === true);

  // ---------- 英語表示 ----------
  await page.goto(`${base}/en/bowing/apply/`, { waitUntil: "networkidle" });
  check(`${label}: English form renders`, (await page.getByRole("heading", { name: "Bowing & fingering request" }).count()) === 1);
  await page.screenshot({ path: `${outDir}/${label}-bowing-en.png`, fullPage: true });

  check(`${label}: no page errors`, errors.length === 0, errors.slice(0, 2).join(" | "));
  await context.close();
  return receipt;
}

const receipt = await run({ width: 1440, height: 900 }, "desktop");
await run({ width: 390, height: 844 }, "mobile");

// ---------- 管理画面 ----------
const pw = `Pw-${crypto.randomUUID()}`;
const { data: created } = await service.auth.admin.createUser({ email: "e2e-admin@example.com", password: pw, email_confirm: true });
await service.from("admins").insert({ user_id: created.user.id });
const { data: plain } = await service.auth.admin.createUser({ email: "e2e-user@example.com", password: pw, email_confirm: true });

const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: "ja-JP" });
const page = await ctx.newPage();

// 管理人ではない利用者
await page.goto(`${base}/admin/`, { waitUntil: "networkidle" });
await page.screenshot({ path: `${outDir}/admin-login.png`, fullPage: true });
await page.fill('input[type="email"]', "e2e-user@example.com");
await page.fill('input[type="password"]', pw);
await page.getByRole("button", { name: "ログイン" }).click();
await page.getByText("管理権限がありません").waitFor({ timeout: 10000 });
check("admin: non-admin user is refused", true);
await page.getByRole("button", { name: "ログアウト" }).click();

// 管理人
await page.fill('input[type="email"]', "e2e-admin@example.com");
await page.fill('input[type="password"]', pw);
await page.getByRole("button", { name: "ログイン" }).click();
await page.getByText(receipt).first().waitFor({ timeout: 10000 });
check("admin: application appears in list", true);
await page.getByText(receipt).first().click();
await page.getByText("申し込み内容").waitFor();
check("admin: detail shows applicant data", (await page.getByText("e2e-lesson@example.com").count()) >= 1);
await page.selectOption('article select', "reviewing");
await page.fill('input[aria-label="状態変更のメモ"]', "E2E 確認");
await page.getByRole("button", { name: "変更", exact: true }).click();
await page.getByText("状態を変更しました").waitFor({ timeout: 10000 });
const { data: after } = await service.from("applications").select("status").eq("receipt_no", receipt).single();
check("admin: status change saved", after?.status === "reviewing");
await page.screenshot({ path: `${outDir}/admin-dashboard.png`, fullPage: true });
await ctx.close();
await service.auth.admin.deleteUser(plain.user.id);

await browser.close();
writeFileSync(`${outDir}/e2e-checks.txt`, log.join("\n") + "\n");
const failed = log.filter((l) => l.startsWith("FAIL"));
console.log(`\n${log.length - failed.length}/${log.length} passed`);
process.exit(failed.length ? 1 : 0);
