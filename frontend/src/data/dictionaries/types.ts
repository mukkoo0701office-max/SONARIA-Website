import type { Ensemble, Era, MusicalForm } from "@/data/works";

// 日英の文言は必ずこの型に沿って同じ構造で持つ（CLAUDE.md: 日英の文言は同じ構造のデータで持つ）
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
  };
  nav: {
    home: string;
    scores: string;
    teachers: string;
    about: string;
    mainNavLabel: string;
  };
  footer: {
    copyright: string;
    legalPending: string;
  };
  home: {
    headline: string;
    lead: string;
    scoresCardTitle: string;
    scoresCardBody: string;
    scoresCardAction: string;
    teachersCardTitle: string;
    teachersCardBody: string;
    teachersCardAction: string;
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
    body: string;
    rules: readonly string[];
  };
  about: {
    pageTitle: string;
    headline: string;
    body: string;
  };
};
