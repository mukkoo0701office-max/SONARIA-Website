# SONARIA — 汎用Amazon楽譜検索リンク設計（Claude実装待ち）

Status: research_only / not approved for implementation
Tracking ID: mukkoo-22

## 方針
- 個別ASIN依存をやめ、楽譜ページの作曲家・作品名・編成を検索語としてAmazon.co.jp検索結果へ誘導する。
- 作曲家名 + 作品名 + 「楽譜 スコア」、または作曲家名 + 編成 + 「ポケットスコア」で検索。
- 同じページ内に2件まで。「広告」「Amazonアソシエイト」等の適切な表示を付け、PDFダウンロード操作から離して配置。
- 以下は検索先URLの**候補**。tag付きでもアソシエイト・ツールバー発行済みとはみなさない。正式発行・Link Checker確認までは公開しない。

## 汎用検索リンク候補
| 用途 | 検索語 | 検索URL候補（未検証） |
|---|---|---|
| ハイドン弦楽四重奏 | ハイドン 弦楽四重奏 楽譜 スコア | https://www.amazon.co.jp/s?k=%E3%83%8F%E3%82%A4%E3%83%89%E3%83%B3%20%E5%BC%A6%E6%A5%BD%E5%9B%9B%E9%87%8D%E5%A5%8F%20%E6%A5%BD%E8%AD%9C%20%E3%82%B9%E3%82%B3%E3%82%A2&tag=mukkoo-22 |
| モーツァルト弦楽四重奏 | モーツァルト 弦楽四重奏 楽譜 スコア | https://www.amazon.co.jp/s?k=%E3%83%A2%E3%83%BC%E3%83%84%E3%82%A1%E3%83%AB%E3%83%88%20%E5%BC%A6%E6%A5%BD%E5%9B%9B%E9%87%8D%E5%A5%8F%20%E6%A5%BD%E8%AD%9C%20%E3%82%B9%E3%82%B3%E3%82%A2&tag=mukkoo-22 |
| ベートーヴェン弦楽四重奏 | ベートーヴェン 弦楽四重奏 楽譜 スコア | https://www.amazon.co.jp/s?k=%E3%83%99%E3%83%BC%E3%83%88%E3%83%BC%E3%83%B4%E3%82%A7%E3%83%B3%20%E5%BC%A6%E6%A5%BD%E5%9B%9B%E9%87%8D%E5%A5%8F%20%E6%A5%BD%E8%AD%9C%20%E3%82%B9%E3%82%B3%E3%82%A2&tag=mukkoo-22 |
| ブラームス弦楽四重奏 | ブラームス 弦楽四重奏 楽譜 スコア | https://www.amazon.co.jp/s?k=%E3%83%96%E3%83%A9%E3%83%BC%E3%83%A0%E3%82%B9%20%E5%BC%A6%E6%A5%BD%E5%9B%9B%E9%87%8D%E5%A5%8F%20%E6%A5%BD%E8%AD%9C%20%E3%82%B9%E3%82%B3%E3%82%A2&tag=mukkoo-22 |
| 弦楽四重奏ポケットスコア | 弦楽四重奏 ポケットスコア | https://www.amazon.co.jp/s?k=%E5%BC%A6%E6%A5%BD%E5%9B%9B%E9%87%8D%E5%A5%8F%20%E3%83%9D%E3%82%B1%E3%83%83%E3%83%88%E3%82%B9%E3%82%B3%E3%82%A2&tag=mukkoo-22 |
| オーケストラ総譜 | オーケストラ フルスコア 楽譜 | https://www.amazon.co.jp/s?k=%E3%82%AA%E3%83%BC%E3%82%B1%E3%82%B9%E3%83%88%E3%83%A9%20%E3%83%95%E3%83%AB%E3%82%B9%E3%82%B3%E3%82%A2%20%E6%A5%BD%E8%AD%9C&tag=mukkoo-22 |
| ヴァイオリン楽譜 | ヴァイオリン 楽譜 原典版 | https://www.amazon.co.jp/s?k=%E3%83%B4%E3%82%A1%E3%82%A4%E3%82%AA%E3%83%AA%E3%83%B3%20%E6%A5%BD%E8%AD%9C%20%E5%8E%9F%E5%85%B8%E7%89%88&tag=mukkoo-22 |
| ピアノ楽譜 | ピアノ 楽譜 原典版 | https://www.amazon.co.jp/s?k=%E3%83%94%E3%82%A2%E3%83%8E%20%E6%A5%BD%E8%AD%9C%20%E5%8E%9F%E5%85%B8%E7%89%88&tag=mukkoo-22 |

## 実装仕様案
1. 楽譜ページのcomposer, work_title, instrumentationを検索語に使用。作品番号があれば付加。
2. 第一候補: 「作曲家 作品名 作品番号 楽譜 スコア」。第二候補: 「作曲家 編成 ポケットスコア」。
3. 検索リンクは作品との関連性を保証しないため、文言は「Amazonで関連楽譜を探す」とし特定商品の販売を示唆しない。
4. Amazon公式アソシエイト・ツールバーで各検索結果ページの正式リンクを発行・確認後、URLを置換して公開する。
5. CLAUDE.md、docs/workflow.md、docs/affiliate-research/README.mdに従い、Claudeが実装、オーナー承認までマージ・公開しない。

## 公式根拠
- https://affiliate.amazon.co.jp/help/node/topic/G8H6ZT34PMFJQ4E5
- https://affiliate.amazon.co.jp/help/node/topic/GJMMT7G4C8K4Y3AY
- https://affiliate.amazon.co.jp/help/node/topic/GWCT8E7V4QKTPP6V
