// 楽譜ライブラリの URL（言語を除いたパス）。ページ・sitemap・リンクはすべてここを使う
export const libraryPaths = {
  scores: "/scores/",
  work: (id: string) => `/scores/${id}/`,
  composers: "/composers/",
  composer: (id: string) => `/composers/${id}/`,
  category: (id: string) => `/scores/category/${id}/`,
};
