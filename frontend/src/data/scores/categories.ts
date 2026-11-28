import type { Localized, Work } from "./types";

// 編成別・曲種別のカテゴリ。ページは収録作品から自動で作る（catalog.ts の categories）。
// - 作品が MIN_CATEGORY_WORKS 件未満のカテゴリは作らない（中身の薄いページを増やさない）
// - 収録作品がほかのカテゴリとまったく同じになる場合は、先に並んでいるほうだけを作る

export const MIN_CATEGORY_WORKS = 2;

export type CategoryDef = {
  id: string; // URL に使う
  name: Localized;
  intro: Localized; // 利用者向けの短い説明（作品個別の情報は書かない）
  match: (w: Work) => boolean;
};

export const categoryDefs: CategoryDef[] = [
  {
    id: "violin-solo",
    name: { ja: "ヴァイオリン独奏", en: "Solo violin", de: "Violine solo", fr: "Violon seul", es: "Violín solo", it: "Violino solo" },
    intro: {
      ja: "伴奏のないヴァイオリン1本のための作品です。和音（重音）や複数の声部を1本の楽器で弾き分ける書法が多く、音程と弓の配分が仕上がりを大きく左右します。",
      en: "Works for unaccompanied violin. Much of this repertoire asks one instrument to carry chords and several voices at once, so intonation and bow distribution shape the result.",
      de: "Werke für Violine ohne Begleitung. Viele dieser Stücke verlangen, dass ein einziges Instrument Akkorde und mehrere Stimmen zugleich trägt; Intonation und Bogeneinteilung prägen daher das Ergebnis.",
      fr: "Œuvres pour violon sans accompagnement. Une grande partie de ce répertoire demande à un seul instrument de porter des accords et plusieurs voix à la fois : la justesse et la répartition de l’archet déterminent le résultat.",
      es: "Obras para violín sin acompañamiento. Gran parte de este repertorio exige que un solo instrumento sostenga acordes y varias voces a la vez, por lo que la afinación y la distribución del arco marcan el resultado.",
      it: "Opere per violino senza accompagnamento. Gran parte di questo repertorio chiede a un solo strumento di sostenere accordi e più voci contemporaneamente: intonazione e distribuzione dell’arco determinano il risultato.",
    },
    match: (w) => w.scoring === "violin",
  },
  {
    id: "violin-piano",
    name: { ja: "ヴァイオリンとピアノ", en: "Violin and piano", de: "Violine und Klavier", fr: "Violon et piano", es: "Violín y piano", it: "Violino e pianoforte" },
    intro: {
      ja: "ヴァイオリンとピアノのための作品です。ソナタのように両者が対等に書かれた曲と、ピアノが伴奏を受け持つ小品があります。ピアノ譜とヴァイオリンのパート譜をそろえてお使いください。",
      en: "Works for violin and piano, from sonatas in which both instruments are equal partners to short pieces with piano accompaniment. Use the piano score together with the violin part.",
      de: "Werke für Violine und Klavier, von Sonaten, in denen beide Instrumente gleichberechtigte Partner sind, bis zu kurzen Stücken mit Klavierbegleitung. Verwenden Sie die Klavierpartitur zusammen mit der Violinstimme.",
      fr: "Œuvres pour violon et piano, des sonates où les deux instruments sont des partenaires égaux aux pièces courtes avec accompagnement de piano. Utilisez la partition de piano avec la partie de violon.",
      es: "Obras para violín y piano, desde sonatas en las que ambos instrumentos son compañeros en pie de igualdad hasta piezas breves con acompañamiento de piano. Use la partitura de piano junto con la parte de violín.",
      it: "Opere per violino e pianoforte, dalle sonate in cui i due strumenti sono partner alla pari ai brevi pezzi con accompagnamento pianistico. Usate la partitura del pianoforte insieme alla parte del violino.",
    },
    match: (w) => w.scoring === "violin-piano",
  },
  {
    id: "violin-duo",
    name: { ja: "ヴァイオリン二重奏", en: "Violin duo", de: "Violinduo", fr: "Duo de violons", es: "Dúo de violines", it: "Duo di violini" },
    intro: {
      ja: "ヴァイオリン2本のための作品です。レッスンでの先生と生徒の合奏や、アンサンブルの入門にも向いています。",
      en: "Works for two violins, suited to teacher–student playing in lessons and to a first step into ensemble playing.",
      de: "Werke für zwei Violinen, geeignet zum gemeinsamen Spiel von Lehrkraft und Schüler im Unterricht und als erster Schritt ins Ensemblespiel.",
      fr: "Œuvres pour deux violons, idéales pour jouer à deux entre professeur et élève en cours, et comme premier pas vers la pratique d’ensemble.",
      es: "Obras para dos violines, adecuadas para tocar profesor y alumno juntos en clase y como primer paso hacia la música de conjunto.",
      it: "Opere per due violini, adatte a suonare insieme tra insegnante e allievo a lezione e come primo passo verso la musica d’insieme.",
    },
    match: (w) => w.scoring === "violin-duo",
  },
  {
    id: "string-trio",
    name: { ja: "弦楽三重奏", en: "String trio", de: "Streichtrio", fr: "Trio à cordes", es: "Trío de cuerda", it: "Trio d’archi" },
    intro: {
      ja: "弦楽器3本（多くはヴァイオリン・ヴィオラ・チェロ）のための作品です。4人そろわないときにも室内楽を楽しめます。",
      en: "Works for three string instruments, most often violin, viola and cello — chamber music for when four players are not available.",
      de: "Werke für drei Streichinstrumente, meist Violine, Viola und Violoncello – Kammermusik für den Fall, dass keine vier Spieler da sind.",
      fr: "Œuvres pour trois instruments à cordes, le plus souvent violon, alto et violoncelle : de la musique de chambre pour quand on n’est pas quatre.",
      es: "Obras para tres instrumentos de cuerda, casi siempre violín, viola y violonchelo: música de cámara para cuando no hay cuatro intérpretes.",
      it: "Opere per tre strumenti ad arco, il più delle volte violino, viola e violoncello: musica da camera per quando non si è in quattro.",
    },
    match: (w) => w.scoring === "string-trio",
  },
  {
    id: "string-quartet",
    name: { ja: "弦楽四重奏", en: "String quartet", de: "Streichquartett", fr: "Quatuor à cordes", es: "Cuarteto de cuerda", it: "Quartetto d’archi" },
    intro: {
      ja: "ヴァイオリン2本・ヴィオラ・チェロのための作品です。スコアと各パート譜がそろっているかを作品ごとに確認できます。",
      en: "Works for two violins, viola and cello. Each work page shows whether the score and every part are available.",
      de: "Werke für zwei Violinen, Viola und Violoncello. Jede Werkseite zeigt, ob Partitur und alle Stimmen verfügbar sind.",
      fr: "Œuvres pour deux violons, alto et violoncelle. Chaque page d’œuvre indique si la partition et toutes les parties sont disponibles.",
      es: "Obras para dos violines, viola y violonchelo. Cada página de obra indica si están disponibles la partitura y todas las partes.",
      it: "Opere per due violini, viola e violoncello. Ogni pagina indica se sono disponibili la partitura e tutte le parti.",
    },
    match: (w) => w.scoring === "string-quartet",
  },
  {
    id: "string-orchestra",
    name: { ja: "弦楽合奏", en: "String orchestra", de: "Streichorchester", fr: "Orchestre à cordes", es: "Orquesta de cuerda", it: "Orchestra d’archi" },
    intro: {
      ja: "弦楽器だけの合奏のための作品です。各パートを複数人で演奏する前提で書かれています。",
      en: "Works for string orchestra, written with several players on each part.",
      de: "Werke für Streichorchester, geschrieben für mehrere Spieler pro Stimme.",
      fr: "Œuvres pour orchestre à cordes, écrites pour plusieurs musiciens par partie.",
      es: "Obras para orquesta de cuerda, escritas para varios intérpretes por parte.",
      it: "Opere per orchestra d’archi, scritte per più esecutori per parte.",
    },
    match: (w) => w.scoring === "string-orchestra",
  },
  {
    id: "piano-chamber",
    name: { ja: "ピアノを含む室内楽", en: "Chamber music with piano", de: "Kammermusik mit Klavier", fr: "Musique de chambre avec piano", es: "Música de cámara con piano", it: "Musica da camera con pianoforte" },
    intro: {
      ja: "ピアノ三重奏・ピアノ四重奏・ピアノ五重奏など、ピアノと弦楽器のための室内楽です。",
      en: "Piano trios, quartets and quintets — chamber music for piano and strings.",
      de: "Klaviertrios, -quartette und -quintette – Kammermusik für Klavier und Streicher.",
      fr: "Trios, quatuors et quintettes avec piano : de la musique de chambre pour piano et cordes.",
      es: "Tríos, cuartetos y quintetos con piano: música de cámara para piano y cuerdas.",
      it: "Trii, quartetti e quintetti con pianoforte: musica da camera per pianoforte e archi.",
    },
    match: (w) => w.scoring === "piano-trio" || w.scoring === "piano-quartet" || w.scoring === "piano-quintet",
  },
  {
    id: "concerto",
    name: { ja: "協奏曲", en: "Concertos", de: "Konzerte", fr: "Concertos", es: "Conciertos", it: "Concerti" },
    intro: {
      ja: "独奏楽器と管弦楽のための作品です。多くの作品では、独奏パートとピアノ伴奏（オーケストラ部分をピアノに置き換えた譜面）で練習・演奏できます。",
      en: "Works for solo instrument and orchestra. For many of them a solo part with piano reduction is available for practice and performance.",
      de: "Werke für Soloinstrument und Orchester. Für viele davon steht eine Solostimme mit Klavierauszug zum Üben und Aufführen zur Verfügung.",
      fr: "Œuvres pour instrument soliste et orchestre. Pour beaucoup d’entre elles, une partie soliste avec réduction pour piano est disponible pour le travail et le concert.",
      es: "Obras para instrumento solista y orquesta. Para muchas de ellas hay disponible una parte solista con reducción para piano para estudiar e interpretar.",
      it: "Opere per strumento solista e orchestra. Per molte è disponibile una parte solista con riduzione per pianoforte per lo studio e l’esecuzione.",
    },
    match: (w) => w.genre === "concerto",
  },
  {
    id: "viola",
    name: { ja: "ヴィオラ", en: "Viola", de: "Viola", fr: "Alto", es: "Viola", it: "Viola" },
    intro: {
      ja: "ヴィオラが主役の作品です。無伴奏の曲とピアノとの曲があります。",
      en: "Works featuring the viola, both unaccompanied and with piano.",
      de: "Werke mit der Viola im Mittelpunkt, sowohl ohne Begleitung als auch mit Klavier.",
      fr: "Œuvres mettant l’alto en vedette, sans accompagnement ou avec piano.",
      es: "Obras protagonizadas por la viola, tanto sin acompañamiento como con piano.",
      it: "Opere con la viola protagonista, sia senza accompagnamento sia con pianoforte.",
    },
    match: (w) => w.scoring === "viola" || w.scoring === "viola-piano" || (w.genre === "concerto" && w.instruments[0] === "viola"),
  },
  {
    id: "cello",
    name: { ja: "チェロ", en: "Cello", de: "Violoncello", fr: "Violoncelle", es: "Violonchelo", it: "Violoncello" },
    intro: {
      ja: "チェロが主役の作品です。無伴奏の曲・ピアノとの曲・協奏曲があります。",
      en: "Works featuring the cello: unaccompanied pieces, works with piano and concertos.",
      de: "Werke mit dem Violoncello im Mittelpunkt: Stücke ohne Begleitung, Werke mit Klavier und Konzerte.",
      fr: "Œuvres mettant le violoncelle en vedette : pièces sans accompagnement, œuvres avec piano et concertos.",
      es: "Obras protagonizadas por el violonchelo: piezas sin acompañamiento, obras con piano y conciertos.",
      it: "Opere con il violoncello protagonista: brani senza accompagnamento, opere con pianoforte e concerti.",
    },
    match: (w) => w.scoring === "cello" || w.scoring === "cello-piano" || (w.genre === "concerto" && w.instruments[0] === "cello"),
  },
  {
    id: "etudes",
    name: { ja: "練習曲・教本", en: "Études and methods", de: "Etüden und Lehrwerke", fr: "Études et méthodes", es: "Estudios y métodos", it: "Studi e metodi" },
    intro: {
      ja: "技術の習得を目的とした練習曲や教本です。レッスンで課題として使われることの多い曲集を中心に収録しています。",
      en: "Études and method books written to build technique, many of them standard lesson material.",
      de: "Etüden und Lehrwerke zum Aufbau der Technik, viele davon gängiges Unterrichtsmaterial.",
      fr: "Études et méthodes conçues pour construire la technique, dont beaucoup sont des classiques de l’enseignement.",
      es: "Estudios y métodos pensados para desarrollar la técnica, muchos de ellos material habitual de clase.",
      it: "Studi e metodi pensati per costruire la tecnica, molti dei quali sono materiale didattico di riferimento.",
    },
    match: (w) => w.genre === "etude",
  },
];
