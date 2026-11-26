# リポジトリの準備

## 必要なもの

- Git
- [要決定] アプリの実行環境（Node.js など）は技術スタック確定後に追記する

## クローン

```bash
git clone https://github.com/mukkoo0701office-max/SONARIA-Website.git
cd SONARIA-Website
```

## プロトタイプを見る

`prototypes/score-search-ui-v1.html` をブラウザで直接開くと、承認済みの検索 UI を操作できます。

## 個人メモ（任意）

`memo/` は git 管理外です。iCloud Drive などに実体を置き、シンボリックリンクで参照します。

```bash
# リポジトリのルートで実行（パスは自分の環境に合わせる）
ln -s ~/Library/Mobile\ Documents/com~apple~CloudDocs/SONARIA/memo memo
```

正式な仕様・決定事項は `memo/` ではなく `docs/` に置いてください。

## AI ツールを使う場合

開発前にルートの `CLAUDE.md` を読み込ませてください。
