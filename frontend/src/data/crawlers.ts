// クローラーの許可方針（app/robots.ts）。目的ごとに分けて管理する。
// - search    … 通常の検索エンジン（Google・Bing など）。公開ページへのアクセスを遮断しない
// - aiAnswer  … AI 検索・AI による回答の参照（利用者の質問に答えるためにページを読む）
// - aiTraining … 生成 AI のモデル学習用の収集
//
// [要決定] aiTraining の方針は運営者が決める。学習に使われると取り消せないため、決まるまでは不許可にしている。
// robots.txt は守るクローラーにだけ効くお願いであり、掲載・参照・不使用を保証するものではない。

export type CrawlPolicy = "allow" | "disallow";

export const crawlPolicy: { aiAnswer: CrawlPolicy; aiTraining: CrawlPolicy } = {
  aiAnswer: "allow",
  aiTraining: "disallow",
};

// 各社が公開しているクローラー名（2026 年時点。追加・変更があれば更新する）
export const aiAnswerBots = ["OAI-SearchBot", "ChatGPT-User", "Claude-SearchBot", "Claude-User", "PerplexityBot", "Perplexity-User"];
export const aiTrainingBots = ["GPTBot", "ClaudeBot", "Google-Extended", "Applebot-Extended", "CCBot", "Meta-ExternalAgent", "Bytespider"];

// どのクローラーにも見せないパス（管理画面など）
export const privatePaths = ["/admin/"];
