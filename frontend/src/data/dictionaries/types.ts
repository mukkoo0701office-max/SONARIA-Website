import type { ImageKey } from "@/data/images";
import type { FormsDictionary } from "./forms/types";
import type { ServiceKey } from "@/data/services";
import type { PageKey } from "@/data/site";
import type { Audience, Instrument, InstrumentCategory, LessonFormat } from "@/data/teachers";
import type { Ensemble, Era, MusicalForm } from "@/data/works";

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
    players: string;
    playersOptions: { all: string; "1": string; "2": string; "3": string; "4": string; "5plus": string };
    playersCount: (n: number) => string;
    ensemble: string;
    ensembleOptions: Record<"all" | Ensemble, string>;
    form: string;
    formOptions: Record<"all" | MusicalForm, string>;
    advanced: string;
    era: string;
    eraOptions: Record<"all" | Era, string>;
    works: string;
    reset: string;
    sort: string;
    sortOptions: { title: string; composer: string; pdfCount: string };
    view: string;
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
  placeholders: Record<"performance" | "contact", PlaceholderCopy>;
  // 内容のあるページ（旧サイト https://www.mukkoo0701music.jp/ の文章をもとに作成）
  contentPages: Record<"bowing" | "lessons" | "recording" | "community" | "profile", ContentCopy>;
  contentCta: {
    contact: string;
    profile: string;
    teachers: string;
  };
  community: {
    externalLinkLabel: string;
  };
  services: {
    priceLater: string;
  };
  // プライバシーポリシー（草案）
  privacyPolicy: ContentCopy;
  // 申し込みフォーム（src/data/dictionaries/forms/）
  forms: FormsDictionary;
  apply: {
    lessonCta: string;
    bowingCta: string;
  };
};
