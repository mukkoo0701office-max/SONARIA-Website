"use client";

import { useAdmin } from "../../AdminContext";
import { fmtDate } from "../../i18n";
import type { CaseActivity, Inquiry } from "../../types";
import { Card } from "../../ui";

// 対応記録（タイムライン）。受付 → 送った返信 …（次の段階で、電話・LINE・見積・入金などの記録も並ぶ）
export default function ActivityTimeline({ inq, activities }: { inq: Inquiry; activities: CaseActivity[] }) {
  const { t, locale } = useAdmin();
  return (
    <Card title={t.reply.timeline} id="d-timeline">
      <ol className="grid gap-3 text-[13px]">
        <li>
          <span className="text-muted">{fmtDate(inq.receivedAt, locale, true)}</span>
          <span className="ml-2 font-semibold">{t.reply.received}</span>
        </li>
        {activities.map((a) => {
          const purpose = typeof a.data.purpose === "string" ? (t.reply.purposes[a.data.purpose] ?? a.data.purpose) : "";
          return (
            <li key={a.id} className="border-t border-line pt-2">
              <span className="text-muted">{fmtDate(a.occurredAt ?? a.recordedAt, locale, true)}</span>
              <span className="ml-2 font-semibold">{a.kind === "reply_sent" ? t.reply.sentReply(purpose) : a.kind}</span>
              {!a.occurredAt && a.kind === "reply_sent" && <span className="block text-[11px] text-muted">{t.reply.occurredUnknown}</span>}
              {typeof a.data.subject === "string" && <span className="block break-words">{a.data.subject}</span>}
              {typeof a.data.body === "string" && (
                <details className="mt-1">
                  <summary className="cursor-pointer text-navy underline">{t.reply.showBody}</summary>
                  <pre className="mt-1 whitespace-pre-wrap break-words rounded-control border border-line bg-paper p-2 font-sans text-[12px] leading-relaxed">{a.data.body}</pre>
                </details>
              )}
            </li>
          );
        })}
      </ol>
      {activities.length === 0 && <p className="mt-2 text-[12px] text-muted">{t.reply.timelineEmpty}</p>}
    </Card>
  );
}
