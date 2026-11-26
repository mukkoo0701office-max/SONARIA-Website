// プレビュー用ビルド（out/）をブラウザで開いて画面を撮影し、操作を確認する（CI 専用）。
// 使い方: node scripts/screenshots.mjs <baseURL> <出力先ディレクトリ>
import { chromium } from "playwright";
import { mkdirSync, writeFileSync } from "node:fs";

const [base, outDir] = process.argv.slice(2);
mkdirSync(outDir, { recursive: true });
const log = [];
const check = (name, ok, detail = "") => log.push(`${ok ? "OK  " : "FAIL"} ${name}${detail ? " — " + detail : ""}`);

const browser = await chromium.launch();
const viewports = { desktop: { width: 1440, height: 900 }, mobile: { width: 390, height: 844 } };

async function shot(page, name, fullPage = true) {
  await page.screenshot({ path: `${outDir}/${name}.png`, fullPage });
}

for (const [vpName, viewport] of Object.entries(viewports)) {
  const context = await browser.newContext({ viewport, reducedMotion: "no-preference", locale: "ja-JP" });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => m.type() === "error" && errors.push(m.text()));

  for (const lang of ["ja", "en"]) {
    await page.goto(`${base}/${lang}/`, { waitUntil: "networkidle" });
    await shot(page, `${vpName}-${lang}-home`);
    await shot(page, `${vpName}-${lang}-home-top`, false);
  }

  await page.goto(`${base}/ja/`, { waitUntil: "networkidle" });
  // 透明になってはいけない部分（色の透明度指定が効いているか）
  const transparent = "rgba(0, 0, 0, 0)";
  const dotBg = await page.locator('[aria-roledescription="carousel"] ul button span').nth(1).evaluate((el) => getComputedStyle(el).backgroundColor);
  check(`${vpName}: inactive indicator dot visible`, dotBg !== transparent, dotBg);
  const headerBg = await page.locator("header").first().evaluate((el) => getComputedStyle(el).backgroundColor);
  check(`${vpName}: sticky header has background`, headerBg !== transparent, headerBg);
  if (vpName === "desktop") {
    const arrowBg = await page.locator(`[aria-roledescription="carousel"] button[aria-label="前のスライド"]`).first().evaluate((el) => getComputedStyle(el).backgroundColor);
    check("desktop: hero arrow visible", arrowBg !== transparent, arrowBg);
  }
  await page.mouse.wheel(0, 900);
  await page.waitForTimeout(400);
  await shot(page, `${vpName}-ja-scrolled`, false);
  await page.mouse.wheel(0, -2000);

  // スライダー: 次へ・インジケーター
  const indicator = page.locator('[aria-roledescription="carousel"] ul button').nth(2);
  await indicator.click();
  await page.waitForTimeout(700);
  check(`${vpName}: indicator moves to slide 3`, (await indicator.getAttribute("aria-current")) === "true");
  const activeSlides = await page.locator('[aria-roledescription="slide"]:not([inert])').count();
  check(`${vpName}: exactly one active slide`, activeSlides === 1, `active=${activeSlides}`);
  await shot(page, `${vpName}-ja-hero-slide3`, false);

  // 一時停止ボタン
  const pause = page.locator('[aria-roledescription="carousel"] button[aria-label="自動再生を停止"]');
  check(`${vpName}: pause button present`, (await pause.count()) === 1);

  // スマホ: ハンバーガー
  if (vpName === "mobile") {
    const menuBtn = page.locator("header button[aria-expanded]");
    await menuBtn.click();
    await page.waitForTimeout(300);
    check("mobile: menu opens", (await menuBtn.getAttribute("aria-expanded")) === "true");
    await shot(page, "mobile-ja-menu-open", false);
    await page.keyboard.press("Escape");
    check("mobile: Esc closes menu", (await menuBtn.getAttribute("aria-expanded")) === "false");

    // スワイプ
    await page.goto(`${base}/ja/`, { waitUntil: "networkidle" });
    const track = page.locator('[aria-roledescription="carousel"] .touch-pan-y');
    const box = await track.boundingBox();
    await page.mouse.move(box.x + box.width * 0.8, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width * 0.2, box.y + box.height / 2, { steps: 8 });
    await page.mouse.up();
    await page.waitForTimeout(700);
    const second = page.locator('[aria-roledescription="carousel"] ul button').nth(1);
    check("mobile: swipe left goes to slide 2", (await second.getAttribute("aria-current")) === "true");
    check("mobile: swipe does not navigate", page.url().endsWith("/ja/"), page.url());
  }

  // 講師の簡易検索 → 講師検索ページへ条件を引き継ぐ
  await page.goto(`${base}/ja/`, { waitUntil: "networkidle" });
  await page.selectOption("#quick-category", "strings");
  await page.selectOption("#quick-pref", "13");
  await page.click('form button[type="submit"]');
  await page.waitForURL(/teachers/);
  await page.waitForTimeout(500);
  check(`${vpName}: quick search carries query`, page.url().includes("category=strings") && page.url().includes("pref=13"), page.url());
  const cards = await page.locator('section[aria-label="講師の検索結果"] article').count();
  check(`${vpName}: teacher results shown`, cards > 0, `cards=${cards}`);
  await shot(page, `${vpName}-ja-teachers`);

  // プロフィール
  await page.locator('section[aria-label="講師の検索結果"] article a').first().click();
  await page.waitForURL(/teachers\/profile/);
  await page.waitForTimeout(500);
  await shot(page, `${vpName}-ja-teacher-profile`);

  // ナビの全ページが表示できるか（直接アクセス）
  for (const path of ["scores", "bowing", "lessons", "recording", "performance", "community", "profile", "about", "contact", "legal/privacy"]) {
    const res = await page.goto(`${base}/ja/${path}/`, { waitUntil: "networkidle" });
    check(`${vpName}: /ja/${path}/ loads`, res && res.status() === 200, String(res && res.status()));
  }
  for (const path of ["bowing", "lessons", "recording", "community", "profile"]) {
    await page.goto(`${base}/ja/${path}/`, { waitUntil: "networkidle" });
    await shot(page, `${vpName}-ja-${path}`);
  }
  await page.goto(`${base}/en/lessons/`, { waitUntil: "networkidle" });
  await shot(page, `${vpName}-en-lessons`);
  await page.goto(`${base}/en/scores/`, { waitUntil: "networkidle" });
  await shot(page, `${vpName}-en-scores`);

  // 申し込みフォーム（このビルドはバックエンド未接続）: 未接続表示と送信ボタンの無効化
  await page.goto(`${base}/ja/lessons/apply/`, { waitUntil: "networkidle" });
  check(`${vpName}: apply form shows not-connected notice`, (await page.getByText("オンラインでのお申し込みは準備中").count()) >= 1);
  await shot(page, `${vpName}-ja-lesson-apply`);
  await page.goto(`${base}/ja/bowing/apply/`, { waitUntil: "networkidle" });
  await shot(page, `${vpName}-ja-bowing-apply`);
  await page.goto(`${base}/admin/`, { waitUntil: "networkidle" });
  check(`${vpName}: admin shows not-connected`, (await page.getByText("バックエンドが未接続です").count()) === 1);

  check(`${vpName}: no page errors`, errors.length === 0, errors.slice(0, 3).join(" | "));
  await context.close();
}

await browser.close();
writeFileSync(`${outDir}/checks.txt`, log.join("\n") + "\n");
console.log(log.join("\n"));
