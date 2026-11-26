# SONARIA frontend

Next.js 15（App Router）＋ TypeScript ＋ Tailwind CSS v3。静的書き出しで `out/` に出力します。

- 開発環境・デプロイ: [docs/setup.md](../docs/setup.md)
- 方針・ルール: [CLAUDE.md](../CLAUDE.md)
- 構成の決定記録: [docs/decisions/0001-phase1-static-site.md](../docs/decisions/0001-phase1-static-site.md)

## ディレクトリ

```
src/
├── app/
│   ├── (root)/          / の予備の言語振り分け（本番は public/.htaccess）
│   ├── [locale]/        /ja/... と /en/... のページ
│   └── globals.css      デザイントークン（CSS 変数）
├── components/
│   ├── layout/          ヘッダー・フッター・言語切替
│   ├── scores/          楽譜検索
│   └── ui/              チップ・セレクト・タグ・ページ送りなどの共通部品
├── data/
│   ├── dictionaries/    日英の文言（同じ型で管理）
│   ├── works.ts         作品データ（現在はデモデータ）
│   └── site.ts          ナビゲーション
└── lib/i18n.ts          言語設定
public/.htaccess         さくら用: / の言語振り分け・404
```
