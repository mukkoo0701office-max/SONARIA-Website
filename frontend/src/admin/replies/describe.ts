// 申し込みの入力内容を「読みやすく整理した表示」と「返信文に差し込む値（facts）」に変換する。
// 選択肢の表示名はサイトの辞書（フォームと同じ文言）から取るので、フォームの文言を変えれば管理画面も追従する。
// 将来フォームの項目が増減しても、知らない項目は「その他の項目」として原文のまま出す（過去の回答を落とさない）。

import { getDictionary } from "@/data/dictionaries";
// 管理画面と返信文は日本語・英語だけ（多言語化の対象外。docs/i18n/I18N_FOUNDATION.md）
type Locale = "ja" | "en";
import { lessonPlans } from "@/data/orders/config";

export type SubmissionKind = "lesson" | "bowing" | "recording" | "performance_quote" | "teacher_application";
export type RawSubmission = { kind: SubmissionKind; locale: Locale; payload: Record<string, unknown>; estimate: number | null; receiptNo: string; receivedAt: string };

export type Row = { label: string; value: string; empty?: boolean };
export type Section = { title: string; rows: Row[] };

/** 返信文に差し込める値。顧客が入力した値は「表示用の文字列」としてだけ使い、指示として解釈しない */
export type Facts = Record<string, string | undefined>;

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => typeof v === "object" && v !== null && !Array.isArray(v);
const s = (v: unknown) => (typeof v === "string" ? v.trim() : typeof v === "number" ? String(v) : "");

const L = {
  ja: { request: "依頼の内容", customer: "お客さん", other: "その他の項目", none: "（未入力）", yes: "はい", no: "いいえ", name: "お名前", email: "メールアドレス", remarks: "備考", estimate: "画面に表示した概算（参考）", pages: (n: string) => `${n}ページ`, tracks: (n: number) => `${n}トラック`, minutes: (m: number) => `${m}分` },
  en: { request: "Request", customer: "Customer", other: "Other fields", none: "(not entered)", yes: "Yes", no: "No", name: "Name", email: "Email", remarks: "Notes", estimate: "Estimate shown on screen (reference)", pages: (n: string) => `${n} pages`, tracks: (n: number) => `${n} ${n === 1 ? "track" : "tracks"}`, minutes: (m: number) => `${m} min` },
};

function fmtDate(date: string, locale: Locale): string {
  const d = new Date(`${date}T00:00:00+09:00`);
  if (Number.isNaN(d.getTime())) return date;
  return new Intl.DateTimeFormat(locale === "ja" ? "ja-JP" : "en-US", { timeZone: "Asia/Tokyo", year: "numeric", month: "long", day: "numeric", weekday: "short" }).format(d);
}

const yen = (n: number, locale: Locale) => new Intl.NumberFormat(locale === "ja" ? "ja-JP" : "en-US", { style: "currency", currency: "JPY", maximumFractionDigits: 0 }).format(n);

// 既に表示した項目（「その他の項目」に重ねて出さない）
const KNOWN: Record<SubmissionKind, string[]> = {
  performance_quote: ["kind", "locale", "schedule", "budget", "ensemble", "instruments", "remarks", "contact", "consent"],
  lesson: ["service", "locale", "createdAt", "estimateTotal", "lesson", "bowing", "recording", "customer"],
  bowing: ["service", "locale", "createdAt", "estimateTotal", "lesson", "bowing", "recording", "customer"],
  recording: ["service", "locale", "createdAt", "estimateTotal", "lesson", "bowing", "recording", "customer"],
  teacher_application: ["kind", "locale", "public", "private", "agreements", "status"],
};

function flattenUnknown(v: unknown, prefix: string, out: Row[]) {
  if (isObj(v)) for (const [k, x] of Object.entries(v)) flattenUnknown(x, prefix ? `${prefix}.${k}` : k, out);
  else if (Array.isArray(v)) out.push({ label: prefix, value: v.map((x) => (isObj(x) ? JSON.stringify(x) : String(x))).join(", ") });
  else if (v !== undefined && v !== null && String(v).trim() !== "") out.push({ label: prefix, value: String(v) });
}

/** 整理した表示（セクション）と、返信文用の値 */
export function describeSubmission(raw: RawSubmission, viewLocale: Locale): { sections: Section[]; facts: Facts } {
  // 選択肢の表示名は「表示する言語」で、返信文用の値は「お客さんの言語」で作る
  const show = build(raw, viewLocale);
  const customer = viewLocale === raw.locale ? show : build(raw, raw.locale);
  return { sections: show.sections, facts: customer.facts };
}

function build(raw: RawSubmission, locale: Locale): { sections: Section[]; facts: Facts } {
  const d = getDictionary(locale);
  const l = L[locale];
  const p = raw.payload;
  const rows: Row[] = [];
  const facts: Facts = { case_number: raw.receiptNo };
  const row = (label: string, value: string) => rows.push(value ? { label, value } : { label, value: l.none, empty: true });

  let name = "";
  let email = "";
  let remarks = "";

  if (raw.kind === "performance_quote") {
    const pq = d.performanceQuote;
    const sch = isObj(p.schedule) ? p.schedule : {};
    const mode = s(sch.mode) as keyof typeof pq.schedule.modes;
    const dates = Array.isArray(sch.dates) ? sch.dates.filter(isObj) : [];
    const dateText = dates
      .map((x) => {
        const slot = s(x.slot) as keyof typeof pq.schedule.slots;
        const time = s(x.time);
        return [fmtDate(s(x.date), locale), slot && slot !== "any" ? pq.schedule.slots[slot] : "", time].filter(Boolean).join(" ");
      })
      .join(" / ");
    const scheduleText = mode === "undecided" ? [pq.schedule.modes.undecided, s(sch.period)].filter(Boolean).join("・") : dateText;
    row(pq.schedule.heading, scheduleText);
    const budget = s(p.budget) as keyof typeof pq.budget.options;
    row(pq.budget.heading, pq.budget.options[budget] ?? s(p.budget));
    const ens = s(p.ensemble) as keyof typeof pq.ensemble.options;
    row(pq.ensemble.heading, [pq.ensemble.options[ens] ?? s(p.ensemble), s(p.instruments)].filter(Boolean).join("・"));
    const c = isObj(p.contact) ? p.contact : {};
    name = s(c.name);
    email = s(c.email);
    remarks = s(p.remarks);
    facts.service_name = locale === "ja" ? "演奏のご依頼" : "performance request";
    facts.requested_date = mode === "undecided" ? undefined : dateText || undefined;
    facts.schedule_undecided = mode === "undecided" ? "1" : undefined;
    facts.ensemble = ens && ens !== "other" ? pq.ensemble.options[ens] : s(p.instruments) || undefined;
    facts.budget = budget && budget !== "undecided" ? pq.budget.options[budget] : undefined;
    facts.budget_undecided = budget === "undecided" ? "1" : undefined;
  } else if (raw.kind === "teacher_application") {
    const tr = d.teacherRegister;
    const pub = isObj(p.public) ? p.public : {};
    const edu = isObj(pub.education) ? pub.education : {};
    const priv = isObj(p.private) ? p.private : {};
    row(tr.displayName, s(pub.displayName));
    row(tr.nameKana, s(pub.nameKana));
    row(tr.nameRomaji, s(pub.nameRomaji));
    row(tr.instruments, Array.isArray(pub.instruments) ? pub.instruments.map(s).join(", ") : "");
    row(tr.prefecture, s(pub.prefectureCode));
    row(tr.station, s(pub.station));
    const enrollment = s(edu.enrollment) as keyof typeof tr.enrollmentOptions;
    row(tr.school, [s(edu.school), tr.enrollmentOptions[enrollment], s(edu.department), s(edu.gradYear)].filter(Boolean).join("・"));
    row(tr.intro, s(pub.intro));
    row(tr.links, Array.isArray(pub.externalLinks) ? pub.externalLinks.map(s).filter(Boolean).join("\n") : "");
    name = s(priv.legalName) || s(pub.displayName);
    email = s(priv.email);
    facts.service_name = locale === "ja" ? "講師登録" : "teacher registration";
    facts.display_name = s(pub.displayName) || undefined;
    facts.school = s(edu.school) || undefined;
  } else {
    const of = d.orderForm;
    const svc = raw.kind;
    const c = isObj(p.customer) ? p.customer : {};
    name = s(c.name);
    email = s(c.email);
    remarks = s(c.remarks);
    facts.service_name = of.tabs[svc];
    if (svc === "lesson") {
      const ls = isObj(p.lesson) ? p.lesson : {};
      const plan = s(ls.plan) as keyof typeof of.lesson.plans;
      const def = lessonPlans.find((x) => x.id === plan);
      row(of.lesson.plan, [of.lesson.plans[plan] ?? s(ls.plan), def?.minutes ? l.minutes(def.minutes) : ""].filter(Boolean).join("・"));
      row(of.lesson.trialQuestion, ls.trialTaken === true ? l.yes : ls.trialTaken === false ? l.no : "");
      const cands = Array.isArray(ls.candidates) ? ls.candidates.filter(isObj) : [];
      const candText = cands.map((x, i) => `${i + 1}. ${fmtDate(s(x.date), locale)} ${s(x.time)}`).join("\n");
      row(of.lesson.candidates, candText);
      facts.plan = of.lesson.plans[plan];
      facts.candidates = candText || undefined;
      if (def) facts.service_price = yen(def.price, locale);
    } else if (svc === "bowing") {
      const b = isObj(p.bowing) ? p.bowing : {};
      const type = s(b.type) as keyof typeof of.bowing.types;
      row(of.bowing.type, of.bowing.types[type] ?? s(b.type));
      row(of.bowing.pages, s(b.pages) ? l.pages(s(b.pages)) : "");
      row(of.bowing.score, s(b.score));
      const dl = s(b.delivery) as keyof typeof of.delivery.options;
      row(of.delivery.heading, of.delivery.options[dl] ?? s(b.delivery));
      facts.work_type = of.bowing.types[type];
      facts.pages = s(b.pages) ? l.pages(s(b.pages)) : undefined;
      facts.score_title = s(b.score) || undefined;
      facts.delivery = of.delivery.options[dl];
    } else {
      const r = isObj(p.recording) ? p.recording : {};
      const tracks = isObj(r.tracks) ? r.tracks : {};
      const list = (Object.keys(of.recording.instruments) as (keyof typeof of.recording.instruments)[])
        .filter((k) => Number(tracks[k] ?? 0) > 0)
        .map((k) => `${of.recording.instruments[k]} ${l.tracks(Number(tracks[k]))}`)
        .join("、");
      row(of.recording.tracks, list);
      if (s(r.otherDetail)) row(of.recording.otherDetail, s(r.otherDetail));
      const dl = s(r.delivery) as keyof typeof of.delivery.options;
      row(of.delivery.heading, of.delivery.options[dl] ?? s(r.delivery));
      facts.tracks = list || undefined;
      facts.delivery = of.delivery.options[dl];
    }
    if (raw.estimate != null) {
      rows.push({ label: l.estimate, value: yen(raw.estimate, locale) });
      facts.estimate = yen(raw.estimate, locale);
    }
  }

  const other: Row[] = [];
  for (const [k, v] of Object.entries(p)) if (!KNOWN[raw.kind].includes(k)) flattenUnknown(v, k, other);

  facts.customer_name = name || undefined;
  const sections: Section[] = [
    { title: l.request, rows },
    { title: l.customer, rows: [{ label: l.name, value: name || l.none, empty: !name }, { label: l.email, value: email || l.none, empty: !email }, ...(raw.kind === "teacher_application" ? [] : [{ label: l.remarks, value: remarks || l.none, empty: !remarks }])] },
  ];
  if (other.length) sections.push({ title: l.other, rows: other });
  return { sections, facts };
}
