# 楽譜収集キューとサイト掲載の照合（Claude）

- 照合したキュー: 196 件（queue.json last_updated: 2026-11-29）
- 照合先: サイト掲載中の作品（catalog.json）と、旧サイトから移行時に保留した作品（works_meta.py）
- 作品番号（Op.／No.／Hob.／K.）と作曲家・編成で突き合わせ。作品番号が無い・表記が特殊な候補は「未掲載」に入るため、目視で確認すること

| 判定 | 件数 |
|---|---|
| 掲載中と重複 | 25 |
| 旧サイトで保留中の作品 | 0 |
| 原曲は掲載中・編成違い | 0 |
| 未掲載（新規） | 171 |

## 掲載中と重複

| キュー ID | 作品番号 | サイト側 |
|---|---|---|
| `haydn-op20-no4-source-editions` | Op.20 No.4; Hob.III:34 | haydn-string-quartet-op20-4（弦楽四重奏曲 ニ長調・掲載中） |
| `haydn-op64-no5-pleyel-parts` | Op.64 No.5; Hob.III:63 | haydn-string-quartet-lark（弦楽四重奏曲 ニ長調《ひばり》・掲載中） |
| `haydn-op76-no3-hummel-1799-parts` | Op.76 No.3; Hob.III:77 | haydn-string-quartet-emperor（弦楽四重奏曲 ハ長調《皇帝》・掲載中） |
| `mozart-string-quartet-no19-k465-breitkopf-1882` | K.465 | mozart-string-quartet-dissonance（弦楽四重奏曲第19番 ハ長調《不協和音》・掲載中） |
| `beethoven-op18-no1-roentgen-breitkopf-parts` | Op.18 No.1 | beethoven-string-quartet-1（弦楽四重奏曲第1番 ヘ長調・掲載中） |
| `beethoven-op18-no2-roentgen-breitkopf-parts` | Op.18 No.2 | beethoven-string-quartet-2（弦楽四重奏曲第2番 ト長調・掲載中） |
| `beethoven-op18-no3-roentgen-breitkopf-parts` | Op.18 No.3 | beethoven-string-quartet-3（弦楽四重奏曲第3番 ニ長調・掲載中） |
| `beethoven-op18-no4-roentgen-breitkopf-parts` | Op.18 No.4 | beethoven-string-quartet-4（弦楽四重奏曲第4番 ハ短調・掲載中） |
| `beethoven-op18-no5-roentgen-breitkopf-parts` | Op.18 No.5 | beethoven-string-quartet-5（弦楽四重奏曲第5番 イ長調・掲載中） |
| `beethoven-op18-no6-roentgen-breitkopf-parts` | Op.18 No.6 | beethoven-string-quartet-6（弦楽四重奏曲第6番 変ロ長調・掲載中） |
| `beethoven-op59-no1-simrock-parts-breitkopf-score` | Op.59 No.1 | beethoven-string-quartet-7（弦楽四重奏曲第7番 ヘ長調《ラズモフスキー第1番》・掲載中） |
| `beethoven-op59-no2-simrock-parts-breitkopf-score` | Op.59 No.2 | beethoven-string-quartet-8（弦楽四重奏曲第8番 ホ短調《ラズモフスキー第2番》・掲載中） |
| `beethoven-op59-no3-simrock-parts-breitkopf-score` | Op.59 No.3 | beethoven-string-quartet-9（弦楽四重奏曲第9番 ハ長調《ラズモフスキー第3番》・掲載中） |
| `beethoven-violin-sonata-1-henle-1974-research` | Op.12 No.1 | beethoven-violin-sonata-1（ヴァイオリン・ソナタ第1番 ニ長調・掲載中） |
| `beethoven-violin-sonata-2-henle-1974-research` | Op.12 No.2 | beethoven-violin-sonata-2（ヴァイオリン・ソナタ第2番 イ長調・掲載中） |
| `beethoven-violin-sonata-3-peters-joachim-1901-research` | Op.12 No.3 | beethoven-violin-sonata-3（ヴァイオリン・ソナタ第3番 変ホ長調・掲載中） |
| `beethoven-violin-sonata-4-peters-joachim-1901-research` | Op.23 | beethoven-violin-sonata-4（ヴァイオリン・ソナタ第4番 イ短調・掲載中） |
| `beethoven-violin-sonata-5-peters-joachim-1901-research` | Op.24 | beethoven-violin-sonata-5（ヴァイオリン・ソナタ第5番 ヘ長調《春》・掲載中） |
| `beethoven-violin-sonata-6-first-edition-1803-research` | Op.30 No.1 | beethoven-violin-sonata-6（ヴァイオリン・ソナタ第6番 イ長調・掲載中） |
| `beethoven-violin-sonata-op30-no2-bureau-first-edition` | Op.30 No.2 | beethoven-violin-sonata-7（ヴァイオリン・ソナタ第7番 ハ短調・掲載中） |
| `beethoven-violin-sonata-op30-no3-peters-joachim` | Op.30 No.3 | beethoven-violin-sonata-8（ヴァイオリン・ソナタ第8番 ト長調・掲載中） |
| `beethoven-violin-sonata-9-peters-joachim-1901` | Op.47 | beethoven-violin-sonata-9（ヴァイオリン・ソナタ第9番 イ長調《クロイツェル》・掲載中） |
| `beethoven-violin-sonata-10-peters-joachim-1901` | Op.96 | beethoven-violin-sonata-10（ヴァイオリン・ソナタ第10番 ト長調・掲載中） |
| `brahms-violin-sonata-1-op78-simrock-first` | Op.78 | brahms-violin-sonata-1（ヴァイオリン・ソナタ第1番 ト長調《雨の歌》・掲載中）<br>brahms-violin-sonatas（ヴァイオリン・ソナタ（第1〜3番）・掲載中） |
| `brahms-violin-sonata-2-op100-simrock-first` | Op.100 | brahms-violin-sonata-2（ヴァイオリン・ソナタ第2番 イ長調・掲載中）<br>brahms-violin-sonatas（ヴァイオリン・ソナタ（第1〜3番）・掲載中） |

## キュー内で同じ作品を指す候補（版違い・パート違い）

- brahms string_quartet op:67: `brahms-string-quartet-op67-simrock-1876`, `brahms-string-quartet-op67-breitkopf-gal-1926`

## 作品番号を読み取れなかった候補（目視確認が必要）

- `mozart-violin-fragment-anh48-385e`: K.Anh.48/385E
- `mozart-violin-fragment-anh50-526a`: K.Anh.50/526a
- `mozart-violin-fragment-anh47-546a`: K.Anh.47/546a
