# 作曲家の肖像画の追加方法

作曲家ページと作品ページに肖像画を表示するための手順です。画像は運営者が用意します。

## 手順

1. 画像を用意する（例: Wikimedia Commons の、パブリックドメインまたは自由な利用が許されたライセンスの肖像画）
2. 画像を `frontend/public/composers/<作曲家ID>.jpg` に置く（PNG・WebP も可。縦長がきれいに表示されます。3:4 の枠に収めて表示）
3. `frontend/src/data/scores/portraits.json` に 1 件ずつ追記する

```json
[
  {
    "id": "beethoven",
    "file": "/composers/beethoven.jpg",
    "source": "画像を取得したページの URL",
    "license": "Public domain",
    "author": "作者名（ライセンスが作者の表示を求める場合は必須）"
  }
]
```

- `source`（出典）と `license`（ライセンス）が無い行は表示しません
- CC BY・CC BY-SA などは作者名の表示が必要です。`author` に書くと作曲家ページの下に表示されます
- 推奨サイズ: 幅 600px 程度、ファイルサイズ 200KB 以下

## 収録作品がある作曲家（50 人）

| 作曲家ID | 日本語名 | 英語名 | 生没年 |
|---|---|---|---|
| `arensky` | アントン・アレンスキー | Anton Arensky | 1861–1906 |
| `bach` | ヨハン・ゼバスティアン・バッハ | Johann Sebastian Bach | 1685–1750 |
| `bartok` | バルトーク・ベーラ | Béla Bartók | 1881–1945 |
| `beethoven` | ルートヴィヒ・ヴァン・ベートーヴェン | Ludwig van Beethoven | 1770–1827 |
| `borodin` | アレクサンドル・ボロディン | Alexander Borodin | 1833–1887 |
| `brahms` | ヨハネス・ブラームス | Johannes Brahms | 1833–1897 |
| `bruch` | マックス・ブルッフ | Max Bruch | 1838–1920 |
| `beriot` | シャルル＝オーギュスト・ド・ベリオ | Charles-Auguste de Bériot | 1802–1870 |
| `chopin` | フレデリック・ショパン | Frédéric Chopin | 1810–1849 |
| `corelli` | アルカンジェロ・コレッリ | Arcangelo Corelli | 1653–1713 |
| `dohnanyi` | エルンスト・フォン・ドホナーニ | Ernst von Dohnányi | 1877–1960 |
| `dont` | ヤーコプ・ドント | Jakob Dont | 1815–1888 |
| `dvorak` | アントニン・ドヴォルザーク | Antonín Dvořák | 1841–1904 |
| `elgar` | エドワード・エルガー | Edward Elgar | 1857–1934 |
| `faure` | ガブリエル・フォーレ | Gabriel Fauré | 1845–1924 |
| `glazunov` | アレクサンドル・グラズノフ | Alexander Glazunov | 1865–1936 |
| `goltermann` | ゲオルク・ゴルターマン | Georg Goltermann | 1824–1898 |
| `gounod` | シャルル・グノー | Charles Gounod | 1818–1893 |
| `grieg` | エドヴァルド・グリーグ | Edvard Grieg | 1843–1907 |
| `haydn` | フランツ・ヨーゼフ・ハイドン | Joseph Haydn | 1732–1809 |
| `kayser` | ハインリヒ・エルンスト・カイザー | Heinrich Ernst Kayser | 1815–1888 |
| `kreisler` | フリッツ・クライスラー | Fritz Kreisler | 1875–1962 |
| `kreutzer` | ロドルフ・クロイツェル | Rodolphe Kreutzer | 1766–1831 |
| `lalo` | エドゥアール・ラロ | Édouard Lalo | 1823–1892 |
| `leclair` | ジャン＝マリー・ルクレール | Jean-Marie Leclair | 1697–1764 |
| `mendelssohn` | フェリックス・メンデルスゾーン | Felix Mendelssohn | 1809–1847 |
| `monti` | ヴィットーリオ・モンティ | Vittorio Monti | 1868–1922 |
| `mozart` | ヴォルフガング・アマデウス・モーツァルト | Wolfgang Amadeus Mozart | 1756–1791 |
| `paganini` | ニコロ・パガニーニ | Niccolò Paganini | 1782–1840 |
| `popper` | ダーヴィト・ポッパー | David Popper | 1843–1913 |
| `prokofiev` | セルゲイ・プロコフィエフ | Sergei Prokofiev | 1891–1953 |
| `rachmaninoff` | セルゲイ・ラフマニノフ | Sergei Rachmaninoff | 1873–1943 |
| `ravel` | モーリス・ラヴェル | Maurice Ravel | 1875–1937 |
| `respighi` | オットリーノ・レスピーギ | Ottorino Respighi | 1879–1936 |
| `rode` | ピエール・ロード | Pierre Rode | 1774–1830 |
| `roussel` | アルベール・ルーセル | Albert Roussel | 1869–1937 |
| `saint-saens` | カミーユ・サン＝サーンス | Camille Saint-Saëns | 1835–1921 |
| `sarasate` | パブロ・デ・サラサーテ | Pablo de Sarasate | 1844–1908 |
| `schradieck` | ヘンリー・シュラディーク | Henry Schradieck | 1846–1918 |
| `schubert` | フランツ・シューベルト | Franz Schubert | 1797–1828 |
| `schumann` | ロベルト・シューマン | Robert Schumann | 1810–1856 |
| `seitz` | フリードリヒ・ザイツ | Friedrich Seitz | 1848–1918 |
| `sibelius` | ジャン・シベリウス | Jean Sibelius | 1865–1957 |
| `tchaikovsky` | ピョートル・イリイチ・チャイコフスキー | Pyotr Ilyich Tchaikovsky | 1840–1893 |
| `viotti` | ジョヴァンニ・バッティスタ・ヴィオッティ | Giovanni Battista Viotti | 1755–1824 |
| `vitali` | トマゾ・アントニオ・ヴィターリ | Tomaso Antonio Vitali | 1663–1745 |
| `vivaldi` | アントニオ・ヴィヴァルディ | Antonio Vivaldi | 1678–1741 |
| `warlock` | ピーター・ウォーロック | Peter Warlock | 1894–1930 |
| `wieniawski` | ヘンリク・ヴィエニャフスキ | Henryk Wieniawski | 1835–1880 |
| `sevcik` | オタカール・シェフチーク | Otakar Ševčík | 1852–1934 |
