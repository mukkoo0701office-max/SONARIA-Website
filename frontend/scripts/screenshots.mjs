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

  // 楽譜の簡易検索 → 楽譜検索ページへ条件を引き継ぐ
  await page.goto(`${base}/ja/`, { waitUntil: "networkidle" });
  await page.fill("#quick-score-q", "ベートーヴェン");
  await page.locator('form:has(#quick-score-q) fieldset:has(legend:has-text("演奏人数")) button', { hasText: "4人" }).first().click();
  await page.selectOption("#quick-score-fmt", "string-quartet");
  await page.waitForTimeout(200);
  const homeCount = await page.locator('form:has(#quick-score-q) [aria-live="polite"]').innerText();
  check(`${vpName}: home score search shows live count`, /9作品が該当/.test(homeCount), homeCount);
  await shot(page, `${vpName}-ja-home-score-search`, false);
  await page.locator("#quick-score-q").scrollIntoViewIfNeeded();
  await page.locator('form:has(#quick-score-q)').screenshot({ path: `${outDir}/${vpName}-ja-home-score-search-form.png` });
  await page.locator('form:has(#quick-score-q) button[type="submit"]').click();
  await page.waitForURL(/scores\/\?/);
  await page.waitForTimeout(500);
  const fromHomeCount = Number(await page.locator('[aria-live="polite"] span').first().innerText());
  check(`${vpName}: score quick search carries query`, decodeURIComponent(page.url()).includes("q=ベートーヴェン") && page.url().includes("fmt=string-quartet") && page.url().includes("players=4") && fromHomeCount === 9, `${page.url()} → ${fromHomeCount}`);
  await shot(page, `${vpName}-ja-scores-from-home`);

  // 講師の簡易検索 → 講師検索ページへ条件を引き継ぐ
  await page.goto(`${base}/ja/`, { waitUntil: "networkidle" });
  await page.selectOption("#quick-category", "strings");
  await page.selectOption("#quick-pref", "13");
  await page.locator('form:has(#quick-category) button[type="submit"]').click();
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
  // 演奏依頼の見積もりフォーム: 未入力では確認へ進まず、送信先が未設定なら「届いていない」と表示する
  await page.goto(`${base}/ja/performance/`, { waitUntil: "networkidle" });
  await shot(page, `${vpName}-ja-performance`);
  await shot(page, `${vpName}-ja-performance-top`, false);
  await page.locator('form:has(#pd-name) button[type="submit"]').click();
  check(`${vpName}: performance form blocks empty submit`, (await page.locator("text=入力内容に不足があります").count()) > 0 && (await page.locator("h2", { hasText: "入力内容の確認" }).count()) === 0);
  await page.locator('label:has(input[name="schedule"][value="candidates"])').click();
  await page.fill("#pd-date-0", "2027-03-20");
  await page.locator('button', { hasText: "候補日を追加" }).click();
  await page.fill("#pd-date-1", "2027-03-27");
  await page.locator('label:has(input[name="budget"][value="100to200k"])').click();
  await page.locator('label:has(input[name="ensemble"][value="quartet"])').click();
  await page.fill("#pd-remarks", "表示確認用のテスト入力です。");
  await page.fill("#pd-name", "テスト");
  await page.fill("#pd-email", "test@example.com");
  await page.locator("#pd-consent").check();
  await page.locator('form:has(#pd-name) button[type="submit"]').click();
  await page.locator("h2", { hasText: "入力内容の確認" }).waitFor();
  await page.waitForTimeout(800); // スクロールと描画が終わるのを待つ
  await shot(page, `${vpName}-ja-performance-confirm`);
  await page.locator("button", { hasText: "無料で見積もりを依頼する" }).click();
  await page.locator("h2", { hasText: "オンライン送信は準備中です" }).waitFor();
  check(`${vpName}: performance form shows not-connected (no fake success)`, (await page.locator("h2", { hasText: "受け付けました" }).count()) === 0);
  await page.waitForTimeout(800);
  await shot(page, `${vpName}-ja-performance-result`, false);

  // 講師登録: 講師検索の近くに登録ボタン → 登録ページ
  await page.goto(`${base}/ja/teachers/`, { waitUntil: "networkidle" });
  await page.locator("a", { hasText: "講師として無料登録する" }).first().click();
  await page.waitForURL(/teachers\/register\//);
  check(`${vpName}: teacher register CTA links to register page`, page.url().includes("/ja/teachers/register/"), page.url());
  await page.waitForTimeout(300);
  await shot(page, `${vpName}-ja-teacher-register`);
  const registerOverflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  check(`${vpName}: register page has no horizontal overflow`, registerOverflow <= 0, String(registerOverflow));
  check(`${vpName}: register form has no fee field`, (await page.locator("text=/料金を入力|レッスン料金（/").count()) === 0);
  await page.goto(`${base}/en/teachers/register/`, { waitUntil: "networkidle" });
  await shot(page, `${vpName}-en-teacher-register`);
  await page.goto(`${base}/en/performance/`, { waitUntil: "networkidle" });
  await shot(page, `${vpName}-en-performance`);

  await page.goto(`${base}/en/lessons/`, { waitUntil: "networkidle" });
  await shot(page, `${vpName}-en-lessons`);
  await page.goto(`${base}/en/scores/`, { waitUntil: "networkidle" });
  await shot(page, `${vpName}-en-scores`);
  await page.goto(`${base}/ja/scores/`, { waitUntil: "networkidle" });
  await shot(page, `${vpName}-ja-scores`, false);
  // 楽譜検索の絞り込み（楽器 × 編成）。件数付きのチップで選び、URL に残ること
  await page.locator('fieldset:has(legend:has-text("楽器")) button', { hasText: "ヴィオラ" }).first().click();
  await page.locator('fieldset:has(legend:has-text("編成")) button', { hasText: "弦楽四重奏" }).first().click();
  await page.waitForTimeout(300);
  const facetUrl = page.url();
  const facetCount = Number(await page.locator('[aria-live="polite"] span').first().innerText());
  check(`${vpName}: score facets (viola × string quartet)`, facetUrl.includes("inst=viola") && facetUrl.includes("fmt=string-quartet") && facetCount > 0, `${facetUrl} → ${facetCount}`);
  const scoresOverflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  check(`${vpName}: scores page has no horizontal overflow`, scoresOverflow <= 0, String(scoresOverflow));
  await shot(page, `${vpName}-ja-scores-facets`, false);

  // 楽譜ライブラリ（カタログの作品ページ・作曲家ページ）
  for (const [path, name] of [["ja/scores/beethoven-violin-sonata-5", "ja-work"], ["ja/scores/tchaikovsky-serenade-for-strings", "ja-work-strings"], ["ja/composers/beethoven", "ja-composer"], ["ja/composers", "ja-composers"], ["ja/scores/category/string-quartet", "ja-category"], ["ja/scores/haydn-string-quartets-op20", "ja-work-haydn-op20"]]) {
    const res = await page.goto(`${base}/${path}/`, { waitUntil: "networkidle" });
    check(`${vpName}: /${path}/ loads`, res && res.status() === 200, String(res && res.status()));
    await shot(page, `${vpName}-${name}`);
  }
  // プレビュー環境では PDF をリリースの添付ファイルから取得する（ダウンロードのリンクが外部 URL になる）
  await page.goto(`${base}/ja/scores/beethoven-violin-sonata-5/`, { waitUntil: "networkidle" });
  const dl = await page.locator("a[download]").first().getAttribute("href");
  // Amazon の広告枠: ページ最下部の 1 枠だけ（運営者の指示 2026-11-27）。トラッキング ID と rel="sponsored"、関連作品より後
  const adSel = 'aside#amazon-search, aside[aria-labelledby="amazon-search"], aside[aria-labelledby="amazon-banner"], aside[aria-labelledby="amazon-related"]';
  const adCount = await page.locator(adSel).count();
  const adHref = await page.locator(`${adSel}`).first().locator("a").first().getAttribute("href");
  const adRel = await page.locator(`${adSel}`).first().locator("a").first().getAttribute("rel");
  check(`${vpName}: work page has exactly 1 Amazon slot`, adCount === 1, String(adCount));
  check(`${vpName}: Amazon link has tag and sponsored rel`, Boolean(adHref && adHref.includes("tag=mukkoo-22") && adRel && adRel.includes("sponsored")), `${adHref} ${adRel}`);
  const order = await page.evaluate((sel) => {
    const dl = document.querySelector("a[download]");
    const ad = document.querySelector(sel);
    const related = document.querySelector("#related");
    const afterDl = dl && ad ? Boolean(dl.compareDocumentPosition(ad) & Node.DOCUMENT_POSITION_FOLLOWING) : false;
    const afterRelated = related && ad ? Boolean(related.compareDocumentPosition(ad) & Node.DOCUMENT_POSITION_FOLLOWING) : true;
    return afterDl && afterRelated;
  }, adSel);
  check(`${vpName}: Amazon slot is at the bottom (after downloads and related works)`, order);
  await page.locator(adSel).first().scrollIntoViewIfNeeded();
  await shot(page, `${vpName}-ja-work-amazon-banner`, false);
  check(`${vpName}: PDF download points to release asset`, Boolean(dl && dl.includes("/releases/download/scores-v1/")), String(dl));

  // 統合申込フォーム（Issue #13）。料金の受け入れテストと、送信先未設定時に「未接続」を表示することを確かめる
  const yenText = async () => (await page.locator("#order-summary + dl, section[aria-labelledby='order-summary'] dl").first().innerText()).replace(/\s+/g, " ").trim();
  await page.goto(`${base}/ja/apply/?service=recording`, { waitUntil: "networkidle" });
  const inc = (id, n) => page.locator(`button[aria-label^="${id}"][aria-label$="1つ増やす"]`).first();
  for (const [inst, n] of [["ヴァイオリン", 2], ["ヴィオラ", 1], ["チェロ", 1]]) for (let i = 0; i < n; i++) await inc(inst).click();
  const totalBase = await yenText();
  check(`${vpName}: recording Vn2+Va1+Vc1 = ¥41,000`, /合計 ¥41,000$/.test(totalBase), totalBase);
  await page.locator('label:has(input[name="delivery-recording"][value="nextDay"])').click();
  const totalNext = await yenText();
  check(`${vpName}: recording next-day = ¥49,200`, /合計 ¥49,200$/.test(totalNext), totalNext);
  await shot(page, `${vpName}-ja-apply-recording`);
  await page.goto(`${base}/ja/apply/?service=bowing&composer=Beethoven&title=Spring&part=Violin`, { waitUntil: "networkidle" });
  check(`${vpName}: bowing prefill from score page`, (await page.locator("#score").inputValue()) === "Beethoven Spring (Violin)");
  const bowTotal = await yenText();
  check(`${vpName}: bowing set 1 page = ¥1,500`, /合計 ¥1,500$/.test(bowTotal), bowTotal);
  await page.fill("#name", "テスト");
  await page.fill("#email", "test@example.invalid");
  await page.locator('input[type="checkbox"]').check();
  await shot(page, `${vpName}-ja-apply-bowing`);
  await page.locator('form button[type="submit"]').click();
  await page.getByRole("button", { name: "この内容で申し込む" }).click();
  check(`${vpName}: submission shows not-connected`, await page.getByRole("heading", { name: "オンライン送信は準備中です" }).isVisible());
  await shot(page, `${vpName}-ja-apply-not-connected`);
  await page.goto(`${base}/ja/apply/?service=lesson`, { waitUntil: "networkidle" });
  await page.locator('label:has(input[name="trial"][value="yes"])').click();
  check(`${vpName}: trial disabled after yes`, await page.locator('input[name="plan"][value="trial"]').isDisabled());
  await page.locator('label:has(input[name="plan"][value="single"])').click();
  await page.locator('[role="tabpanel"] button[aria-pressed]').nth(1).click();
  await page.locator('[role="tabpanel"] [role="group"] button:not([disabled])').first().click();
  await page.locator('[role="tabpanel"] [role="group"] button:not([disabled])').nth(2).click();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  check(`${vpName}: apply page has no horizontal overflow`, overflow <= 0, String(overflow));
  check(`${vpName}: lesson candidates listed with priority`, (await page.locator("text=第2希望").count()) === 1);
  await shot(page, `${vpName}-ja-apply-lesson`);
  await page.goto(`${base}/en/apply/?service=recording`, { waitUntil: "networkidle" });
  await shot(page, `${vpName}-en-apply-recording`);

  check(`${vpName}: no page errors`, errors.length === 0, errors.slice(0, 3).join(" | "));
  await context.close();
}

await browser.close();
writeFileSync(`${outDir}/checks.txt`, log.join("\n") + "\n");
console.log(log.join("\n"));
