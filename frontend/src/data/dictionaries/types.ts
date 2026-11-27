import type { ImageKey } from "@/data/images";
import type { ServiceKey } from "@/data/services";
import type { PageKey } from "@/data/site";
import type { Audience, Instrument, InstrumentCategory, LessonFormat } from "@/data/teachers";
import type { Genre, Part, Scoring } from "@/data/scores/types";
import type { Era, Formation, Genre as ScoreGenre, Instrument as ScoreInstrument } from "@/data/works";

// 仮ページ（未完成のページ）の文言
export type PlaceholderCopy = {
  title: string;
  lead: string;
  body: readonly string[];
};

// 内容のあるサービス・紹介ページの文言（見出しごとの段落・箇条書き）
export type ContentSection = {
  heading: string;
  paragraphs?: readonly string[];
  items?: readonly string[];
  ordered?: boolean; // 手順など番号付きの箇条書きにする
};

export type ContentCopy = {
  title: string;
  lead: string;
  sections: readonly ContentSection[];
  footnote?: string;
};

// 日英の文言は必ずこの型に沿って同じ構造で持つ（CLAUDE.md: 日英の文言は同じ構造のデータで持つ）
// 関数を含むため、サーバーコンポーネントからクライアントコンポーネントへ辞書を props で渡さない。
// クライアント側では getDictionary(locale) を直接呼ぶ。
export type Dictionary = {
  meta: {
    siteTitle: string;
    siteDescription: string;
  };
  common: {
    tagline: string;
    languageLabel: string;
    languageNames: { ja: string; en: string };
    comingSoon: string;
    skipToContent: string;
    learnMore: string;
    externalSite: string;
    backToHome: string;
  };
  // ページ名（ナビ・パンくず・フッターで共通）
  pages: Record<PageKey, string>;
  header: {
    mainNavLabel: string;
    menuOpen: string;
    menuClose: string;
    homeLinkLabel: string;
  };
  footer: {
    siteLinksHeading: string;
    supportHeading: string;
    snsHeading: string;
    snsPending: string;
    copyright: string;
  };
  images: {
    alt: Record<ImageKey, string>;
  };
  hero: {
    label: string;
    prev: string;
    next: string;
    pause: string;
    play: string;
    goTo: (index: number, title: string) => string;
    slideOf: (index: number, total: number) => string;
    slides: Record<PageKey, { title: string; catchCopy: string; cta: string }>;
  };
  homeScoreSearch: {
    heading: string;
    lead: string;
    leadWithCount: (n: number) => string;
    keyword: string;
    placeholder: string;
    submit: string;
    detailLink: string;
    byComposer: string;
    freeNote: string;
  };
  homeTeacherSearch: {
    heading: string;
    lead: string;
    instrument: string;
    region: string;
    format: string;
    formatAny: string;
    formatInPerson: string;
    formatOnline: string;
    visiting: string;
    submit: string;
    detailLink: string;
    freeNote: string;
  };
  servicesPickup: {
    heading: string;
    lead: string;
    prev: string;
    next: string;
    note: string;
    items: Record<ServiceKey, { title: string; body: string }>;
  };
  scores: {
    pageTitle: string;
    headline: string;
    subtitle: string;
    searchLabel: string;
    placeholder: string;
    instrument: string; // 「自分の楽器」で探す
    instrumentHelp: string;
    instrumentOptions: Record<ScoreInstrument, string>;
    formation: string;
    formationOptions: Record<Formation, string>;
    genre: string;
    genreOptions: Record<ScoreGenre, string>;
    composer: string;
    composerAll: string;
    all: string;
    active: string; // 選択中の条件
    removeFilter: (label: string) => string;
    showMore: string;
    showLess: string;
    advanced: string;
    era: string;
    eraOptions: Record<"all" | Era, string>;
    works: string;
    reset: string;
    sort: string;
    sortOptions: { title: string; composer: string; pdfCount: string };
    view: string;
    viewShort: string; // 検索結果カードのボタン（狭い場所用）
    close: string;
    details: string;
    detailText: string;
    download: string;
    empty: string;
    demo: string;
    saved: string;
    favorite: string;
    pdf: string;
    pagePrev: string;
    pageNext: string;
    resultsLabel: string;
  };
  teachers: {
    pageTitle: string;
    headline: string;
    lead: string;
    keyword: string;
    keywordPlaceholder: string;
    category: string;
    categoryAll: string;
    categories: Record<InstrumentCategory, string>;
    instruments: Record<Instrument, string>;
    prefecture: string;
    prefectureAll: string;
    format: string;
    formats: Record<LessonFormat, string>;
    gender: string;
    genderOptions: { any: string; female: string; male: string };
    audience: string;
    audiences: Record<Audience, string>;
    advanced: string;
    count: string;
    reset: string;
    sort: string;
    sortOptions: { name: string; area: string };
    viewProfile: string;
    empty: string;
    noneYet: string;
    demoNotice: string;
    rules: readonly string[];
    travel: (minutes: number) => string;
    nearestStation: (station: string) => string;
    online: string;
    pagePrev: string;
    pageNext: string;
    resultsLabel: string;
    demoBadge: string;
  };
  teacherProfile: {
    pageTitle: string;
    breadcrumbLabel: string;
    notFound: string;
    instruments: string;
    area: string;
    formats: string;
    audiences: string;
    education: string;
    selfDeclared: string;
    intro: string;
    externalLinks: string;
    externalNote: string;
    noExternalLinks: string;
    backToSearch: string;
  };
  about: {
    pageTitle: string;
    headline: string;
    body: string;
  };
  // 準備中のページ
  placeholders: Record<"performance" | "contact" | "privacy", PlaceholderCopy>;
  // 内容のあるページ（旧サイト https://www.mukkoo0701music.jp/ の文章をもとに作成）
  contentPages: Record<"bowing" | "lessons" | "recording" | "community" | "profile", ContentCopy>;
  contentCta: {
    contact: string;
    profile: string;
    teachers: string;
    apply: string;
  };
  community: {
    externalLinkLabel: string;
  };
  services: {
    priceLater: string;
  };
  // 楽譜ライブラリ（作品・作曲家・カテゴリの自動生成ページ）
  orderForm: {
    pageTitle: string;
    pageLead: string;
    tabsLabel: string;
    tabs: Record<"lesson" | "bowing" | "recording", string>;
    estimateNote: string;
    taxNote: string;
    required: string;
    optional: string;
    lesson: {
      heading: string;
      trialQuestion: string;
      trialYes: string;
      trialNo: string;
      trialUsedNote: string;
      plan: string;
      plans: Record<"trial" | "single" | "intensive" | "visiting", string>;
      minutes: (m: number) => string;
      firstTimeOnly: string;
      candidates: string;
      candidatesHelp: string;
      dayLabel: (month: number, day: number, weekday: string) => string;
      weekdays: readonly string[];
      today: string;
      selected: string;
      priority: (n: number) => string;
      moveUp: string;
      moveDown: string;
      remove: string;
      endsLateNote: string;
      noCandidates: string;
      candidatesMax: (n: number) => string;
      notBooking: string;
    };
    bowing: {
      heading: string;
      type: string;
      types: Record<"bowing" | "fingering" | "both", string>;
      perPage: (yen: string) => string;
      setDeal: (list: string, set: string, save: string) => string;
      pages: string;
      score: string;
      scorePlaceholder: string;
    };
    recording: {
      heading: string;
      instruments: Record<"violin" | "viola" | "cello" | "other", string>;
      perTrack: (yen: string) => string;
      outsourced: string;
      tracks: string;
      otherDetail: string;
      otherDetailPlaceholder: string;
      noTracks: string;
    };
    delivery: {
      heading: string;
      options: Record<"nextDay" | "twoDays" | "threePlus", string>;
      factor: (x: string) => string;
      startNote: string;
    };
    common: {
      heading: string;
      name: string;
      email: string;
      emailInvalid: string;
      remarks: string;
      remarksPlaceholder: string;
      consent: string;
      privacyLink: string;
      consentRequired: string;
      nameRequired: string;
    };
    summary: {
      heading: string;
      subtotal: string;
      base: string;
      deliveryFactor: string;
      total: string;
      lineBowing: (type: string, unit: string, pages: number) => string;
      lineTrack: (inst: string, unit: string, tracks: number) => string;
      lineLesson: (plan: string) => string;
      empty: string;
    };
    stepper: { decrease: string; increase: string };
    actions: { review: string; back: string; submit: string; submitting: string; copy: string; copied: string; fixErrors: string };
    confirm: { heading: string; lead: string };
    result: {
      notConnectedTitle: string;
      notConnectedBody: string;
      sentTitle: string;
      sentBody: string;
      errorTitle: string;
      errorBody: string;
    };
  };
  library: {
    breadcrumb: string;
    home: string;
    scores: string;
    composers: string;
    sampleNotice: string;
    onlyJapanese: string;
    parts: Record<Part, string>;
    scoring: Record<Scoring, string>;
    genre: Record<Genre, string>;
    instruments: Record<string, string>;
    work: {
      metaTitle: (composer: string, title: string, catalog: string) => string;
      metaDescription: (composer: string, title: string, catalog: string, files: string) => string;
      facts: string;
      composer: string;
      catalogNumber: string;
      key: string;
      composed: string;
      instrumentation: string;
      movements: string;
      duration: string;
      durationValue: (minutes: number) => string;
      difficulty: string;
      difficultyLevels: Record<1 | 2 | 3 | 4 | 5, string>;
      faqTitle: string;
      qContents: string;
      aContents: (score: string | null, parts: string[]) => string;
      scoreItem: (pages: number) => string;
      partItem: (label: string, pages: number) => string;
      qPlayers: string;
      playersByScoring: Partial<Record<Scoring, string>>;
      soloWithPiano: (solo: string) => string;
      soloWithEnsemble: string;
      qPrint: string;
      aPrint: (total: number, files: number, perPlayer: string | null) => string;
      perPlayer: (label: string, pages: number) => string;
      qMovements: string;
      aMovements: (n: number, list: string) => string;
      qFree: string;
      aFree: (title: string, files: number, rightsConfirmed: boolean) => string;
      scoresTitle: string;
      scoresLead: string;
      scoresLeadRemote: string;
      publisher: string;
      year: string;
      editor: string;
      source: string;
      sourceTypes: { imslp: string; own: string; other: string };
      license: string;
      rightsBasis: string;
      pages: (n: number) => string;
      preview: string;
      closePreview: string;
      open: string;
      download: string;
      previewAlt: (label: string) => string;
      iframeTitle: (label: string) => string;
      overview: string;
      features: string;
      performanceTips: string;
      videos: string;
      sources: string;
      published: string;
      updated: string;
      changelog: string;
      reportTitle: string;
      reportLead: string;
      reportCta: string;
      related: string;
      pendingRights: string;
      remoteNote: string;
    };
    composer: {
      metaTitle: (name: string) => string;
      metaDescription: (name: string, works: number) => string;
      lifespan: string;
      nationality: string;
      position: string;
      life: string;
      style: string;
      notableWorks: string;
      worksInLibrary: (n: number) => string;
      related: string;
      portraitAlt: (name: string) => string;
      portraitCredit: string;
      sources: string;
      indexTitle: string;
      indexLead: string;
    };
    category: {
      metaTitle: (name: string) => string;
      metaDescription: (name: string, works: number) => string;
      works: (n: number) => string;
    };
    browse: {
      byComposer: string;
      byCategory: string;
      newest: string;
      featured: string;
    };
    bowing: {
      title: string;
      lead: string;
      prices: readonly string[];
      cta: string;
      note: string;
    };
    ad: {
      label: string;
      placeholder: string;
      amazonHeading: string;
      amazonDisclosure: string;
    };
    // 関数を含むため、ad（クライアント部品にも渡す共通の広告文言）とは分ける
    amazonSearch: {
      heading: string;
      lead: string;
      kindsLabel: string;
      kinds: Record<"score" | "parts" | "pocket" | "books", string>;
      keywordLabel: string;
      cta: string;
      newWindow: string;
      bannerKicker: string;
      bannerHeading: (composer: string) => string;
      bannerLead: string;
      bannerCta: string;
      bannerKeyword: (composer: string) => string; // バナーの検索語
    };
  };
};
