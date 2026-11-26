# SONARIA Amazon関連商品調査・Claude実装引継ぎ（提案・未承認）
更新: 2026-11-27 / Issue #11 / GPT調査 → Claude実装

## 方針
- 楽譜の閲覧・ダウンロードが主目的。広告は原則1ページ最大2件で関連資料欄に表示。
- 広告/PRと明示し、ダウンロード・送信・ナビ操作の隣に配置しない。
- CLAUDE.md、docs/workflow.md、承認済みUI・ブランド・ライブラリ仕様を優先。
- 作曲家優先順: ハイドン→モーツァルト→ベートーヴェン→ブラームス、以降未調査曲。
- 商品優先順: 同一作品の高品質な市販原典版・演奏譜→ポケットスコア→関連研究書→楽器用品（楽器カテゴリページでのみ）→関連録音。
- 作品の番号、楽器編成、出版社、原典版か編曲版かを照合し、作品と関係のない商品を載せない。

## 調査・承認
- Amazon.co.jpで個別の商品ページ、ASIN、書籍ならISBN、出版社・版・内容・作品番号・編成・販売状況を確認する。
- 候補の出典、確認日と不確実性を記録。未検証候補はpending_review。確認済みはverified。掲載承認済みはapproved_for_implementation。リンク失効時stale、不適切ならrejected。
- 商品価格・在庫・評価・画像は公式に許諾された手段で取得・更新できない限りサイトには表示しない。画像の無断転載や保存はしない。
- AffiliateのトラッキングIDは所有者が後で設定。未設定や正式リンク未確認なら本番掲載しない。認証情報は保存しない。
- サイト掲載前にAmazonアソシエイトの利用サイト登録と規約確認が必要。
- 公式規約: https://affiliate.amazon.co.jp/help/operating/policies/
- 公式開示: https://affiliate.amazon.co.jp/help/node/topic/GPXFHVYZMTGPUMPE
- リンク作成ツール: https://affiliate.amazon.co.jp/help/node/topic/GJMMT7G4C8K4Y3AY
- 表示例: 広告 / PR。Amazonのアソシエイトとして、SONARIAは適格販売により収入を得ています。

## Claude向け一括実装指示
1. docs/affiliate-research/queue.jsonを読み、approved_for_implementationのもののみ、確認済みwork_idsに紐付けて表示。
2. 日本語/英語に対応した説明、広告表示、アクセス可能な外部リンク。rel=sponsored noopener noreferrer。
3. 既存デザインに統合し、控えめなカード/テキストリンクを楽譜説明下に配置。レイアウトシフトとスマホ表示を確認。
4. Amazon正式リンク未検証、追跡タグ未設定、検証期限切れの候補は非表示。決定事項の変更・本番公開は人間承認を必須とする。
5. 新PRの量産を避け、既存の調査PRを更新。作業履歴はキューとPRに蓄積し、mainに直接pushしない。

## GPT毎時実行
既存キューと対象作品を照合→未調査商品を数件探索→重複排除→出典と版・編成・商品識別子検証→キュー更新→必要なPR更新。調査に失敗したら未検証を明示し、URL/価格/ASINを捏造しない。Claudeの実装はユーザーが指示するまで行わない。