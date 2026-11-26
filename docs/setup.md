# 開発環境の準備

## 必要なもの

- Git
- Node.js 22 以上（LTS）と npm

## クローンと起動

```bash
git clone https://github.com/mukkoo0701office-max/SONARIA-Website.git
cd SONARIA-Website/frontend
npm install
npm run dev
```

ブラウザで http://localhost:3000/ja/ を開きます（開発サーバでは `.htaccess` が効かないため、`/` は簡易の振り分けページになります）。

## よく使うコマンド（`frontend/` で実行）

| コマンド | 内容 |
|---|---|
| `npm run dev` | 開発サーバ起動 |
| `npm run lint` | ESLint チェック |
| `npm run build` | 静的書き出し（`frontend/out/` に出力） |

## デプロイ（さくらのレンタルサーバ）

**本番公開は運営者の承認後に行います。**

1. `npm run build` で `frontend/out/` を作る
2. `out/` の中身（`.htaccess` を含む）を、公開ディレクトリにアップロードする
3. `/` が言語ごとに `/ja/` か `/en/` に移動することを確認する

`.htaccess` は隠しファイルです。FTP ソフトで「隠しファイルを表示」にしてからアップロードしてください。

[要決定] 公開ディレクトリのパス、アップロード方法（FTP／SFTP／自動化）。

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
