"use client";

import { useRef, useState } from "react";
import {
  CheckCards,
  ConsentField,
  FieldError,
  FormReview,
  HoneypotField,
  Opt,
  RadioCards,
  Req,
  TextField,
  copyRows,
  emailPattern,
  inputClass,
  showHeading,
} from "@/components/forms/FormParts";
import { getDictionary } from "@/data/dictionaries";
import { prefectures } from "@/data/prefectures";
import { pagePaths } from "@/data/site";
import { audiences, instrumentCategories, instrumentCategoryOf, lessonFormats, type Audience, type Instrument, type LessonFormat } from "@/data/teachers";
import { jaOrEn, tr, localizedPath, type Locale } from "@/lib/i18n";
import { submitTeacherApplication, withReceipt, type SubmitResult } from "@/lib/orders/submit";

type Step = "edit" | "confirm" | "done";
type Travel = "none" | "30" | "60" | "90";
type AgeGroup = "undisclosed" | "10s" | "20s" | "30s" | "40s" | "50s" | "60plus";
type Gender = "undisclosed" | "female" | "male" | "other";
type Enrollment = "student" | "graduate";
type ErrorKey =
  | "displayName"
  | "nameKana"
  | "nameRomaji"
  | "instruments"
  | "prefecture"
  | "formats"
  | "audiences"
  | "school"
  | "enrollment"
  | "intro"
  | "links"
  | "legalName"
  | "email"
  | "eligibility"
  | "publish"
  | "consent";

const INTRO_MAX = 400;
const LINKS_MAX = 3;
const travels: readonly Travel[] = ["none", "30", "60", "90"];
const ageGroups: readonly AgeGroup[] = ["undisclosed", "10s", "20s", "30s", "40s", "50s", "60plus"];
const genders: readonly Gender[] = ["undisclosed", "female", "male", "other"];
// 楽器はカテゴリ（ピアノ・弦・木管・金管）の順に並べる
const instrumentOrder = (Object.keys(instrumentCategoryOf) as Instrument[]).sort(
  (a, b) => instrumentCategories.indexOf(instrumentCategoryOf[a]) - instrumentCategories.indexOf(instrumentCategoryOf[b]),
);
// 外部リンクは https のみ（CLAUDE.md・講師データの型と同じ条件）
const isHttpsUrl = (v: string) => {
  try {
    return new URL(v).protocol === "https:";
  } catch {
    return false;
  }
};

// 講師登録の申請フォーム（PR #24 §2）。
// - 送信しただけでは掲載しない。管理人が確認・承認した講師だけを src/data/teachers.ts の publishedTeachers に追加する
// - 公開用の情報と、審査用の情報（本名・メール）を分けて表示・送信する
// - レッスン料金の項目は作らない（CLAUDE.md）。確認書類・写真はこのフォームで受け付けない（審査時にメールで案内）
export default function TeacherRegistrationForm({ locale }: { locale: Locale }) {
  const dict = getDictionary(locale);
  const t = dict.teacherRegister;
  const tt = dict.teachers;
  const f = dict.forms;

  const [step, setStep] = useState<Step>("edit");
  const [showErrors, setShowErrors] = useState(false);
  const [result, setResult] = useState<SubmitResult | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [copied, setCopied] = useState(false);

  // 公開されるプロフィール
  const [displayName, setDisplayName] = useState("");
  const [nameKana, setNameKana] = useState("");
  const [nameRomaji, setNameRomaji] = useState("");
  const [instruments, setInstruments] = useState<Instrument[]>([]);
  const [prefecture, setPrefecture] = useState("");
  const [station, setStation] = useState("");
  const [travel, setTravel] = useState<Travel>("none");
  const [formats, setFormats] = useState<LessonFormat[]>([]);
  const [targets, setTargets] = useState<Audience[]>([]);
  const [ageGroup, setAgeGroup] = useState<AgeGroup>("undisclosed");
  const [gender, setGender] = useState<Gender>("undisclosed");
  const [school, setSchool] = useState("");
  const [enrollment, setEnrollment] = useState<Enrollment | null>(null);
  const [department, setDepartment] = useState("");
  const [gradYear, setGradYear] = useState("");
  const [intro, setIntro] = useState("");
  const [links, setLinks] = useState<string[]>(["", "", ""]);

  // 審査用（公開しない）
  const [legalName, setLegalName] = useState("");
  const [email, setEmail] = useState("");
  const [eligibility, setEligibility] = useState(false);
  const [publish, setPublish] = useState(false);
  const [consent, setConsent] = useState(false);
  const [trap, setTrap] = useState(""); // ハニーポット

  const headingRef = useRef<HTMLHeadingElement>(null);

  const filledLinks = links.map((l) => l.trim()).filter(Boolean);
  const errors: Partial<Record<ErrorKey, string>> = {};
  if (!displayName.trim()) errors.displayName = t.errors.displayName;
  if (!nameKana.trim()) errors.nameKana = t.errors.nameKana;
  if (!nameRomaji.trim()) errors.nameRomaji = t.errors.nameRomaji;
  if (instruments.length === 0) errors.instruments = t.errors.instruments;
  if (!prefecture) errors.prefecture = t.errors.prefecture;
  if (formats.length === 0) errors.formats = t.errors.formats;
  if (targets.length === 0) errors.audiences = t.errors.audiences;
  if (!school.trim()) errors.school = t.errors.school;
  if (!enrollment) errors.enrollment = t.errors.enrollment;
  if (!intro.trim()) errors.intro = t.errors.intro;
  if (filledLinks.some((l) => !isHttpsUrl(l))) errors.links = t.errors.links;
  if (!legalName.trim()) errors.legalName = t.errors.legalName;
  if (!emailPattern.test(email.trim())) errors.email = f.errors.email;
  if (!eligibility) errors.eligibility = t.errors.eligibility;
  if (!publish) errors.publish = t.errors.publish;
  if (!consent) errors.consent = f.errors.consent;
  const hasErrors = Object.keys(errors).length > 0;
  const err = (k: ErrorKey) => showErrors && errors[k];
  const labels = { required: f.required, optional: f.optional };
  const paren = (a: string, b: string) => (locale === "ja" ? `${a}（${b}）` : `${a} (${b})`);
  const prefName = (code: string) => tr(prefectures.find((p) => p.code === code), locale);

  function rows(): [string, string][] {
    return [
      [t.displayName, displayName.trim()],
      [t.nameKana, nameKana.trim()],
      [t.nameRomaji, nameRomaji.trim()],
      [t.instruments, instruments.map((i) => tt.instruments[i]).join(locale === "ja" ? "、" : ", ")],
      [t.prefecture, prefName(prefecture)],
      [t.station, station.trim() || "—"],
      [t.travel, t.travelOptions[travel]],
      [t.formats, formats.map((v) => tt.formats[v]).join(locale === "ja" ? "、" : ", ")],
      [t.audiences, targets.map((v) => tt.audiences[v]).join(locale === "ja" ? "、" : ", ")],
      [t.ageGroup, t.ageGroupOptions[ageGroup]],
      [t.gender, t.genderOptions[gender]],
      [t.school, [school.trim(), enrollment ? t.enrollmentOptions[enrollment] : "", department.trim(), gradYear.trim()].filter(Boolean).join(" / ")],
      [t.intro, intro.trim()],
      [t.links, filledLinks.join("\n") || "—"],
      [paren(t.legalName, t.privateHeading), legalName.trim()],
      [paren(f.email, t.privateHeading), email.trim()],
    ];
  }

  function payload() {
    return {
      kind: "teacher_application",
      // 受付関数・DB は返信言語として ja / en だけを受け付ける。欧州 4 言語のページからは en で送り、表示していた言語は pageLocale に残す
      locale: jaOrEn(locale),
      pageLocale: locale,
      // 公開用（承認後に講師データへ転記する候補）
      public: {
        displayName: displayName.trim(),
        nameKana: nameKana.trim(),
        nameRomaji: nameRomaji.trim(),
        instruments,
        prefectureCode: prefecture,
        station: station.trim(),
        travelMinutes: travel === "none" ? null : Number(travel),
        formats,
        audiences: targets,
        ageGroup,
        gender,
        education: { school: school.trim(), enrollment, department: department.trim(), gradYear: gradYear.trim() },
        intro: intro.trim(),
        externalLinks: filledLinks,
      },
      // 審査用（公開しない）
      private: { legalName: legalName.trim(), email: email.trim() },
      agreements: { eligibility, publish, privacy: consent },
      status: "submitted", // submitted → under_review → approved → published（管理人が更新する）
    };
  }

  function goReview(event: React.FormEvent) {
    event.preventDefault();
    if (hasErrors) {
      setShowErrors(true);
      requestAnimationFrame(() => document.querySelector<HTMLElement>("[aria-invalid='true'], [data-error='true']")?.scrollIntoView({ block: "center" }));
      return;
    }
    setStep("confirm");
    requestAnimationFrame(() => showHeading(headingRef.current));
  }

  async function handleSubmit() {
    setSubmitting(true);
    // ハニーポットに入力があれば自動投稿とみなし、送らない
    const r: SubmitResult = trap ? { status: "error", message: "rejected" } : await submitTeacherApplication(payload());
    setSubmitting(false);
    setResult(r);
    setStep("done");
    requestAnimationFrame(() => showHeading(headingRef.current));
  }

  if (step !== "edit") {
    const title = step === "confirm" ? t.confirm.heading : result?.status === "sent" ? t.result.sentTitle : result?.status === "error" ? f.result.errorTitle : f.result.notConnectedTitle;
    const body = step === "confirm" ? t.confirm.lead : result?.status === "sent" ? withReceipt(t.result.sentBody, result, f.result.receiptNote) : result?.status === "error" ? f.result.errorBody : f.result.notConnectedBody;
    return (
      <FormReview
        step={step}
        title={title}
        body={body}
        warn={step === "done" && result?.status !== "sent"}
        rows={rows()}
        note={t.note}
        labels={{ submit: t.submit, submitting: f.submitting, back: f.back, copy: f.copy, copied: f.copied }}
        submitting={submitting}
        copied={copied}
        showCopy={result?.status !== "sent"}
        headingRef={headingRef}
        onSubmit={handleSubmit}
        onBack={() => {
          setStep("edit");
          setResult(null);
          setCopied(false);
        }}
        onCopy={async () => setCopied(await copyRows(rows()))}
      />
    );
  }

  return (
    <form onSubmit={goReview} noValidate className="relative grid gap-6">
      <HoneypotField value={trap} onChange={setTrap} label={f.honeypot} />

      {/* 公開されるプロフィール */}
      <section className="grid min-w-0 gap-5 rounded-card border border-line bg-card p-5 sm:p-6">
        <div>
          <h2 className="text-lg font-bold">{t.publicHeading}</h2>
          <p className="mt-1 text-[13px] text-muted">{t.publicHelp}</p>
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          <TextField id="tr-display" label={t.displayName} value={displayName} onChange={setDisplayName} required labels={labels} error={err("displayName")} placeholder={t.displayNamePlaceholder} maxLength={60} />
          <TextField id="tr-kana" label={t.nameKana} value={nameKana} onChange={setNameKana} required labels={labels} error={err("nameKana")} placeholder={t.nameKanaPlaceholder} maxLength={60} />
          <TextField id="tr-romaji" label={t.nameRomaji} value={nameRomaji} onChange={setNameRomaji} required labels={labels} error={err("nameRomaji")} placeholder={t.nameRomajiPlaceholder} maxLength={60} />
        </div>

        <CheckCards
          name="tr-instruments"
          legend={t.instruments}
          help={t.instrumentsHelp}
          options={instrumentOrder.map((i) => ({ value: i, label: tt.instruments[i] }))}
          values={instruments}
          onChange={setInstruments}
          labels={labels}
          required
          error={err("instruments")}
          columns="grid-cols-2 sm:grid-cols-4 lg:grid-cols-5"
        />

        <div className="grid gap-4 sm:grid-cols-3">
          <div className="min-w-0">
            <label htmlFor="tr-pref" className="text-[14px] font-bold">
              {t.prefecture} <Req t={f.required} />
            </label>
            <select id="tr-pref" value={prefecture} onChange={(e) => setPrefecture(e.target.value)} aria-invalid={!!err("prefecture")} aria-describedby={err("prefecture") ? "err-tr-pref" : undefined} className={`${inputClass} mt-2`}>
              <option value="">{t.prefectureSelect}</option>
              {prefectures.map((p) => (
                <option key={p.code} value={p.code}>
                  {tr(p, locale)}
                </option>
              ))}
            </select>
            <FieldError id="err-tr-pref" text={err("prefecture")} />
          </div>
          <TextField id="tr-station" label={t.station} value={station} onChange={setStation} labels={labels} placeholder={t.stationPlaceholder} maxLength={60} />
          <div className="min-w-0">
            <label htmlFor="tr-travel" className="text-[14px] font-bold">
              {t.travel} <Opt t={f.optional} />
            </label>
            <select id="tr-travel" value={travel} onChange={(e) => setTravel(e.target.value as Travel)} className={`${inputClass} mt-2`}>
              {travels.map((v) => (
                <option key={v} value={v}>
                  {t.travelOptions[v]}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid gap-5 lg:grid-cols-2">
          <CheckCards name="tr-formats" legend={t.formats} options={lessonFormats.map((v) => ({ value: v, label: tt.formats[v] }))} values={formats} onChange={setFormats} labels={labels} required error={err("formats")} columns="grid-cols-1 sm:grid-cols-3" />
          <CheckCards name="tr-audiences" legend={t.audiences} options={audiences.map((v) => ({ value: v, label: tt.audiences[v] }))} values={targets} onChange={setTargets} labels={labels} required error={err("audiences")} columns="grid-cols-2" />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="min-w-0">
            <label htmlFor="tr-age" className="text-[14px] font-bold">
              {t.ageGroup} <Opt t={f.optional} />
            </label>
            <select id="tr-age" value={ageGroup} onChange={(e) => setAgeGroup(e.target.value as AgeGroup)} className={`${inputClass} mt-2`}>
              {ageGroups.map((v) => (
                <option key={v} value={v}>
                  {t.ageGroupOptions[v]}
                </option>
              ))}
            </select>
          </div>
          <div className="min-w-0">
            <label htmlFor="tr-gender" className="text-[14px] font-bold">
              {t.gender} <Opt t={f.optional} />
            </label>
            <select id="tr-gender" value={gender} onChange={(e) => setGender(e.target.value as Gender)} className={`${inputClass} mt-2`}>
              {genders.map((v) => (
                <option key={v} value={v}>
                  {t.genderOptions[v]}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <TextField id="tr-school" label={t.school} value={school} onChange={setSchool} required labels={labels} error={err("school")} placeholder={t.schoolPlaceholder} maxLength={100} />
          <RadioCards
            name="tr-enrollment"
            legend={t.enrollment}
            options={(["student", "graduate"] as const).map((v) => ({ value: v, label: t.enrollmentOptions[v] }))}
            value={enrollment}
            onChange={setEnrollment}
            labels={labels}
            required
            error={err("enrollment")}
            columns="grid-cols-2"
          />
          <TextField id="tr-dept" label={t.department} value={department} onChange={setDepartment} labels={labels} placeholder={t.departmentPlaceholder} maxLength={100} />
          <TextField id="tr-grad" label={t.gradYear} value={gradYear} onChange={setGradYear} labels={labels} placeholder={t.gradYearPlaceholder} maxLength={10} />
        </div>

        <div className="min-w-0">
          <label htmlFor="tr-intro" className="text-[14px] font-bold">
            {t.intro} <Req t={f.required} />
          </label>
          <p className="mt-1 text-[12px] text-muted">{t.introHelp(INTRO_MAX)}</p>
          <textarea
            id="tr-intro"
            rows={4}
            maxLength={INTRO_MAX}
            value={intro}
            onChange={(e) => setIntro(e.target.value)}
            placeholder={t.introPlaceholder}
            aria-invalid={!!err("intro")}
            aria-describedby={err("intro") ? "err-tr-intro" : undefined}
            className={`${inputClass} mt-2`}
          />
          <p className="mt-1 text-right text-[12px] tabular-nums text-muted" aria-live="polite">
            {intro.length} / {INTRO_MAX}
          </p>
          <FieldError id="err-tr-intro" text={err("intro")} />
        </div>

        <fieldset className="min-w-0" data-error={!!err("links") || undefined}>
          <legend className="text-[14px] font-bold">
            {t.links} <Opt t={f.optional} />
          </legend>
          <p className="mt-1 text-[12px] text-muted">{t.linksHelp}</p>
          <div className="mt-2 grid gap-2 sm:grid-cols-3">
            {links.slice(0, LINKS_MAX).map((l, i) => (
              <div key={i}>
                <label htmlFor={`tr-link-${i}`} className="sr-only">
                  {t.linkLabel(i + 1)}
                </label>
                <input
                  id={`tr-link-${i}`}
                  type="url"
                  inputMode="url"
                  value={l}
                  maxLength={300}
                  placeholder="https://"
                  aria-invalid={!!err("links") && !!l.trim() && !isHttpsUrl(l.trim())}
                  onChange={(e) => setLinks((prev) => prev.map((v, j) => (j === i ? e.target.value : v)))}
                  className={inputClass}
                />
              </div>
            ))}
          </div>
          <FieldError id="err-tr-links" text={err("links")} />
        </fieldset>
        <p className="rounded-button bg-paper p-3 text-[12px] leading-relaxed text-muted">{t.photoNote}</p>
      </section>

      {/* 審査用（公開しない） */}
      <section className="grid min-w-0 gap-4 rounded-card border border-line bg-card p-5 sm:grid-cols-2 sm:p-6">
        <div className="sm:col-span-2">
          <h2 className="text-lg font-bold">{t.privateHeading}</h2>
          <p className="mt-1 text-[13px] text-muted">{t.privateHelp}</p>
        </div>
        <TextField id="tr-legal" label={t.legalName} value={legalName} onChange={setLegalName} required labels={labels} error={err("legalName")} help={t.legalNameHelp} autoComplete="name" maxLength={60} />
        <TextField id="tr-email" type="email" label={f.email} value={email} onChange={setEmail} required labels={labels} error={err("email")} help={t.emailHelp} autoComplete="email" />
        <p className="rounded-button bg-paper p-3 text-[12px] leading-relaxed text-muted sm:col-span-2">{t.documentsNote}</p>
        <div className="grid gap-3 sm:col-span-2">
          <ConsentField id="tr-eligibility" checked={eligibility} onChange={setEligibility} text={t.eligibility} error={err("eligibility")} locale={jaOrEn(locale)} />
          <ConsentField id="tr-publish" checked={publish} onChange={setPublish} text={t.publish} error={err("publish")} locale={jaOrEn(locale)} />
          <ConsentField id="tr-consent" checked={consent} onChange={setConsent} text={f.consent} privacyLabel={f.privacyLink} privacyHref={localizedPath(locale, pagePaths.privacy)} error={err("consent")} locale={jaOrEn(locale)} />
        </div>
      </section>

      <div className="grid gap-3 sm:flex sm:items-center">
        <button type="submit" className="rounded-button bg-navy px-6 py-3.5 text-[15px] font-bold text-white hover:brightness-110">
          {t.review}
        </button>
        <p className="text-[12px] leading-relaxed text-muted">{t.note}</p>
      </div>
      {showErrors && hasErrors && (
        <p role="alert" className="rounded-control border border-navy bg-subtle p-3 text-[14px] font-bold">
          {f.fixErrors}
        </p>
      )}
    </form>
  );
}
