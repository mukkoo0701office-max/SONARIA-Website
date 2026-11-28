// さくら（Apache）用の .htaccess を、言語の登録表（src/lib/i18n.ts）の「公開中の言語」から作る。
// トップページ（/）だけを言語別ページへ振り分ける: 1. 本人が選んだ言語（Cookie）→ 2. ブラウザの第一言語 → 3. 英語。
// 言語の付いた URL（/ja/... など）は振り分けない（明示された URL の言語を優先し、検索エンジンの巡回を妨げない）
export function buildHtaccess(published, { cookie = "sonaria_lang", fallback = "en" } = {}) {
  const lines = [
    "# SONARIA: さくらのレンタルサーバ（Apache）用",
    "# このファイルはビルド時に自動生成（frontend/scripts/htaccess.mjs）。直接編集しない",
    "# docs/decisions/0001-phase1-static-site.md / docs/i18n/I18N_FOUNDATION.md",
    "",
    "DirectoryIndex index.html",
    "ErrorDocument 404 /404.html",
    "",
    "<IfModule mod_rewrite.c>",
    "  RewriteEngine On",
    "",
    "  # 1. 本人が選んだ言語（Cookie）を最優先",
  ];
  for (const l of published) {
    lines.push(`  RewriteCond %{HTTP_COOKIE} (^|;\\s*)${cookie}=${l}(;|$)`, `  RewriteRule ^$ /${l}/ [R=302,L]`);
  }
  lines.push("", "  # 2. ブラウザの第一言語が公開中の言語ならその言語へ");
  for (const l of published) {
    if (l === fallback) continue;
    lines.push(`  RewriteCond %{HTTP:Accept-Language} ^${l} [NC]`, `  RewriteRule ^$ /${l}/ [R=302,L]`);
  }
  lines.push("", `  # 3. それ以外は ${fallback}`, `  RewriteRule ^$ /${fallback}/ [R=302,L]`, "</IfModule>", "");
  lines.push(
    "<IfModule mod_headers.c>",
    "  # 振り分け結果が Cookie と言語設定で変わることをキャッシュに伝える",
    "  <If \"%{REQUEST_URI} == '/'\">",
    '    Header append Vary "Accept-Language, Cookie"',
    "  </If>",
    "</IfModule>",
    "",
  );
  return lines.join("\n");
}
