# 申し込みフォームの保存基盤（Supabase）設定手順

フォーム（レッスン・運指運弓・録音の統合申込／演奏依頼／講師登録）の送信内容を Supabase に保存するための手順です。
決定の経緯: [decisions/0004-launch-decisions-20261128.md](./decisions/0004-launch-decisions-20261128.md)（決定 2: フォームは Supabase）

## 構成

```
サイト（静的） ──POST──▶ Edge Function `submit` ──▶ private.accept_submission() ──▶ public.submissions
                          Origin・入力検証             送信回数制限・二重送信防止       管理人だけ読める（RLS）
```

- 一般利用者はデータベースを直接読み書きできません。書き込みは受付関数だけが行います
- 受付関数はランタイムが自動で渡す接続情報（`SUPABASE_DB_URL`）を使います。秘密キーをコードや GitHub Variables に置きません
- IP アドレスはソルト付きハッシュだけを保存し、1 日で消します
- 画面の概算料金は参考値として保存します。料金の確定は管理人が行います

## プロジェクト

| 項目 | 値 |
|---|---|
| Project URL | `https://oqhehjaeqjsuyblokonz.supabase.co` |
| Project ref | `oqhehjaeqjsuyblokonz` |
| Region | Northeast Asia (Tokyo) |

## 運営者が行うこと

### 1. GitHub の Secrets を登録する（1 回だけ）

リポジトリの **Settings → Secrets and variables → Actions → Secrets** で登録します。**チャットやコードには貼りません。**

| 名前 | 値 |
|---|---|
| `SUPABASE_ACCESS_TOKEN` | https://supabase.com/dashboard/account/tokens で「Generate new token」 |
| `SUPABASE_DB_PASSWORD` | プロジェクト作成時の Database password |

### 2. 本番に反映する

**Actions → Supabase deploy → Run workflow** を開き、`confirm` に `deploy` と入力して実行します。
データベース定義の適用・受付関数の公開・動作確認（何も保存しない送信）まで自動で行います。

### 3. サイトに接続する

反映が成功したら、**Settings → Secrets and variables → Actions → Variables** で登録します（公開してよい値です）。

| 名前 | 値 |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | `https://oqhehjaeqjsuyblokonz.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | `sb_publishable_` で始まる公開キー |

その後 **Actions → Preview (GitHub Pages) → Run workflow** でプレビューを作り直すと、フォームの「未接続」表示が消え、送信できるようになります。
同じ変数で、停止防止の定期アクセス（`keepalive.yml`、週 2 回）も動き始めます。

### 4. 届いた申し込みを見る（管理画面の接続までの間）

Supabase の **Table Editor → submissions** に 1 件ずつ保存されます。

- `kind`: lesson / bowing / recording / performance_quote / teacher_application
- `receipt_no`: 受付番号（`SN-YYMMDD-XXXXX`）
- `payload`: フォームの入力内容すべて
- テストで送った申し込みは、Table Editor で行を選んで削除します

### 5. 管理人への通知メール（Resend）

申し込みが届くと、種類・受付番号・日時だけを書いたメールが届きます（氏名・連絡先・入力内容は載せません）。

1. https://resend.com/ で、通知を受け取るメールアドレスでアカウントを作る
2. 「API Keys → Create API Key」（Permission: Sending access）
3. Secrets に登録: `RESEND_API_KEY`（`re_` で始まるキー）、`ADMIN_NOTIFY_EMAIL`（通知を受け取るアドレス）
4. 手順 2（Supabase deploy）をもう一度実行する。ログに「通知メール: 設定しました」と出れば完了

送信元は、独自ドメインを Resend で認証するまで Resend の共用アドレス（`onboarding@resend.dev`）です。共用アドレスは Resend アカウント本人のアドレスにしか届かないため、`ADMIN_NOTIFY_EMAIL` は Resend に登録したアドレスと同じにします。

### 6. 本番ドメインが決まったら

Variables に `ALLOWED_ORIGINS` を登録し（例: `https://sonaria.jp,https://mukkoo0701office-max.github.io`）、手順 2 をもう一度実行します。

## 未対応（次の段階）

- 管理画面（/admin）を Supabase に接続する（ログイン・一覧・状態変更）
- サービスの料金をサーバー側で計算し直す（現在は画面の概算を参考値として保存）

## CI

`Backend` ワークフローが、CI の中でローカルの Supabase を起動して次を確認します（本番には接続しません）。

- 3 種類のフォームの保存と受付番号
- 二重送信（同時 2 回）で 1 件だけ保存
- 入力不備・送信 ID なし・許可されていない Origin の拒否
- 送信回数制限（429）と、IP を平文で保存しないこと
- 一般利用者が API から申し込みデータを読めない・受付処理を直接呼べないこと
