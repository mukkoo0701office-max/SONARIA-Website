# 多言語対応の基盤（Phase 1）

決定（2026-11-28）: 10 言語ではなく、**日本語・英語＋欧州の代表言語（ドイツ語・フランス語・スペイン語・イタリア語）** に絞る。Phase 1 は基盤だけで、日英サイトの見た目・URL は変えない。

## 仕組み

| 部品 | 場所 | 役割 |
|---|---|---|
| 言語の登録表 | `frontend/src/lib/i18n.ts` の `localeRegistry` | 全言語のコード・自国語名・`lang`・OGP・書式・**公開するか**・補う言語 |
| 公開中の言語 | 同 `locales` | ページを作る・リンクする・サイトマップと hreflang に載せる言語。登録表の `published` と一致（テストで確認） |
| UI の辞書 | `frontend/src/data/dictionaries/` | 日英は全項目必須。他の言語は一部だけでよく、足りない項目は英語で補う（`getDictionaryFor`） |
| コンテンツの文 | `LocalizedText`・`pickLocalized` | `ja`・`en` 必須、他は任意。無ければ補う言語 → 英語 → 日本語。補ったかどうかを返すので「原文」と表示できる |
| hreflang | `alternateLanguages` | 存在する言語どうしで相互参照。x-default は既定言語（日本語）のページ。1 言語だけのページには出さない |
| トップの振り分け | `frontend/scripts/htaccess.mjs`（postbuild で `out/.htaccess` を生成） | Cookie（本人の選択）→ ブラウザの第一言語（公開中の言語のみ）→ 英語。言語付きの URL は振り分けない |
| 言語の切り替え | `LanguageSwitcher` | 公開中が 2 言語まで「日本語 \| English」、3 言語以上でドロップダウン（地球アイコン＋今の言語名）。無いページへは 1 つ上の階層へ |
| 翻訳の状態 | `frontend/translations/status.json`・`scripts/translation-status.mjs` | 翻訳ごとに原文のハッシュと状態。原文が更新されると「要確認」。公開中の翻訳が古くなると CI が失敗 |

未公開の言語は URL を作らないため、翻訳のないページが検索エンジンに出ることはない。

## 言語を公開する手順（Phase 2 以降）

1. 辞書を作る（例: `dictionaries/de.ts`。一部だけでもよい）→ `index.ts` の `partialDictionaries` に登録
2. 公開するページのコンテンツに、その言語の文を足す（作品の概要など）。固有名詞・原題・作品番号は訳さない
3. 翻訳ごとに `translations/status.json` へ登録（`sourceHash` は `node scripts/translation-status.mjs --hash <source>`）。状態は 翻訳中 → レビュー待ち → 承認済み → 公開
4. `localeRegistry` の `published` と `locales` の両方に追加。`{ ja, en }` 前提のコード（下の一覧）を `pickLocalized` に置き換える
5. CI（ビルド・hreflang・リンク切れ・画面チェック）を通し、運営者の承認を得て公開

### 翻訳の品質

- Claude が下訳し、可能ならその言語の話者が確認してから「承認済み」にする（確認されない機械的な訳を大量に公開しない）
- 最初はトップ・楽譜検索・需要の高い作品に絞る

## 言語を公開するときに直す箇所（日英前提のコード）

- 作品・作曲家・講師などの `{ ja, en }` の文（約 160 か所）→ `pickLocalized` に
- `locale === "ja" ? … : …` の分岐（約 30 か所）
- 日付・数値の書式 `ja-JP` / `en-US`（約 14 か所）→ `localeConfig(locale).intl` に
- 入力補完（`lib/scores/suggest.ts`）・Amazon の検索語（`lib/affiliate/amazonSearch.ts`）の言語引数
- 申込・講師登録フォームと管理画面は、日英のままでよい（公開ページと登録・管理機能の対応範囲を分ける）
