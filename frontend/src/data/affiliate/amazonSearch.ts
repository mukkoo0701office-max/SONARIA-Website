// Amazon.co.jp の検索結果への広告リンク（楽譜ページのバナー・検索ウィジェット）の設定。
// GPT の提案（PR #21・docs/affiliate-research/generic-score-search-links.md）をもとに実装。検索語の組み立ては lib/affiliate/amazonSearch.ts。
// 個別商品（ASIN）は確認済みのものだけ amazon.json で表示し、それ以外はこの検索リンクで関連楽譜を案内する。
// [要決定] 本番公開の前に、Amazon アソシエイトの管理画面でサイト（公開ドメイン）を登録し、リンクの計測を確認すること。

export const amazonSearch = {
  // トラッキング ID（運営者がアソシエイトの管理画面で確認したもの）。空にするとタグなしの検索リンクになる
  tag: "mukkoo-22",
  // 1 ページに置く広告枠の上限（docs/affiliate-research/README.md の方針）
  maxSlotsPerPage: 2,
} as const;
