// 返信文の部品（初期の文例）と組み立て（純粋な関数）。
// 注: Node のテストから直接読めるよう、値の import をしない 1 ファイルにまとめている
// 返信文の部品（初期の文例）。運営者が管理画面で編集できるようにするのは次の段階（PR ④）。
// ルール:
//   - 金額・日程・納期は、運営者が画面で入力した値（quote_amount / booking_datetime / deadline）だけを使う。部品に直接書かない
//   - 料金表の金額（service_price）は config.ts から読む（料金を変えれば新しい返信文に反映される）
//   - 顧客の自由記述（備考など）は部品に差し込まない（指示として扱わない）
//   - 署名は個人名ではなく SONARIA
//   - 会場・演奏時間の質問は入れない（運営者が状況に応じて書き足す。2026-11-28 決定）

import type { Locale } from "@/lib/i18n";
import type { Facts, SubmissionKind } from "./describe";

export type Purpose =
  | "first_reply"
  | "quote"
  | "booking"
  | "reschedule"
  | "delivery"
  | "revision"
  | "thanks"
  | "follow_up"
  | "payment_thanks"
  | "cancel"
  | "decline"
  | "received"
  | "request_info"
  | "approved"
  | "rejected";

/** フォームの種類ごとに選べる返信の目的（並び順＝表示順） */
export const purposesByKind: Record<SubmissionKind, Purpose[]> = {
  performance_quote: ["first_reply", "quote", "booking", "thanks", "follow_up", "payment_thanks", "cancel", "decline"],
  lesson: ["first_reply", "booking", "reschedule", "follow_up", "cancel", "decline"],
  bowing: ["first_reply", "quote", "delivery", "revision", "follow_up", "payment_thanks", "decline"],
  recording: ["first_reply", "quote", "delivery", "revision", "follow_up", "payment_thanks", "decline"],
  teacher_application: ["received", "request_info", "approved", "rejected"],
};

/** 運営者が画面で入力する値（金額・日時は自動で入れない） */
export type InputKey = "quote_amount" | "booking_datetime" | "deadline";
export const inputsByPurpose: Partial<Record<Purpose, InputKey[]>> = {
  quote: ["quote_amount", "deadline"],
  booking: ["booking_datetime"],
  reschedule: ["booking_datetime"],
  delivery: [],
};

type Text = { ja: string; en: string };
export type Block = {
  key: string;
  title: Text; // 部品の名前（画面のチェック欄に出す）
  kinds: SubmissionKind[] | "all";
  purposes: Purpose[];
  order: number;
  /** 差し込む値がそろっている／空のときだけ使う（例: 予算が未定なら予算を尋ねる） */
  when?: { has?: string[]; missing?: string[] };
  /** 初期状態ではチェックを外しておく（必要なときだけ運営者が選ぶ） */
  optional?: boolean;
  text: Text;
};

const ALL_PAID: SubmissionKind[] = ["performance_quote", "lesson", "bowing", "recording"];

export const subjects: Record<Purpose, Text> = {
  first_reply: { ja: "{service_name}ありがとうございます｜SONARIA（{case_number}）", en: "Thank you for your {service_name} | SONARIA ({case_number})" },
  quote: { ja: "お見積もりのご案内｜SONARIA（{case_number}）", en: "Your quote | SONARIA ({case_number})" },
  booking: { ja: "ご予約が確定しました｜SONARIA（{case_number}）", en: "Your booking is confirmed | SONARIA ({case_number})" },
  reschedule: { ja: "日程変更のご案内｜SONARIA（{case_number}）", en: "Change of schedule | SONARIA ({case_number})" },
  delivery: { ja: "納品のご案内｜SONARIA（{case_number}）", en: "Your files are ready | SONARIA ({case_number})" },
  revision: { ja: "修正のご依頼を承りました｜SONARIA（{case_number}）", en: "We received your revision request | SONARIA ({case_number})" },
  thanks: { ja: "ありがとうございました｜SONARIA（{case_number}）", en: "Thank you | SONARIA ({case_number})" },
  follow_up: { ja: "先日のご依頼について｜SONARIA（{case_number}）", en: "Following up on your request | SONARIA ({case_number})" },
  payment_thanks: { ja: "ご入金を確認しました｜SONARIA（{case_number}）", en: "Payment received | SONARIA ({case_number})" },
  cancel: { ja: "キャンセルを承りました｜SONARIA（{case_number}）", en: "Your cancellation | SONARIA ({case_number})" },
  decline: { ja: "ご依頼について｜SONARIA（{case_number}）", en: "About your request | SONARIA ({case_number})" },
  received: { ja: "講師登録の申請を受け付けました｜SONARIA（{case_number}）", en: "We received your teacher application | SONARIA ({case_number})" },
  request_info: { ja: "講師登録の申請について（ご確認のお願い）｜SONARIA（{case_number}）", en: "Your teacher application: a few questions | SONARIA ({case_number})" },
  approved: { ja: "講師ページを掲載しました｜SONARIA（{case_number}）", en: "Your teacher profile is live | SONARIA ({case_number})" },
  rejected: { ja: "講師登録の申請について｜SONARIA（{case_number}）", en: "About your teacher application | SONARIA ({case_number})" },
};

export const blocks: Block[] = [
  // ── 宛名・あいさつ（共通） ─────────────────────────────
  { key: "salutation", title: { ja: "宛名", en: "Salutation" }, kinds: "all", purposes: Object.keys(subjects) as Purpose[], order: 0, text: { ja: "{customer_name} 様", en: "Dear {customer_name}," } },
  {
    key: "thanks_first",
    title: { ja: "お問い合わせのお礼", en: "Thank you" },
    kinds: ALL_PAID,
    purposes: ["first_reply"],
    order: 10,
    text: { ja: "このたびは SONARIA に{service_name}をいただき、ありがとうございます。", en: "Thank you for your {service_name} with SONARIA." },
  },
  {
    key: "greeting",
    title: { ja: "あいさつ", en: "Greeting" },
    kinds: "all",
    purposes: ["quote", "booking", "reschedule", "delivery", "revision", "thanks", "follow_up", "payment_thanks", "cancel", "decline", "request_info", "approved", "rejected"],
    order: 10,
    text: { ja: "SONARIA です。いつもありがとうございます。", en: "Thank you for getting in touch with SONARIA." },
  },

  // ── 演奏依頼 ─────────────────────────────────────
  {
    key: "perf_confirm",
    title: { ja: "依頼内容の確認", en: "Confirm the request" },
    kinds: ["performance_quote"],
    purposes: ["first_reply"],
    order: 20,
    when: { has: ["requested_date", "ensemble"] },
    text: { ja: "{requested_date}、{ensemble}での演奏のご依頼として承りました。", en: "We have noted your request for a {ensemble} performance on {requested_date}." },
  },
  {
    key: "perf_confirm_ensemble_only",
    title: { ja: "依頼内容の確認（日程未定）", en: "Confirm the request (date undecided)" },
    kinds: ["performance_quote"],
    purposes: ["first_reply"],
    order: 20,
    when: { has: ["ensemble"], missing: ["requested_date"] },
    text: { ja: "{ensemble}での演奏のご依頼として承りました。", en: "We have noted your request for a {ensemble} performance." },
  },
  {
    key: "perf_ask_date",
    title: { ja: "日程の質問", en: "Ask about the date" },
    kinds: ["performance_quote"],
    purposes: ["first_reply"],
    order: 30,
    when: { has: ["schedule_undecided"] },
    text: { ja: "日程が決まりましたら、候補日をお知らせください。空き状況を確認いたします。", en: "Once you have a date in mind, please let us know and we will check our availability." },
  },
  {
    key: "perf_ask_budget",
    title: { ja: "ご予算の質問", en: "Ask about the budget" },
    kinds: ["performance_quote"],
    purposes: ["first_reply"],
    order: 31,
    when: { has: ["budget_undecided"] },
    text: { ja: "お見積もりの参考にしたいので、おおよそのご予算があれば教えてください。", en: "If you have a rough budget in mind, it would help us prepare your quote." },
  },
  {
    key: "perf_next_quote",
    title: { ja: "見積の案内", en: "Next step: quote" },
    kinds: ["performance_quote"],
    purposes: ["first_reply"],
    order: 40,
    text: { ja: "内容を確認のうえ、お見積もりをお送りします。", en: "We will review the details and send you a quote." },
  },
  {
    key: "quote_amount",
    title: { ja: "見積金額", en: "Quote amount" },
    kinds: ALL_PAID,
    purposes: ["quote"],
    order: 20,
    text: { ja: "お見積もりは {quote_amount} です。", en: "Our quote is {quote_amount}." },
  },
  {
    key: "quote_deadline",
    title: { ja: "納期・実施日", en: "Delivery or date" },
    kinds: ["bowing", "recording"],
    purposes: ["quote"],
    order: 21,
    text: { ja: "納品は {deadline} を予定しています。", en: "We expect to deliver by {deadline}." },
  },
  {
    key: "quote_ask_ok",
    title: { ja: "承諾の確認", en: "Ask for approval" },
    kinds: ALL_PAID,
    purposes: ["quote"],
    order: 40,
    text: { ja: "この内容でよろしければ、このメールにご返信ください。正式なご予約（ご依頼）として承ります。", en: "If this works for you, please reply to this email and we will confirm your booking." },
  },
  {
    key: "perf_booking",
    title: { ja: "予約確定", en: "Booking confirmed" },
    kinds: ["performance_quote", "lesson"],
    purposes: ["booking"],
    order: 20,
    text: { ja: "{booking_datetime} でご予約を確定しました。当日はどうぞよろしくお願いします。", en: "Your booking for {booking_datetime} is confirmed. We look forward to it." },
  },
  {
    key: "perf_thanks",
    title: { ja: "終了後のお礼", en: "Thanks after the event" },
    kinds: ["performance_quote"],
    purposes: ["thanks"],
    order: 20,
    text: { ja: "先日はご依頼いただき、ありがとうございました。またの機会がありましたら、お気軽にご相談ください。", en: "Thank you for having us. Please feel free to contact us again any time." },
  },

  // ── レッスン ─────────────────────────────────────
  {
    key: "lesson_candidates",
    title: { ja: "希望日時の確認", en: "Confirm preferred times" },
    kinds: ["lesson"],
    purposes: ["first_reply"],
    order: 20,
    when: { has: ["candidates"] },
    text: { ja: "{plan}のご希望として、次の候補日時を承りました。\n{candidates}", en: "We received your request for {plan} with these preferred times:\n{candidates}" },
  },
  {
    key: "lesson_next",
    title: { ja: "日程確定の案内", en: "Next step: confirm a time" },
    kinds: ["lesson"],
    purposes: ["first_reply"],
    order: 30,
    text: { ja: "空き状況を確認し、確定した日時を改めてご連絡します。", en: "We will check availability and get back to you with a confirmed time." },
  },
  {
    key: "lesson_price",
    title: { ja: "料金の案内", en: "Fee" },
    kinds: ["lesson"],
    purposes: ["first_reply", "booking"],
    order: 35,
    optional: true,
    when: { has: ["service_price"] },
    text: { ja: "料金は {service_price} です。", en: "The fee is {service_price}." },
  },
  {
    key: "lesson_reschedule",
    title: { ja: "日程変更", en: "Reschedule" },
    kinds: ["lesson", "performance_quote"],
    purposes: ["reschedule"],
    order: 20,
    text: { ja: "日程を {booking_datetime} に変更しました。ご確認をお願いします。", en: "We have changed the time to {booking_datetime}. Please let us know if this works for you." },
  },

  // ── 運指・運弓付け ─────────────────────────────────
  {
    key: "bowing_confirm",
    title: { ja: "依頼内容の確認", en: "Confirm the request" },
    kinds: ["bowing"],
    purposes: ["first_reply"],
    order: 20,
    when: { has: ["work_type"] },
    text: { ja: "{work_type}（{pages}）のご依頼として承りました。", en: "We have noted your request for {work_type} ({pages})." },
  },
  {
    key: "bowing_score",
    title: { ja: "楽譜のお願い", en: "Ask for the score" },
    kinds: ["bowing"],
    purposes: ["first_reply"],
    order: 30,
    text: { ja: "作業する楽譜（PDF か写真）を、このメールに添付してお送りください。楽譜が届いた日から作業を始めます。", en: "Please reply with the score attached (PDF or photos). We start work on the day we receive it." },
  },
  {
    key: "bowing_range",
    title: { ja: "作業範囲の確認", en: "Confirm the scope" },
    kinds: ["bowing"],
    purposes: ["first_reply"],
    order: 31,
    optional: true,
    text: { ja: "作業してほしい範囲（全曲・一部の楽章など）があれば、あわせてお知らせください。", en: "If you only need part of the piece (certain movements, for example), please let us know." },
  },

  // ── 録音 ───────────────────────────────────────
  {
    key: "rec_confirm",
    title: { ja: "依頼内容の確認", en: "Confirm the request" },
    kinds: ["recording"],
    purposes: ["first_reply"],
    order: 20,
    when: { has: ["tracks"] },
    text: { ja: "{tracks}の録音のご依頼として承りました。", en: "We have noted your recording request: {tracks}." },
  },
  {
    key: "rec_materials",
    title: { ja: "楽譜・音源のお願い", en: "Ask for materials" },
    kinds: ["recording"],
    purposes: ["first_reply"],
    order: 30,
    text: { ja: "楽譜と、合わせる音源（ガイドやオケ）があれば、このメールに添付してお送りください。テンポやキーの指定もあわせてお知らせください。", en: "Please send the score and any guide or backing track you would like us to play along with, and let us know the tempo and key." },
  },

  // ── 納品・修正（運指運弓・録音） ──────────────────────
  {
    key: "delivery",
    title: { ja: "納品", en: "Delivery" },
    kinds: ["bowing", "recording"],
    purposes: ["delivery"],
    order: 20,
    text: { ja: "お待たせしました。完成したファイルをお送りします。気になる点があれば、お気軽にお知らせください。", en: "Your files are ready and attached. If anything needs adjusting, just let us know." },
  },
  {
    key: "revision",
    title: { ja: "修正の受付", en: "Revision" },
    kinds: ["bowing", "recording"],
    purposes: ["revision"],
    order: 20,
    text: { ja: "修正のご依頼を承りました。対応して、改めてお送りします。", en: "We have received your revision request and will send the updated files soon." },
  },

  // ── 共通（フォロー・入金・キャンセル・お断り） ─────────────
  {
    key: "follow_up",
    title: { ja: "返信の催促", en: "Follow-up" },
    kinds: ALL_PAID,
    purposes: ["follow_up"],
    order: 20,
    text: { ja: "先日お送りしたメールについて、その後いかがでしょうか。ご不明な点があれば、お気軽にご質問ください。", en: "We wanted to follow up on our previous email. Please let us know if you have any questions." },
  },
  {
    key: "payment_thanks",
    title: { ja: "入金のお礼", en: "Payment received" },
    kinds: ALL_PAID,
    purposes: ["payment_thanks"],
    order: 20,
    text: { ja: "ご入金を確認しました。ありがとうございます。", en: "We have received your payment. Thank you." },
  },
  {
    key: "cancel",
    title: { ja: "キャンセルの受付", en: "Cancellation" },
    kinds: ALL_PAID,
    purposes: ["cancel"],
    order: 20,
    text: { ja: "キャンセルを承りました。またの機会がありましたら、お気軽にご相談ください。", en: "We have cancelled your booking. Please feel free to contact us again in the future." },
  },
  {
    key: "decline",
    title: { ja: "お断り", en: "Decline" },
    kinds: ALL_PAID,
    purposes: ["decline"],
    order: 20,
    text: { ja: "せっかくご依頼いただいたのですが、今回はお受けすることができません。申し訳ありません。またの機会がありましたら、ぜひご相談ください。", en: "Unfortunately we are unable to take on this request. We are sorry, and hope we can help another time." },
  },

  // ── 講師登録 ─────────────────────────────────────
  {
    key: "teacher_received",
    title: { ja: "申請受付", en: "Application received" },
    kinds: ["teacher_application"],
    purposes: ["received"],
    order: 10,
    text: { ja: "SONARIA の講師登録にお申し込みいただき、ありがとうございます。いただいた内容を確認し、審査の結果をご連絡します。", en: "Thank you for applying to be listed as a teacher on SONARIA. We will review your application and let you know the outcome." },
  },
  {
    key: "teacher_school",
    title: { ja: "音大在学・卒業の確認", en: "Confirm music college" },
    kinds: ["teacher_application"],
    purposes: ["received", "request_info"],
    order: 20,
    optional: true,
    text: {
      ja: "審査のため、音楽大学の在学または卒業が分かるもの（学生証・卒業証書など。個人番号などは隠してください）の写真を、このメールに添付してお送りください。確認後に削除し、公開することはありません。",
      en: "For our review, please reply with a photo of a document showing your enrolment at or graduation from a music college (student ID or diploma; please cover any ID numbers). We delete it after checking and never publish it.",
    },
  },
  {
    key: "teacher_request_info",
    title: { ja: "不足情報のお願い", en: "Ask for more information" },
    kinds: ["teacher_application"],
    purposes: ["request_info"],
    order: 21,
    text: { ja: "申請の内容について、いくつか確認させてください。", en: "We have a few questions about your application." },
  },
  {
    key: "teacher_approved",
    title: { ja: "掲載承認", en: "Approved" },
    kinds: ["teacher_application"],
    purposes: ["approved"],
    order: 20,
    text: { ja: "審査が終わり、SONARIA の講師一覧にプロフィールを掲載しました。内容の変更があれば、このメールにご返信ください。", en: "Your application has been approved and your profile is now listed on SONARIA. If you need to change anything, just reply to this email." },
  },
  {
    key: "teacher_rejected",
    title: { ja: "掲載見送り", en: "Not approved" },
    kinds: ["teacher_application"],
    purposes: ["rejected"],
    order: 20,
    text: { ja: "慎重に検討しましたが、今回は掲載を見送らせていただくことになりました。ご理解いただけますと幸いです。", en: "After careful consideration, we are unable to list your profile at this time. Thank you for your understanding." },
  },

  // ── 締め・署名（共通） ─────────────────────────────
  { key: "closing", title: { ja: "締めのあいさつ", en: "Closing" }, kinds: "all", purposes: Object.keys(subjects) as Purpose[], order: 90, text: { ja: "どうぞよろしくお願いいたします。", en: "Best regards," } },
  { key: "signature", title: { ja: "署名", en: "Signature" }, kinds: "all", purposes: Object.keys(subjects) as Purpose[], order: 99, text: { ja: "SONARIA（ソナリア）\n受付番号: {case_number}", en: "SONARIA\nReference: {case_number}" } },
];

// ───────────────────────── 組み立て ─────────────────────────

export type BuildInput = {
  kind: SubmissionKind;
  purpose: Purpose;
  locale: Locale; // 返信の言語（お客さんの言語）
  facts: Facts;
  inputs?: Partial<Record<InputKey, string>>;
  /** 運営者が選び直した部品（指定がなければ自動で選ぶ） */
  selected?: string[];
};

export type BuildResult = {
  subject: string;
  body: string;
  /** 画面のチェック欄用。この目的で使える部品と、選ばれているか */
  available: { key: string; title: string; selected: boolean; auto: boolean }[];
  /** 値が足りない差し込み（例: quote_amount） */
  missing: string[];
  /** この目的の部品が使う、運営者の入力欄（使わない欄は画面に出さない） */
  inputs: InputKey[];
};

const VAR = /\{([a-z_]+)\}/g;

function applies(b: Block, kind: SubmissionKind, purpose: Purpose) {
  return (b.kinds === "all" || b.kinds.includes(kind)) && b.purposes.includes(purpose);
}

/** 自動で選ぶかどうか（条件に合い、任意の部品でない） */
function autoSelect(b: Block, values: Facts) {
  if (b.optional) return false;
  if (b.when?.has?.some((k) => !values[k])) return false;
  if (b.when?.missing?.some((k) => values[k])) return false;
  return true;
}

export function fill(template: string, values: Facts, missing: Set<string>, locale: Locale): string {
  return template.replace(VAR, (_, name: string) => {
    const v = values[name];
    if (v && v.trim()) return v;
    missing.add(name);
    return locale === "ja" ? `【要入力: ${name}】` : `[TODO: ${name}]`;
  });
}

export function buildReply(input: BuildInput): BuildResult {
  const { kind, purpose, locale, facts } = input;
  if (!purposesByKind[kind].includes(purpose)) throw new Error(`purpose ${purpose} is not available for ${kind}`);
  const values: Facts = { ...facts };
  for (const [k, v] of Object.entries(input.inputs ?? {})) if (v && v.trim()) values[k] = v.trim();

  const candidates = blocks.filter((b) => applies(b, kind, purpose)).sort((a, b) => a.order - b.order);
  const auto = new Set(candidates.filter((b) => autoSelect(b, values)).map((b) => b.key));
  const chosen = new Set(input.selected ?? auto);

  const missing = new Set<string>();
  const body = candidates
    .filter((b) => chosen.has(b.key))
    .map((b) => fill(b.text[locale], values, missing, locale))
    .join("\n\n");
  const subject = fill(subjects[purpose][locale], values, missing, locale);

  const used = new Set<string>();
  for (const b of candidates) for (const m of b.text[locale].matchAll(VAR)) used.add(m[1]);
  const inputKeys = (inputsByPurpose[purpose] ?? []).filter((k) => used.has(k));

  return {
    subject,
    body,
    inputs: inputKeys,
    available: candidates.map((b) => ({ key: b.key, title: b.title[locale], selected: chosen.has(b.key), auto: auto.has(b.key) })),
    missing: [...missing],
  };
}

/** mailto: のリンク（宛先・件名・本文を安全にエンコードする）。メールアプリが開くことや送信完了は保証しない */
export function mailtoLink(to: string, subject: string, body: string): string {
  const enc = (s: string) => encodeURIComponent(s.replace(/\r?\n/g, "\r\n"));
  return `mailto:${encodeURIComponent(to).replace(/%40/g, "@")}?subject=${enc(subject)}&body=${enc(body)}`;
}
