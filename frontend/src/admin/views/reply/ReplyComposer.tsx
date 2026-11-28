"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAdmin } from "../../AdminContext";
import { describeSubmission } from "../../replies/describe";
import { buildReply, mailtoLink, purposesByKind, type InputKey, type Purpose } from "../../replies/engine";
import type { Inquiry } from "../../types";
import { buttonPrimary, buttonSecondary, Card, Field, inputClass } from "../../ui";

type Props = { inq: Inquiry & { raw: NonNullable<Inquiry["raw"]> }; onRecorded: () => void };

// 「送りましたか？」の確認を、メールアプリから戻ったときにも出せるよう、案件ごとに覚えておく
const pendingKey = (id: string) => `sonaria-admin-pending-send-${id}`;

// 運営者が入力した値を、返信の言語に合わせた表示に直す（金額・日時は自動で入れない）
function formatInputs(inputs: Partial<Record<InputKey, string>>, lang: "ja" | "en"): Partial<Record<InputKey, string>> {
  const loc = lang === "ja" ? "ja-JP" : "en-US";
  const out: Partial<Record<InputKey, string>> = {};
  const amount = Number(inputs.quote_amount);
  if (inputs.quote_amount && Number.isFinite(amount) && amount >= 0) out.quote_amount = new Intl.NumberFormat(loc, { style: "currency", currency: "JPY", maximumFractionDigits: 0 }).format(amount);
  if (inputs.deadline) out.deadline = new Intl.DateTimeFormat(loc, { timeZone: "Asia/Tokyo", year: "numeric", month: "long", day: "numeric", weekday: "short" }).format(new Date(`${inputs.deadline}T00:00:00+09:00`));
  if (inputs.booking_datetime) out.booking_datetime = new Intl.DateTimeFormat(loc, { timeZone: "Asia/Tokyo", year: "numeric", month: "long", day: "numeric", weekday: "short", hour: "2-digit", minute: "2-digit" }).format(new Date(`${inputs.booking_datetime}:00+09:00`));
  return out;
}

export default function ReplyComposer({ inq, onRecorded }: Props) {
  const { t, repo } = useAdmin();
  const raw = inq.raw;
  const purposes = purposesByKind[raw.kind];
  const [purpose, setPurpose] = useState<Purpose>(purposes[0]);
  const [lang, setLang] = useState<"ja" | "en">(raw.locale);
  const [selected, setSelected] = useState<string[] | undefined>(undefined);
  const [inputs, setInputs] = useState<Partial<Record<InputKey, string>>>({});
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [edited, setEdited] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [save, setSave] = useState<{ state: "idle" | "saving" | "saved" | "failed"; at?: string }>({ state: "idle" });
  const [askSent, setAskSent] = useState(false);
  const [copied, setCopied] = useState<"subject" | "body" | null>(null);
  const requestId = useRef<string>("");
  const askRef = useRef<HTMLDivElement>(null);
  // 確認が出たら見える位置まで動かす（スマホで下の方を見ていても気づけるように）
  useEffect(() => {
    if (askSent) askRef.current?.scrollIntoView({ block: "center" });
  }, [askSent]);

  // お客さんの言語で差し込む値を作る（表示の言語とは別）
  const facts = useMemo(() => describeSubmission({ ...raw, locale: lang }, lang).facts, [raw, lang]);
  const built = useMemo(() => buildReply({ kind: raw.kind, purpose, locale: lang, facts, inputs: formatInputs(inputs, lang), selected }), [raw.kind, purpose, lang, facts, inputs, selected]);

  // 保存していた下書きを開く
  useEffect(() => {
    let alive = true;
    (async () => {
      const d = repo ? await repo.getReplyDraft(inq.id).catch(() => null) : null;
      if (!alive) return;
      if (d && (purposes as string[]).includes(d.purpose)) {
        setPurpose(d.purpose as Purpose);
        setLang(d.locale);
        setSelected(d.selected.length ? d.selected : undefined);
        setInputs(d.inputs);
        setSubject(d.subject);
        setBody(d.body);
        setEdited(true);
        setNotice(t.reply.restored);
      }
      try {
        if (sessionStorage.getItem(pendingKey(inq.id))) setAskSent(true);
      } catch {
        // 何もしない
      }
      setLoaded(true);
    })();
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inq.id, repo]);

  // 手で直していない間は、目的・部品・入力値に合わせて本文を組み立て直す
  useEffect(() => {
    if (!loaded || edited) return;
    setSubject(built.subject);
    setBody(built.body);
  }, [built, edited, loaded]);

  // 自動保存（変更から 1.2 秒後）
  const firstSave = useRef(true);
  useEffect(() => {
    if (!loaded || !repo) return;
    if (firstSave.current) {
      firstSave.current = false;
      return;
    }
    setSave({ state: "saving" });
    const timer = setTimeout(async () => {
      try {
        await repo.saveReplyDraft(inq.id, { purpose, locale: lang, selected: selected ?? [], inputs: inputs as Record<string, string>, subject, body });
        setSave({ state: "saved", at: new Date().toLocaleTimeString("ja-JP", { hour: "2-digit", minute: "2-digit" }) });
      } catch {
        setSave({ state: "failed" });
      }
    }, 1200);
    return () => clearTimeout(timer);
  }, [purpose, lang, selected, inputs, subject, body, loaded, repo, inq.id]);

  // メールアプリから戻ってきたら「送りましたか？」を出す
  useEffect(() => {
    const onVisible = () => {
      try {
        if (document.visibilityState === "visible" && sessionStorage.getItem(pendingKey(inq.id))) setAskSent(true);
      } catch {
        // 何もしない
      }
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [inq.id]);

  const markPending = () => {
    requestId.current = requestId.current || crypto.randomUUID();
    try {
      sessionStorage.setItem(pendingKey(inq.id), requestId.current);
    } catch {
      // 何もしない
    }
  };
  const clearPending = () => {
    try {
      sessionStorage.removeItem(pendingKey(inq.id));
    } catch {
      // 何もしない
    }
  };

  const recordSent = useCallback(async () => {
    if (!repo) return;
    let rid = requestId.current;
    try {
      rid = sessionStorage.getItem(pendingKey(inq.id)) || rid;
    } catch {
      // 何もしない
    }
    rid = rid || crypto.randomUUID();
    // 実際の送信日時は分からないので occurredAt は空（記録した日時だけを残す）
    await repo.addActivity(inq.id, { kind: "reply_sent", requestId: rid, data: { purpose, locale: lang, subject, body, to: inq.requester.email } });
    clearPending();
    requestId.current = "";
    setAskSent(false);
    setEdited(false);
    setSelected(undefined);
    setInputs({});
    setNotice(t.reply.sentSaved);
    onRecorded();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [repo, inq.id, purpose, lang, subject, body, inq.requester.email, onRecorded, t]);

  const copy = async (what: "subject" | "body") => {
    try {
      await navigator.clipboard.writeText(what === "subject" ? subject : body);
      setCopied(what);
      setTimeout(() => setCopied(null), 1500);
    } catch {
      // クリップボードが使えない環境では、テキスト欄から手で選んでコピーする
    }
  };

  const toggleBlock = (key: string) => {
    const current = new Set(built.available.filter((a) => a.selected).map((a) => a.key));
    if (current.has(key)) current.delete(key);
    else current.add(key);
    setSelected(built.available.map((a) => a.key).filter((k) => current.has(k)));
  };

  const neededInputs = built.inputs;
  const missing = built.missing.map((m) => t.reply.missingNames[m] ?? m);

  return (
    <Card title={t.reply.title} id="d-reply">
      {askSent && (
        <div ref={askRef} role="alertdialog" aria-labelledby="ask-sent-title" className="mb-4 rounded-card border border-navy bg-subtle p-4">
          <p id="ask-sent-title" className="text-[15px] font-bold">
            {t.reply.askSent}
          </p>
          <p className="mt-1 text-[12px] text-muted">{t.reply.askSentNote}</p>
          <div className="mt-3 flex gap-2">
            <button type="button" onClick={recordSent} className={`${buttonPrimary} px-6 py-3`}>
              {t.reply.yesSent}
            </button>
            <button
              type="button"
              onClick={() => {
                clearPending();
                setAskSent(false);
              }}
              className={`${buttonSecondary} px-6 py-3`}
            >
              {t.reply.notYet}
            </button>
          </div>
        </div>
      )}
      {notice && (
        <p role="status" className="mb-3 rounded-control border border-[#9fd9a9] bg-[#eefaf0] px-3 py-2 text-[13px]">
          {notice}
        </p>
      )}

      <div className="grid gap-3">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label={t.reply.purpose} htmlFor="r-purpose">
            <select
              id="r-purpose"
              value={purpose}
              onChange={(e) => {
                setPurpose(e.target.value as Purpose);
                setSelected(undefined);
              }}
              className={inputClass}
            >
              {purposes.map((p) => (
                <option key={p} value={p}>
                  {t.reply.purposes[p] ?? p}
                </option>
              ))}
            </select>
          </Field>
          <Field label={t.reply.language} htmlFor="r-lang">
            <select id="r-lang" value={lang} onChange={(e) => setLang(e.target.value as "ja" | "en")} className={inputClass}>
              <option value="ja">{t.reply.languages.ja}</option>
              <option value="en">{t.reply.languages.en}</option>
            </select>
          </Field>
        </div>

        {neededInputs.length > 0 && (
          <div className="grid gap-3 rounded-control border border-line bg-paper p-3 sm:grid-cols-2">
            {neededInputs.map((k) => (
              <Field key={k} label={t.reply.inputs[k]} htmlFor={`r-in-${k}`}>
                <input
                  id={`r-in-${k}`}
                  type={k === "quote_amount" ? "number" : k === "deadline" ? "date" : "datetime-local"}
                  inputMode={k === "quote_amount" ? "numeric" : undefined}
                  min={k === "quote_amount" ? 0 : undefined}
                  step={k === "quote_amount" ? 1000 : undefined}
                  value={inputs[k] ?? ""}
                  onChange={(e) => setInputs((x) => ({ ...x, [k]: e.target.value }))}
                  className={inputClass}
                />
              </Field>
            ))}
            <p className="text-[12px] text-muted sm:col-span-2">{t.reply.inputsNote}</p>
          </div>
        )}

        <details className="rounded-control border border-line p-3" open={false}>
          <summary className="cursor-pointer text-[13px] font-semibold">{t.reply.blocks}</summary>
          <ul className="mt-2 grid gap-1">
            {built.available.map((a) => (
              <li key={a.key}>
                <label className="flex items-center gap-2 text-[14px]">
                  <input type="checkbox" checked={a.selected} onChange={() => toggleBlock(a.key)} className="h-5 w-5" />
                  {a.title}
                </label>
              </li>
            ))}
          </ul>
        </details>

        {missing.length > 0 && (
          <p role="alert" className="rounded-control border border-[#f5cf7a] bg-[#fff8e6] p-3 text-[13px]">
            {t.reply.missing}
            {missing.join("、")}
          </p>
        )}
        {edited && (
          <p className="flex flex-wrap items-center gap-2 text-[12px] text-muted">
            {t.reply.edited}
            <button
              type="button"
              className="text-navy underline"
              onClick={() => {
                if (window.confirm(t.reply.rebuildConfirm)) {
                  setEdited(false);
                  setNotice(null);
                }
              }}
            >
              {t.reply.rebuild}
            </button>
          </p>
        )}

        <Field label={t.reply.subject} htmlFor="r-subject">
          <input
            id="r-subject"
            value={subject}
            onChange={(e) => {
              setSubject(e.target.value);
              setEdited(true);
            }}
            maxLength={300}
            className={inputClass}
          />
        </Field>
        <Field label={t.reply.body} htmlFor="r-body">
          <textarea
            id="r-body"
            rows={14}
            value={body}
            onChange={(e) => {
              setBody(e.target.value);
              setEdited(true);
            }}
            maxLength={20000}
            className={`${inputClass} text-[15px] leading-relaxed`}
          />
        </Field>
        <p className="text-[12px] text-muted" aria-live="polite">
          {save.state === "saving" ? t.reply.autosaving : save.state === "saved" ? t.reply.autosaved(save.at ?? "") : save.state === "failed" ? t.reply.autosaveFailed : ""}
        </p>

        <div className="grid gap-2 sm:grid-cols-2">
          <button type="button" onClick={() => copy("subject")} className={`${buttonSecondary} py-3`}>
            {copied === "subject" ? t.reply.copied : t.reply.copySubject}
          </button>
          <button type="button" onClick={() => copy("body")} className={`${buttonSecondary} py-3`}>
            {copied === "body" ? t.reply.copied : t.reply.copyBody}
          </button>
        </div>
        <a
          id="r-open-mail"
          href={mailtoLink(inq.requester.email, subject, body)}
          onClick={markPending}
          className={`${buttonPrimary} block py-3 text-center text-[15px]`}
        >
          {t.reply.openMail}
        </a>
        <p className="text-[12px] text-muted">{t.reply.openMailNote}</p>
        <button
          type="button"
          onClick={() => {
            markPending();
            setAskSent(true);
          }}
          className="justify-self-start text-[13px] text-navy underline"
        >
          {t.reply.markSent}
        </button>
      </div>
    </Card>
  );
}
