import type { BudgetRange, PerformanceEnsemble, ScheduleMode, TimeSlot } from "@/data/orders/performance";
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
    curatorPortrait: string;
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
    kicker: string; // 「無料楽譜ライブラリ」
    narrow: string; // 「楽器・編成・種類で絞る」
    resultCount: (n: number, total: number) => string;
    submitWithCount: (n: number) => string;
    viewAll: (total: number) => string;
    clear: string;
    noMatch: string;
    // 入力補完
    suggestLabel: string; // 候補一覧の名前（読み上げ用）
    suggestComposers: string;
    suggestWorks: string;
    suggestComposerCount: (n: number) => string;
    suggestSearchAll: (q: string) => string;
    suggestHint: string; // 操作方法（読み上げ用）
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
    players: string; // 演奏人数
    playersOptions: Record<"1" | "2" | "3" | "4" | "5", string>;
    sheet: string; // 譜面の種類
    sheetHelp: string;
    sheetOptions: Record<"score" | "parts" | "both", string>;
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
  contentPages: Record<"bowing" | "lessons" | "recording" | "community" | "profile" | "privacy", ContentCopy>;
  // 管理人プロフィールの「執筆・発信活動」と「お問い合わせ」
  profileChannels: {
    heading: string;
    lead: string;
    channels: Record<"note" | "x", { name: string; description: string; cta: string }>;
    newTab: string;
    contactHeading: string;
    contactBody: string;
    contactCta: string;
  };
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
  // 申込・問い合わせフォームの共通の文言（演奏依頼の見積もり・講師登録）
  forms: {
    required: string;
    optional: string;
    contactHeading: string;
    name: string;
    email: string;
    consent: string;
    privacyLink: string;
    honeypot: string;
    submitting: string;
    back: string;
    copy: string;
    copied: string;
    fixErrors: string;
    errors: { name: string; email: string; consent: string };
    result: { notConnectedTitle: string; notConnectedBody: string; errorTitle: string; errorBody: string; receiptNote: string };
  };
  // 演奏依頼の見積もり（PR #24 §1）
  performanceQuote: {
    pageTitle: string;
    pageLead: string;
    points: readonly string[];
    formHeading: string;
    schedule: {
      heading: string;
      modes: Record<ScheduleMode, string>;
      date: string;
      candidate: (n: number) => string;
      slot: string;
      slots: Record<TimeSlot, string>;
      time: string;
      timePlaceholder: string;
      add: string;
      remove: string;
      period: string;
      periodPlaceholder: string;
    };
    budget: { heading: string; options: Record<BudgetRange, string>; note: string };
    ensemble: { heading: string; options: Record<PerformanceEnsemble, string>; notes: Record<PerformanceEnsemble, string>; instruments: string; instrumentsPlaceholder: string };
    remarks: { heading: string; help: string; placeholder: string };
    /** お支払い方法の説明（演奏依頼は見積もりの確定後に支払い） */
    paymentNote: { card: string; bank: string };
    review: string;
    submit: string;
    note: string;
    confirm: { heading: string; lead: string };
    result: { sentTitle: string; sentBody: string };
    errors: { schedule: string; dates: string; budget: string; ensemble: string };
  };
  // 講師登録の申請（PR #24 §2）。料金の項目は作らない（CLAUDE.md）
  teacherRegister: {
    cta: { heading: string; body: string; button: string };
    pageTitle: string;
    pageLead: string;
    stepsHeading: string;
    steps: readonly string[];
    rulesHeading: string;
    rules: readonly string[];
    publicHeading: string;
    publicHelp: string;
    privateHeading: string;
    privateHelp: string;
    displayName: string;
    displayNamePlaceholder: string;
    nameKana: string;
    nameKanaPlaceholder: string;
    nameRomaji: string;
    nameRomajiPlaceholder: string;
    instruments: string;
    instrumentsHelp: string;
    prefecture: string;
    prefectureSelect: string;
    station: string;
    stationPlaceholder: string;
    travel: string;
    travelOptions: Record<"none" | "30" | "60" | "90", string>;
    formats: string;
    audiences: string;
    ageGroup: string;
    ageGroupOptions: Record<"undisclosed" | "10s" | "20s" | "30s" | "40s" | "50s" | "60plus", string>;
    gender: string;
    genderOptions: Record<"undisclosed" | "female" | "male" | "other", string>;
    school: string;
    schoolPlaceholder: string;
    enrollment: string;
    enrollmentOptions: Record<"student" | "graduate", string>;
    department: string;
    departmentPlaceholder: string;
    gradYear: string;
    gradYearPlaceholder: string;
    intro: string;
    introHelp: (max: number) => string;
    introPlaceholder: string;
    links: string;
    linksHelp: string;
    linkLabel: (n: number) => string;
    legalName: string;
    legalNameHelp: string;
    emailHelp: string;
    documentsNote: string;
    photoNote: string;
    eligibility: string;
    publish: string;
    review: string;
    submit: string;
    note: string;
    confirm: { heading: string; lead: string };
    result: { sentTitle: string; sentBody: string };
    errors: {
      displayName: string;
      nameKana: string;
      nameRomaji: string;
      instruments: string;
      prefecture: string;
      formats: string;
      audiences: string;
      school: string;
      enrollment: string;
      intro: string;
      links: string;
      legalName: string;
      eligibility: string;
      publish: string;
    };
  };
  orderForm: {
    pageTitle: string;
    pageLead: string;
    tabsLabel: string;
    tabs: Record<"lesson" | "bowing" | "recording", string>;
    estimateNote: string;
    taxNote: string;
    required: string;
    optional: string;
    /** 請求先の国・地域（通貨が決まる。言語とは無関係） */
    billing: { heading: string; options: Record<"jp" | "intl", string>; provisional: string; autoNote: string; unknownNote: string };
    /** 支払い方法（銀行振込は日本のみ）と支払いの時期 */
    payment: { heading: string; options: Record<"card" | "bank_transfer", string>; cardNote: string; bankNote: string; intlNote: string; timing: string };
    lessonCurrencyNote: string;
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
      /** 楽譜 PDF の添付（任意・PDF のみ・1 ファイル 20 MB・3 ファイルまで） */
      upload: {
        label: string;
        help: string;
        choose: string;
        uploading: string;
        uploaded: string;
        remove: string;
        files: string;
        waiting: string;
        errors: Record<"not_connected" | "pdf_only" | "too_large" | "rate_limited" | "failed" | "too_many", string>;
      };
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
      summaryReference: string; // 概要の参考資料の見出し（「参考」）
      contents: string;
      contentsValue: (scores: number, parts: number) => string;
      printVolume: string;
      printVolumeValue: (files: number, pages: number) => string;
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
      // 料金は料金マスタから（地域に応じて円／ドル）。文言だけを辞書に持つ
      priceLines: Record<"fingering" | "bowing" | "both", (price: string) => string>;
      priceNote: Record<"jp" | "intl" | "unknown", string>;
      cta: string;
      note: string;
    };
    ad: {
      label: string;
      placeholder: string;
      amazonHeading: string;
      amazonDisclosure: string;
    };
    // Google AdSense の枠（クライアント部品に渡すため関数を含めない）
    adsense: { label: string; previewNote: string };
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
