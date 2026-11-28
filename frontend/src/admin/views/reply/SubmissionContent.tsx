"use client";

import { useMemo, useState } from "react";
import { useAdmin } from "../../AdminContext";
import { describeSubmission, type RawSubmission } from "../../replies/describe";
import { Card } from "../../ui";

// お客さんが送った内容。「整理して表示」と「送信時の原文」を切り替える（原文は変更しない）
export default function SubmissionContent({ raw }: { raw: RawSubmission }) {
  const { t, locale } = useAdmin();
  const [view, setView] = useState<"tidy" | "raw">("tidy");
  const { sections } = useMemo(() => describeSubmission(raw, locale), [raw, locale]);

  const tab = (v: "tidy" | "raw", label: string) => (
    <button
      type="button"
      aria-pressed={view === v}
      onClick={() => setView(v)}
      className={`rounded-full border px-3 py-1 text-[13px] ${view === v ? "border-navy bg-navy text-white" : "border-line bg-card text-ink hover:bg-subtle"}`}
    >
      {label}
    </button>
  );

  return (
    <Card title={t.reply.contentTitle} id="d-request">
      <div className="mb-3 flex gap-2" role="group" aria-label={t.reply.contentTitle}>
        {tab("tidy", t.reply.viewTidy)}
        {tab("raw", t.reply.viewRaw)}
      </div>
      {view === "tidy" ? (
        <div className="grid gap-4">
          {sections.map((sec) => (
            <section key={sec.title}>
              <h3 className="mb-1 text-[12px] font-semibold text-muted">{sec.title}</h3>
              <dl className="grid text-[14px]">
                {sec.rows.map((r, i) => (
                  <div key={`${r.label}-${i}`} className="grid gap-1 border-b border-line py-2 last:border-0 sm:grid-cols-[140px_1fr]">
                    <dt className="text-muted">{r.label}</dt>
                    <dd className={`whitespace-pre-wrap break-words ${r.empty ? "text-muted" : ""}`}>{r.value}</dd>
                  </div>
                ))}
              </dl>
            </section>
          ))}
        </div>
      ) : (
        <div>
          <p className="mb-2 text-[12px] text-muted">
            {t.reply.rawNote} {raw.receiptNo}・{raw.receivedAt}
          </p>
          <pre className="max-h-[50vh] overflow-auto whitespace-pre-wrap break-words rounded-control border border-line bg-paper p-3 text-[12px] leading-relaxed">{JSON.stringify(raw.payload, null, 2)}</pre>
        </div>
      )}
    </Card>
  );
}
