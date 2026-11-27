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
- ストアID・トラッキングID: `mukkoo-22`（所有者の2026-11-27のAmazonアソシエイト画面より確認）。これは公開リンクに含まれる広告識別子であって認証トークンではない。正式なAmazon.co.jpのASINと商品詳細ページを検証し、公式方式で `tag=mukkoo-22` を付けたリンクをClaudeに引き継ぐ。未確認商品を掲載しない。APIキーなどの認証情報は保存しない。
- サイト掲載前にAmazonアソシエイトの利用サイト登録と規約確認が必要。
- 公式規約: https://affiliate.amazon.co.jp/help/operating/policies/
- 公式開示: https://affiliate.amazon.co.jp/help/node/topic/GPXFHVYZMTGPUMPE
- リンク作成ツール: https://affiliate.amazon.co.jp/help/node/topic/GJMMT7G4C8K4Y3AY
- 表示例: 広告 / PR。Amazonのアソシエイトとして、SONARIAは適格販売により収入を得ています。

## Claude向け一括実装指示
1. docs/affiliate-research/queue.jsonを読み、approved_for_implementationのもののみ、確認済みwork_idsに紐付けて表示。
2. 日本語/英語に対応した説明、広告表示、アクセス可能な外部リンク。rel=sponsored noopener noreferrer。
3. 既存デザインに統合し、控えめなカード/テキストリンクを楽譜説明下に配置。レイアウトシフトとスマホ表示を確認。
4. Amazon正式リンク未検証、追跡タグ不一致、検証期限切れの候補は非表示。決定事項の変更・本番公開は人間承認を必須とする。
5. 新PRの量産を避け、既存の調査PRを更新。作業履歴はキューとPRに蓄積し、mainに直接pushしない。

## GPT毎時実行
既存キューと対象作品を照合→未調査商品を数件探索→重複排除→出典と版・編成・商品識別子検証→キュー更新→必要なPR更新。調査に失敗したら未検証を明示し、URL/価格/ASINを捏造しない。Claudeの実装はユーザーが指示するまで行わない。

## 正式リンクの条件（2026-11-27追記）
- 作品・版・ASINの突合ができたものだけを対象に、Amazonアソシエイトの許可された方法で `mukkoo-22` を付ける。例: `https://www.amazon.co.jp/dp/{検証済ASIN}?tag=mukkoo-22`（例示用。ASINを推測しない）。
- GitHubの候補キューでは出版社で商品の存在が確認できたものと、Amazonの商品ページを確認できたものを分けて管理する。出版社だけ確認できてもステータスは `pending_review`。
- サイトのAmazonアソシエイト登録・広告開示の適合、実リンクへのアクセス、重複、作品番号、編成をClaude実装前に確認する。

## Amazon.co.jp 個別商品照合ログ（2026-11-27 21:52 JST）
- 対象: Haydn / Henle HN205、HN208、HN9205、HN9216、HN211。Amazon.co.jp の `/dp/` を対象とした品番完全一致検索と、日本語での品番・ISMN併用検索を再実施。**5件とも商品詳細ページとASINの組を確認できず**、全件 `pending_review` のまま。正式な `tag=mukkoo-22` リンクは追加しない。
- 出版社原典の再確認: HN205 = ISMN 979-0-2018-0205-3（弦楽四重奏パート譜、Op.1初期作品集） https://www.henle.de/en/String-Quartets-Book-I-Early-String-Quartets/HN-205 ; HN9216 = ISMN 979-0-2018-9216-0（12冊組スタディスコア、69作品、HN9205–9215およびHN9771） https://www.henle.de/jp/The-String-Quartets-12-Volumes-in-a-Slipcase/HN-9216 。いずれも出版社情報であり、Amazon掲載の証拠ではない。
- 誤認防止: Op.20の演奏録音CDやハイドンのピアノ曲集を弦楽四重奏の市販譜と混同しない。HN9216は複数作品の全集であり、個別作品ページに表示する場合は対象作品を含むことを別途明示する。
- 次回はAmazon個別商品への直接到達が可能な場合に限り、タイトル・版種（パート譜/ポケットスコア）・ISMN・出版社を突合してASINを記録。未確認なら同じ探索結果の反復追記を避け、次のハイドン未調査版へ進む。
