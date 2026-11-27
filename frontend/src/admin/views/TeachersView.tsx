"use client";

import { useEffect, useState } from "react";
import { getDictionary } from "@/data/dictionaries";
import { prefectures } from "@/data/prefectures";
import { useAdmin, useAdminData } from "../AdminContext";
import { fmtDate } from "../i18n";
import { teacherStatuses } from "../repository";
import { teacherTone } from "../theme";
import type { TeacherApplication, TeacherApplicationStatus } from "../types";
import { Badge, buttonDanger, buttonPrimary, buttonSecondary, Card, Field, inputClass, LoadState, PageTitle, Segmented } from "../ui";

// 状態ごとに取れる操作（管理者が承認した講師だけを公開する）
const nextActions: Record<TeacherApplicationStatus, TeacherApplicationStatus[]> = {
  submitted: ["under_review", "rejected"],
  under_review: ["approved", "changes_requested", "rejected"],
  changes_requested: ["under_review", "rejected"],
  approved: ["published", "under_review"],
  published: ["unpublished"],
  unpublished: ["published"],
  rejected: ["under_review"],
};

export default function TeachersView() {
  const { t, locale, repo } = useAdmin();
  const site = getDictionary(locale).teachers; // 楽器・形式の表示名は公開サイトの辞書と共通
  const data = useAdminData((r) => r.listTeacherApplications());
  const [filter, setFilter] = useState<"all" | "pending" | TeacherApplicationStatus>("pending");
  const [selected, setSelected] = useState<string | null>(null);
  const [note, setNote] = useState("");

  const list = (data.data ?? []).filter((a) => (filter === "all" ? true : filter === "pending" ? ["submitted", "under_review", "changes_requested", "approved"].includes(a.status) : a.status === filter));
  const current: TeacherApplication | undefined = (data.data ?? []).find((a) => a.id === selected) ?? list[0];
  useEffect(() => setNote(current?.private.reviewerNote ?? ""), [current?.id, current?.private.reviewerNote]);

  async function act(status: TeacherApplicationStatus) {
    if (!repo || !current) return;
    await repo.setTeacherStatus(current.id, status, note || undefined);
    setSelected(current.id);
    data.reload();
  }

  const label = (s: TeacherApplicationStatus) =>
    ({ under_review: t.teachers.startReview, approved: t.teachers.approve, changes_requested: t.teachers.requestChanges, rejected: t.teachers.reject, published: t.teachers.publish, unpublished: t.teachers.unpublish, submitted: "" })[s];
  const instName = (i: string) => (site.instruments as Record<string, string>)[i] ?? i;
  const formatName = (f: string) => (site.formats as Record<string, string>)[f] ?? f;

  return (
    <>
      <PageTitle title={t.teachers.title} lead={t.teachers.lead} />
      <div className="mb-4 overflow-x-auto">
        <Segmented
          label={t.inquiries.status}
          value={filter}
          onChange={(v) => {
            setFilter(v);
            setSelected(null);
          }}
          options={[
            { value: "pending", label: `${t.teacherStatus.submitted}〜${t.teacherStatus.approved}` },
            { value: "all", label: t.common.all },
            ...teacherStatuses.map((s) => ({ value: s, label: t.teacherStatus[s] })),
          ]}
        />
      </div>
      <LoadState status={data.status === "loading" && !data.data ? "loading" : data.status} empty={list.length === 0} onRetry={data.reload}>
        <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
          <ul className="grid content-start gap-2">
            {list.map((a) => (
              <li key={a.id}>
                <button
                  type="button"
                  onClick={() => setSelected(a.id)}
                  aria-pressed={current?.id === a.id}
                  className={`w-full rounded-card border p-3 text-left ${current?.id === a.id ? "border-navy bg-card" : "border-line bg-card hover:border-muted"}`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate font-semibold">{a.profile.displayName}</span>
                    <Badge tone={teacherTone[a.status]}>{t.teacherStatus[a.status]}</Badge>
                  </div>
                  <p className="mt-1 text-[12px] text-muted">
                    {a.profile.instruments.map(instName).join("・")}・{prefectures.find((p) => p.code === a.profile.prefectureCode)?.[locale]}
                  </p>
                  <p className="text-[11px] text-muted">
                    {t.teachers.submittedAt}: {fmtDate(a.submittedAt, locale)}
                  </p>
                </button>
              </li>
            ))}
          </ul>

          {current && (
            <div className="grid min-w-0 content-start gap-4">
              <Card title={t.teachers.publicInfo} id="t-public" actions={<Badge tone={teacherTone[current.status]}>{t.teacherStatus[current.status]}</Badge>}>
                <dl className="grid gap-0 text-[14px]">
                  {(
                    [
                      [t.teachers.instruments, current.profile.instruments.map(instName).join("、")],
                      [t.teachers.area, `${prefectures.find((p) => p.code === current.profile.prefectureCode)?.[locale] ?? ""} ${current.profile.station ?? ""}`],
                      [t.teachers.education, [current.profile.education.school, current.profile.education.department, current.profile.education.enrollment === "student" ? "在学中 / student" : "卒業 / graduate"].filter(Boolean).join(" / ")],
                      [t.teachers.formats, current.profile.formats.map(formatName).join("、")],
                      [t.teachers.travel, current.profile.travel.available ? `○ ${current.profile.travel.minutes ?? ""}min` : "—"],
                      [t.teachers.links, current.profile.externalLinks.join("\n") || "—"],
                      ["JA", current.profile.intro.ja],
                      ["EN", current.profile.intro.en],
                    ] as [string, string][]
                  ).map(([k, v]) => (
                    <div key={k} className="grid gap-1 border-b border-line py-2 last:border-0 sm:grid-cols-[140px_1fr]">
                      <dt className="text-muted">{k}</dt>
                      <dd className="whitespace-pre-wrap break-words">{v}</dd>
                    </div>
                  ))}
                </dl>
              </Card>
              <Card title={t.teachers.privateInfo} id="t-private">
                <dl className="grid gap-0 text-[14px]">
                  <div className="grid gap-1 border-b border-line py-2 sm:grid-cols-[140px_1fr]">
                    <dt className="text-muted">Name</dt>
                    <dd>{current.private.legalName}</dd>
                  </div>
                  <div className="grid gap-1 border-b border-line py-2 sm:grid-cols-[140px_1fr]">
                    <dt className="text-muted">Email</dt>
                    <dd className="break-all">{current.private.email}</dd>
                  </div>
                  <div className="grid gap-1 py-2 sm:grid-cols-[140px_1fr]">
                    <dt className="text-muted">{t.teachers.verification}</dt>
                    <dd>{current.private.verification}</dd>
                  </div>
                </dl>
              </Card>
              <Card title={t.teachers.actions} id="t-actions">
                <Field label={t.teachers.reviewerNote} htmlFor="t-note">
                  <textarea id="t-note" rows={3} value={note} onChange={(e) => setNote(e.target.value)} className={inputClass} />
                </Field>
                <div className="mt-3 flex flex-wrap gap-2">
                  {nextActions[current.status].map((s) => (
                    <button key={s} type="button" onClick={() => act(s)} className={s === "rejected" || s === "unpublished" ? buttonDanger : s === "approved" || s === "published" ? buttonPrimary : buttonSecondary}>
                      {label(s)}
                    </button>
                  ))}
                </div>
                <p className="mt-3 text-[12px] leading-relaxed text-muted">{t.teachers.publishNote}</p>
              </Card>
            </div>
          )}
        </div>
      </LoadState>
    </>
  );
}
