// 管理画面（SONARIA_ADMIN_PREVIEW=1 のビルド）を開いて撮影し、操作を確認する（CI 専用）。
// 使い方: node scripts/admin-screenshots.mjs <baseURL> <出力先ディレクトリ>
import { chromium } from "playwright";
import { mkdirSync, writeFileSync } from "node:fs";

const [base, outDir] = process.argv.slice(2);
mkdirSync(outDir, { recursive: true });
const log = [];
const check = (name, ok, detail = "") => log.push(`${ok ? "OK  " : "FAIL"} ${name}${detail ? " — " + detail : ""}`);

const browser = await chromium.launch();
const viewports = { desktop: { width: 1440, height: 900 }, mobile: { width: 390, height: 844 } };
const sections = ["dashboard", "inquiries", "calendar", "teachers", "revenue", "analytics", "pdf", "notifications"];

async function shot(page, name, fullPage = true) {
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${outDir}/admin-${name}.png`, fullPage });
}
async function noOverflow(page, label) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  check(`${label}: no horizontal overflow`, overflow <= 0, String(overflow));
}

for (const [vp, viewport] of Object.entries(viewports)) {
  const context = await browser.newContext({ viewport, locale: "ja-JP" });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => m.type() === "error" && errors.push(m.text()));

  // ログイン画面: パスワードはブラウザで照合しない（未接続を表示）
  await page.goto(`${base}/admin/`, { waitUntil: "networkidle" });
  await page.locator("#admin-password").waitFor();
  await shot(page, `${vp}-login`, false);
  await page.fill("#admin-password", "test-password");
  await page.locator('form button[type="submit"]').click();
  await page.locator("#admin-login-msg").waitFor();
  check(`${vp}: login shows not-connected`, (await page.locator("#admin-login-msg").innerText()).includes("未接続"));
  check(`${vp}: password cleared after attempt`, (await page.inputValue("#admin-password")) === "");
  await shot(page, `${vp}-login-not-connected`, false);

  // 管理画面は未ログインでは見えない（ログインへ戻る）
  await page.goto(`${base}/admin/dashboard/`, { waitUntil: "networkidle" });
  await page.waitForURL(/\/admin\/$/);
  check(`${vp}: dashboard redirects to login without session`, /\/admin\/$/.test(page.url()), page.url());

  // デモで入る
  await page.locator("button", { hasText: "デモデータで画面を確認する" }).click();
  await page.waitForURL(/\/admin\/dashboard\//);
  await page.locator("h1", { hasText: "ダッシュボード" }).waitFor();
  check(`${vp}: demo banner visible`, (await page.locator('[role="note"]', { hasText: "デモデータ" }).count()) === 1);

  for (const s of sections) {
    await page.goto(`${base}/admin/${s}/`, { waitUntil: "networkidle" });
    await page.locator("h1").first().waitFor();
    await page.waitForTimeout(400);
    await noOverflow(page, `${vp} ${s}`);
    await shot(page, `${vp}-${s}`);
  }

  // お問い合わせ: 絞り込み（URL に残る）→ 詳細 → テンプレート → プレビュー → 送信（未接続）
  await page.goto(`${base}/admin/inquiries/`, { waitUntil: "networkidle" });
  await page.locator("#inq-q").waitFor();
  await page.locator("label", { hasText: "未返信のみ" }).click();
  await page.waitForTimeout(200);
  check(`${vp}: inquiry filter kept in URL`, page.url().includes("unreplied=1"), page.url());
  await page.goto(`${base}/admin/inquiries/detail/?id=demo-inq-1`, { waitUntil: "networkidle" });
  await page.locator("#d-template").waitFor();
  await page.selectOption("#d-template", "thanks");
  check(`${vp}: template fills reply`, (await page.inputValue("#d-body")).includes("佐藤"));
  await page.locator("button", { hasText: "プレビュー" }).click();
  await page.locator("dialog[open]").waitFor();
  await shot(page, `${vp}-inquiry-preview`, false);
  await page.locator("dialog[open] button", { hasText: "送信" }).click();
  await page.locator("text=送信していません").first().waitFor();
  const historyEntry = await page.locator("text=未接続（未送信）").first().waitFor({ timeout: 5000 }).then(() => true, () => false);
  check(`${vp}: reply is not sent (not connected)`, historyEntry);
  await shot(page, `${vp}-inquiry-detail`);

  // 講師: 審査を始める → 状態が変わる
  await page.goto(`${base}/admin/teachers/`, { waitUntil: "networkidle" });
  await page.locator("button", { hasText: "審査を始める" }).first().click();
  await page.waitForTimeout(400);
  check(`${vp}: teacher status changes`, (await page.locator("text=審査中").count()) > 0);

  // カレンダー: 週・日に切り替え
  await page.goto(`${base}/admin/calendar/`, { waitUntil: "networkidle" });
  await page.locator('button[aria-pressed]', { hasText: "週" }).click();
  await shot(page, `${vp}-calendar-week`);
  await page.locator('button[aria-pressed]', { hasText: "日" }).click();
  check(`${vp}: calendar day view`, (await page.locator('button[aria-pressed="true"]', { hasText: "日" }).count()) === 1);

  // 収益: 年別に切り替え、表で見る
  await page.goto(`${base}/admin/revenue/`, { waitUntil: "networkidle" });
  await page.locator('button[aria-pressed]', { hasText: "年別" }).click();
  await page.locator("section:has(#r-trend)").locator('button[aria-pressed]', { hasText: "表で見る" }).first().click();
  check(`${vp}: revenue table view`, (await page.locator("section:has(#r-trend) table").count()) > 0);

  // 英語に切り替え
  await page.goto(`${base}/admin/dashboard/`, { waitUntil: "networkidle" });
  await page.locator("button", { hasText: "English" }).click();
  await page.locator("h1", { hasText: "Dashboard" }).waitFor();
  check(`${vp}: switches to English`, (await page.locator("html").getAttribute("lang")) === "en");
  await shot(page, `${vp}-dashboard-en`);
  await page.goto(`${base}/admin/revenue/`, { waitUntil: "networkidle" });
  await page.locator("h1", { hasText: "Revenue" }).waitFor();
  await noOverflow(page, `${vp} revenue (en)`);
  await shot(page, `${vp}-revenue-en`);

  if (vp === "mobile") {
    await page.locator('button[aria-controls="admin-mobile-nav"]').click();
    await shot(page, `${vp}-menu-open`, false);
  }

  check(`${vp}: no page errors`, errors.length === 0, errors.slice(0, 3).join(" | "));
  await context.close();
}

await browser.close();
writeFileSync(`${outDir}/admin-checks.txt`, log.join("\n") + "\n");
console.log(log.join("\n"));
