# SONARIA 管理システム 設計書（第 1 段階：画面・データ構造）

- 状態: **画面とデータ構造は実装済み（デモデータのみ）。外部サービスは未接続**
- 元の指示: 「SONARIA 統合管理システム・セキュリティ・PDF保護・広告配置 実装指示書」（2026-11-27）
- 関連: PR #7（Supabase による申し込みバックエンド案。`docs/decisions/0003-external-backend.md`）
- デザイン基準: `docs/SONARIA_UI_DESIGN_SYSTEM_v1.0.md`

## 1. 公開範囲（いちばん重要）

| ビルド | 管理画面 | デモデータ |
|---|---|---|
| 本番（さくら）・GitHub Pages のプレビュー | **含まれない**（ページ自体を生成しない） | 含まれない |
| `SONARIA_ADMIN_PREVIEW=1` のビルド（開発・CI の撮影用） | 含まれる | 含まれる（画面上部に常に「デモ」と表示） |

- 仕組み: 管理画面のファイルは `src/app/(admin)/admin/**/*.admin.tsx`。`next.config.ts` の `pageExtensions` が、`SONARIA_ADMIN_PREVIEW=1` のときだけ `.admin.tsx` をページとして扱う
- CI（`No admin console in production build`）が、本番ビルドに `out/admin/` と デモデータの目印 `SONARIA_ADMIN_DEMO_DATA` が無いことを毎回確認する
- 確認方法（手元）: `cd frontend && SONARIA_ADMIN_PREVIEW=1 npm run dev` → `http://localhost:3000/admin/` →「デモデータで画面を確認する」
- **認証サーバーを実装し、運営者が承認するまで、本番で管理画面を使えるようにしない**

## 2. 管理者の認証

### 第 1 段階（今回）

- ログイン画面（`/admin/`）: パスワード入力・ログイン・エラー表示・ログアウト
- ブラウザ側には正解のパスワードもハッシュも置かない。`src/admin/auth.ts` は入力をサーバーへ送るだけ
- 管理者 API の URL（`NEXT_PUBLIC_ADMIN_API`）が未設定の間は、常に「未接続」を返す

### 第 2 段階（未実装・要承認）

| 項目 | 方式 |
|---|---|
| 照合 | サーバー側で **Argon2id**（メモリ 64MB 以上・反復 3 以上）。ハッシュはサーバーの環境変数または DB にだけ置く |
| パスワードの設定 | 運営者がハッシュ生成コマンドを手元で実行し、出力をサーバーの環境変数 `ADMIN_PASSWORD_HASH` に設定する（平文はどこにも保存しない） |
| 試行回数の制限 | IP（ハッシュ化）単位で 5 回／15 分、全体で 50 回／時。超えたら HTTP 429 と `Retry-After` |
| セッション | `Set-Cookie: sid=…; Secure; HttpOnly; SameSite=Strict; Path=/; Max-Age=28800`。サーバー側で失効できるようにする |
| CSRF | SameSite=Strict に加え、更新系 API は `Origin` ヘッダーの一致を確認する |
| 管理者 API | すべての API でセッションを検証する（画面の出し分けはアクセス制御ではない） |
| 多要素認証 | `AdminUser.authMethods` に `passkey`（WebAuthn。Face ID / Touch ID）と `totp` を追加できる形にしてある |
| 記録 | ログイン成功・失敗・設定変更を `AuditLog` に残す |

候補の構成: PR #7 の Supabase（Auth + Edge Functions）か、Cloudflare Workers。さくらの契約プランで PHP を使う案もある。**決定は運営者**（CLAUDE.md の第 2 段階 [要決定]）。

## 3. 画面

| メニュー | URL | 主な内容 |
|---|---|---|
| ログイン | `/admin/` | パスワード・未接続の表示・デモ閲覧（プレビュー用ビルドのみ） |
| ダッシュボード | `/admin/dashboard/` | 本日の PV・訪問者、今月の収益と前月比、未読・未返信、予約確定、納品期限が近い案件、講師の承認待ち、不審な PDF 取得、7 日間のアクセス、月別収益、最新の問い合わせ、今後の予定、要対応、システム通知 |
| お問い合わせ | `/admin/inquiries/` | 検索・フォーム種別・対応状況・未読／未返信・並べ替え（条件は URL に残る）。PC は表、スマホはカード |
| 案件の詳細 | `/admin/inquiries/detail/?id=…` | 送信内容、対応状況・見積金額・確定金額・確定日時・実施日時・納品締切・支払期限・支払状況・内部メモ・添付、返信（テンプレート・下書き・プレビュー・送信＝未接続）、履歴、完了・キャンセル |
| カレンダー | `/admin/calendar/` | 月・週・日の切り替え、種類別の色と凡例、期限超過の強調、時間の重なりの表示、案件へのリンク |
| 講師の承認 | `/admin/teachers/` | 公開プロフィールと非公開情報を分けて表示。新規申請 → 審査中 → 修正依頼／承認済み → 公開中／非公開、却下 |
| 収益 | `/admin/revenue/` | 総売上・入金済み・未入金・経費・粗利益・手数料・返金・前月比・前年同月比、カテゴリー別の積み上げ（日・月・年）、構成比、売上と利益、広告収益と PV（指数）、明細 |
| アクセス | `/admin/analytics/` | 期間（7・30・90 日）、日・週・月、ページ別（検索・並べ替え・カテゴリ）、日本語／英語、流入元、デバイス、国・地域、人気の楽譜、フォームの閲覧・送信・送信率 |
| PDF 保護 | `/admin/pdf/` | 本日のダウンロード、人気の PDF、不審なアクセス（許可・制限・拒否）、保護モード、取得制限、大量取得の許可（追加・取り消し）、注意事項 |
| 通知・メール | `/admin/notifications/` | 通知の設定（メール／管理画面）、返信までの流れ、通知の履歴、操作の記録 |

- 日本語・英語の切り替え（右上）。`?lang=en` でも指定できる
- 読み込み中・空・エラーの表示、グラフの「表で見る」、キーボード操作、`prefers-reduced-motion` に対応
- グラフは 2 軸にしない（広告収益と PV は最初の月を 100 とした指数で比べる）

## 4. データモデル（`frontend/src/admin/types.ts`）

| モデル | 要点 |
|---|---|
| AdminUser | 役割（owner / staff）、認証方式（password / passkey / totp） |
| Inquiry | 受付番号・種別・依頼者・件名・送信内容。**既読（readState）・返信（replyState）・案件の進行（caseStatus）を別々に持つ** |
| InquiryMessage | 受信／送信、状態（draft / queued / sent / failed / not_connected） |
| InquiryStatusHistory | 進行状況の変更履歴（誰が・いつ・メモ） |
| Booking / Quote / Payment | 実施日時・見積と確定金額・支払期限と状況・手数料 |
| RevenueEntry | ID・カテゴリー・関連案件・金額・通貨・発生日・請求日・入金日・手数料・経費・返金・支払状況・**取得元（demo / manual / csv_import / stripe / adsense / amazon_report）**・**推定値／確定値**・備考 |
| TeacherApplication / TeacherProfile | 公開プロフィールと非公開情報（本名・メール・確認状況・審査メモ）を分離。**料金の項目は持たない** |
| AnalyticsMetric | 日付・パス・言語・カテゴリ・PV・訪問者・取得元 |
| Notification / NotificationSetting | 種類・宛先・送信状態（not_connected / queued / sent / failed） |
| AuditLog | 操作の記録 |
| PdfDownloadEvent / PdfAccessPolicy / PdfAccessGrant / SuspiciousClient | 下の §6 |

- 金額は最小単位の整数。日時は ISO 8601
- 画面は `AdminRepository`（`src/admin/repository.ts`）だけを通してデータを読む。いまの実装はデモ（`src/admin/demo/`）だけ。サーバー接続の実装を追加して切り替える
- **本番データとデモデータは完全に分ける。** デモは `source: "demo"` と名前の「（デモ）」で区別し、本番のビルドには入らない
- 架空の売上を本番の実績として表示しない（収益の取得元が `demo` なら必ず「デモ」と表示）

PR #7 のスキーマとの対応（例）: `applications` ↔ Inquiry、`application_status_history` ↔ InquiryStatusHistory、`admins` ↔ AdminUser、`rate_limits` ↔ PDF・ログインの制限。PR #7 の状態（new / reviewing / quoted / awaiting_reply / in_progress / completed / cancelled）は、この設計では「進行」と「返信の状態」に分けている。

## 5. メール通知

- 通知先は**サーバーの環境変数 `ADMIN_NOTIFY_EMAIL`** で指定する（コード・公開リポジトリ・ブラウザには置かない）
- 通知の種類: 新規問い合わせ・講師登録申請・未返信（48 時間）・予約確定・納品期限の接近・支払期限の接近・システムエラー・不審な PDF 取得
- 流れ: 送信 → サーバーで検証・保存 → 管理者へ通知 → 詳細画面で確認 → 返信フォームから回答 → 利用者へ送信 → 送信履歴を保存
- 候補: Resend（PR #7）。送信元ドメインの認証（SPF・DKIM）が済むまで、利用者への送信は止める
- 今回は設定画面・履歴画面・データ構造だけ。**実際の送信はしない**（返信は `not_connected` として履歴に残る）

## 6. PDF の大量取得への対策

### 現状

- PDF は GitHub Releases の公開 URL から配信している。**このため、サイト側でどんな制限をしても、URL を直接たどれば取得できる**
- 今回は管理画面・データ構造・方式の設計だけ。**既存の PDF の削除・移動・ダウンロード停止はしていない**

### 保護モード

| モード | 内容 |
|---|---|
| 一般公開 | そのまま配信 |
| **保護（初期値・推奨）** | 1 クライアントあたり 10 件／分・200 件／日。1 時間に 30 件を超えたら「大量取得」として監視・通知。既知の AI クローラーは拒否 |
| 厳格 | チャレンジ（Cloudflare Turnstile など）や認証を通った場合だけ配信 |

### 方式（第 2 段階・要承認）

1. PDF を非公開ストレージ（Cloudflare R2・Supabase Storage など）へ移す（移行後に Releases を非公開にするかは運営者が決める）
2. ダウンロードボタンは配信サーバーに問い合わせ、**有効期間の短い署名付き URL**（初期値 300 秒）を受け取る
3. 配信サーバーでレート制限・AI クローラーの拒否・大量取得の検知。IP はそのまま保存せず、日替わりのソルトでハッシュ化した値だけを記録する（`PdfDownloadEvent.clientHash`）
4. WAF（Cloudflare など）で既知の Bot を制限。検索エンジンのページ巡回（HTML）は許可し、PDF の取得とは分けて扱う
5. 図書館・オーケストラなど、事前に申し出のあった相手には `PdfAccessGrant` で上限を上げる
6. robots.txt に AI クローラー（GPTBot・ClaudeBot・Google-Extended・CCBot など）の拒否を宣言する（本番公開の判断と合わせて運営者が決める。現在は公開前のため全体を拒否している）

### 限界（画面にも表示）

- robots.txt は宣言にすぎず、従わないプログラムは止められない
- 公開リポジトリなどに直接 URL があれば、サイト側の制限は迂回される
- 一般公開している PDF を AI に読み込ませることを、技術的に完全に禁止する方法は無い
- パブリックドメインの資料はその条件を尊重する（制限は大量の自動取得への対策で、利用の禁止ではない）

## 7. Amazon アソシエイトの表示（今回の変更）

- 作品ページの本文途中にあった検索ウィジェットを外し、**ページ最下部の 1 枠だけ**にした（関連作品の後）
- 1 枠の中身: 確認済みの商品（`amazon.json`。`approved_for_implementation` だけ）→ 作品ごとのリンク → 作曲家の楽譜を探すバナー、の順で 1 つ
- 作曲家・カテゴリのページはもとから下部 1 枠
- `pending_review` の商品は表示しない（既存の仕組みのまま）。研究キュー・仕様書は削除していない
- 検索ウィジェットの部品（`AmazonSearchWidget.tsx`）は残してある（どのページにも置いていない）

## 8. 第 2 段階で必要な外部サービス（すべて未接続・要承認）

| 用途 | 候補 |
|---|---|
| 認証・DB・ファイル | Supabase（PR #7）／Cloudflare（Workers・D1・R2） |
| メール | Resend |
| 決済 | Stripe |
| 広告収益 | Google AdSense（レポート API）・Amazon アソシエイト（レポートの CSV 取り込み） |
| アクセス解析 | Cloudflare Web Analytics・Plausible・GA4 のいずれか |
| PDF 配信・WAF | Cloudflare R2 + Workers + WAF／Supabase Storage |
| バックアップ | DB の定期書き出し |

## 9. セキュリティ上の残課題

1. 認証サーバーが無い。**本番で管理画面を有効にしてはいけない**
2. PDF は公開 URL のままなので、§6 の対策は配信方式を変えるまで効かない
3. 管理者 API・メール・決済の秘密情報は、サーバーの環境変数だけに置く（`NEXT_PUBLIC_*` に入れない）
4. 個人情報（問い合わせ・講師申請）の保管期間と削除手順を決める（PR #7 に削除関数の案がある）
5. PR #7 にも `/admin` の画面案がある。どちらを残すか決める（この設計では、PR #7 のバックエンドをリポジトリの実装として接続する想定）
