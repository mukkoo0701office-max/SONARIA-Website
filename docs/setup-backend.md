# 申し込みシステムの設定手順（Supabase・Resend）

申し込みフォームを実際に使えるようにするための手順です。**アカウントの作成と設定は運営者が行います**（作業環境からは外部サービスに接続できないため）。
構成と理由: [decisions/0003-external-backend.md](./decisions/0003-external-backend.md)

所要時間の目安: 30〜60 分。費用: 無料プランの範囲なら 0 円。

---

## 1. Supabase のプロジェクトを作る

1. https://supabase.com/ でアカウントを作成（GitHub アカウントでログインできます）
2. 「New project」を押す
   - Name: `sonaria`
   - Database Password: 長いランダムな文字列（パスワード管理アプリに保存。**誰にも共有しない**）
   - Region: **Northeast Asia (Tokyo)**
   - Plan: Free
3. 作成後、左メニュー「Project Settings → API」で次の 2 つを控える
   - **Project URL**（例: `https://xxxx.supabase.co`）
   - **anon / publishable key**（公開してよいキー）
   - ※ `service_role` / secret key は**秘密キー**。どこにも貼らない（Edge Functions には自動で設定されます）

## 2. データベースを作る（マイグレーション）

いちばん簡単な方法:

1. Supabase の左メニュー「SQL Editor」を開く
2. リポジトリの `supabase/migrations/20261126000001_applications.sql` の中身をすべて貼り付けて「Run」
3. 左メニュー「Table Editor」に `applications` などのテーブルができていれば成功

（Supabase CLI を使う場合: `supabase link --project-ref <プロジェクトID>` → `supabase db push`）

## 3. ログインの設定

1. 左メニュー「Authentication → Sign In / Providers」
   - **Allow new users to sign up をオフ**（一般の人が勝手にアカウントを作れないようにする）
   - Email プロバイダは**オン**のまま（管理人のログインに使います）
2. 「Authentication → Users → Add user → Create new user」で管理人のアカウントを作る
   - メールアドレスとパスワードを入力し、「Auto Confirm User」にチェック
3. 作ったユーザーの **User UID** をコピーし、「SQL Editor」で次を実行（`<UID>` を置き換える）

   ```sql
   insert into public.admins (user_id) values ('<UID>');
   ```

   これで、そのアカウントだけが管理画面で申し込みを見られるようになります。

## 4. Edge Function を公開する

Supabase CLI が必要です（パソコンで 1 回だけ）。

```bash
# macOS の場合
brew install supabase/tap/supabase

cd SONARIA-Website
supabase login
supabase link --project-ref <プロジェクトID>   # Project URL の xxxx の部分
supabase functions deploy submit-application --no-verify-jwt
```

## 5. Edge Function の環境変数（秘密情報）

左メニュー「Edge Functions → Secrets」で、次を登録します（`supabase/functions/.env.example` 参照）。

| 名前 | 値 | 必須 |
|---|---|---|
| `ALLOWED_ORIGINS` | `https://mukkoo0701office-max.github.io`（本番ドメインが決まったら追加） | **必須** |
| `RATE_LIMIT_SALT` | ランダムな文字列（例: パスワード生成で 32 文字） | **必須** |
| `ADMIN_NOTIFY_EMAIL` | 通知を受け取るメールアドレス（Resend に登録したもの） | 通知を使うなら |
| `RESEND_API_KEY` | 手順 6 で作るキー | 通知を使うなら |
| `ADMIN_DASHBOARD_URL` | `https://mukkoo0701office-max.github.io/SONARIA-Website/admin/` | 任意 |
| `APPLICANT_EMAIL_ENABLED` | `false`（送信元ドメインを認証するまで） | — |
| `MAIL_FROM` | 送信元ドメインを認証したら `SONARIA <noreply@あなたのドメイン>` | — |
| `RATE_LIMIT_PER_HOUR` | `10`（送信元ごと・1 時間あたり） | 任意 |
| `TURNSTILE_SECRET_KEY` | Cloudflare Turnstile を使う場合 | 任意 |

## 6. Resend（メール）

1. https://resend.com/ でアカウントを作成（**通知を受け取りたいメールアドレス**で登録）
2. 「API Keys → Create API Key」→ Permission: **Sending access** → 作成されたキーを手順 5 の `RESEND_API_KEY` に登録
3. これで**管理人への通知**が届くようになります
4. **申込者への受付確認メール**を送るには、独自ドメインの認証が必要です
   - 「Domains → Add Domain」で送信元ドメインを追加し、表示される DNS レコードをドメインの設定画面に追加
   - 認証が済んだら、`MAIL_FROM` を設定し、`APPLICANT_EMAIL_ENABLED` を `true` にする

## 7. サイトに接続する（GitHub）

リポジトリの「Settings → Secrets and variables → Actions → **Variables**」タブで、次を登録します（公開してよい値なので Variables に置きます）。

| 名前 | 値 |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | 手順 1 の Project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | 手順 1 の anon / publishable key |

登録後、「Actions → Preview (GitHub Pages) → Run workflow」でプレビューを作り直すと、フォームの「未接続」表示が消え、送信できるようになります。
同じ変数で、Supabase の停止を防ぐ定期アクセス（`keepalive.yml`）も動き始めます。

## 8. 動作確認

1. プレビューのレッスン申し込みページから、テスト用の内容で申し込む
2. 完了画面に受付番号が出ることを確認
3. `/admin/` に管理人アカウントでログインし、一覧に出ることを確認
4. 管理人への通知メールが届くことを確認（手順 6 を済ませた場合）
5. テストの申し込みは、管理画面の「個人情報の削除」で消す

---

## 管理人が手動で行うこと（まとめ）

- [ ] Supabase のプロジェクト作成（東京リージョン）
- [ ] マイグレーションの実行
- [ ] 新規登録をオフにし、管理人アカウントを作成して `admins` に登録
- [ ] Edge Function の公開と Secrets の登録（`ALLOWED_ORIGINS`・`RATE_LIMIT_SALT` は必須）
- [ ] Resend のアカウント作成と API キー（管理人通知）
- [ ] GitHub の Variables に Supabase の URL と公開キーを登録
- [ ] （後日）送信元ドメインの認証 → 申込者への受付確認メールを有効化
- [ ] （後日）プライバシーポリシーの事業者情報・保存期間・窓口を確定
- [ ] 定期的に管理画面から CSV を書き出して保管（無料プランは自動バックアップなし）

## 注意

- 秘密キー（`service_role` / secret key、`RESEND_API_KEY`、データベースのパスワード）は、GitHub・チャット・メールに貼らない
- 無料プランは 1 週間アクセスがないと停止します。`keepalive.yml` が週 2 回アクセスしますが、停止した場合は Supabase のダッシュボードから再開してください
