"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import Tag from "@/components/ui/Tag";
import { getDictionary } from "@/data/dictionaries";
import { findPrefecture } from "@/data/prefectures";
import { pagePaths } from "@/data/site";
import { findTeacher, type Teacher } from "@/data/teachers";
import { localizedPath, type Locale } from "@/lib/i18n";

// 講師の簡易プロフィール（承認済み B案）。
// 静的書き出しのため、URL は /teachers/profile/?id=... とし、id はマウント後に読む。
// TODO: 講師データの公開方式が決まったら /teachers/{id}/ の個別ページにする（仕様 §10「URL 形式は未決定」）
export default function TeacherProfile({ locale }: { locale: Locale }) {
  const dict = getDictionary(locale);
  const t = dict.teacherProfile;
  const tt = dict.teachers;
  const [teacher, setTeacher] = useState<Teacher | null | undefined>(undefined);

  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get("id") ?? "";
    setTeacher(findTeacher(id) ?? null);
  }, []);

  const searchHref = localizedPath(locale, pagePaths.teachers);

  if (teacher === undefined) {
    // 読み込み中（一瞬）
    return <p className="my-10 text-sm text-muted" aria-busy="true" />;
  }

  if (teacher === null) {
    return (
      <div className="my-10">
        <p className="text-sm">{t.notFound}</p>
        <Link href={searchHref} className="mt-4 inline-block text-navy underline">
          {t.backToSearch}
        </Link>
      </div>
    );
  }

  const pref = findPrefecture(teacher.prefectureCode);
  // https:// のリンクだけを表示する（仕様 §6）
  const safeLinks = teacher.externalLinks.filter((l) => l.url.startsWith("https://"));

  return (
    <article className="my-6">
      <nav aria-label={t.breadcrumbLabel} className="text-xs text-muted">
        <ol className="flex flex-wrap gap-1">
          <li>
            <Link href={localizedPath(locale, "/")} className="hover:underline">
              {dict.pages.home}
            </Link>
            <span aria-hidden="true"> / </span>
          </li>
          <li>
            <Link href={searchHref} className="hover:underline">
              {dict.pages.teachers}
            </Link>
            <span aria-hidden="true"> / </span>
          </li>
          <li aria-current="page">{teacher.displayName[locale]}</li>
        </ol>
      </nav>

      {teacher.isDemo && (
        <p role="note" className="mt-4 rounded-button border border-dashed border-gold bg-card p-3 text-[13px] leading-relaxed">
          {tt.demoNotice}
        </p>
      )}

      <h1 className="mt-5 text-2xl font-bold">{teacher.displayName[locale]}</h1>

      <dl className="mt-6 grid gap-5 rounded-card border border-line bg-card p-[17px] text-[13px]">
        <div>
          <dt className="mb-1.5 font-semibold">{t.instruments}</dt>
          <dd className="flex flex-wrap gap-1.5">
            {teacher.instruments.map((i) => (
              <Tag key={i}>{tt.instruments[i]}</Tag>
            ))}
          </dd>
        </div>
        <div>
          <dt className="mb-1.5 font-semibold">{t.area}</dt>
          <dd>
            {pref ? pref[locale] : ""}
            {teacher.station ? ` · ${tt.nearestStation(teacher.station[locale])}` : ""}
            {teacher.travel && <span className="block text-muted">{tt.travel(teacher.travel.minutes)}</span>}
          </dd>
        </div>
        <div>
          <dt className="mb-1.5 font-semibold">{t.formats}</dt>
          <dd className="flex flex-wrap gap-1.5">
            {teacher.formats.map((f) => (
              <Tag key={f}>{tt.formats[f]}</Tag>
            ))}
          </dd>
        </div>
        <div>
          <dt className="mb-1.5 font-semibold">{t.audiences}</dt>
          <dd className="flex flex-wrap gap-1.5">
            {teacher.audiences.map((a) => (
              <Tag key={a}>{tt.audiences[a]}</Tag>
            ))}
          </dd>
        </div>
        <div>
          <dt className="mb-1.5 font-semibold">{t.education}</dt>
          <dd>
            {teacher.education[locale]}
            {!teacher.education.verified && <span className="ml-2 text-muted">— {t.selfDeclared}</span>}
          </dd>
        </div>
        <div>
          <dt className="mb-1.5 font-semibold">{t.intro}</dt>
          <dd className="leading-relaxed">{teacher.intro[locale]}</dd>
        </div>
      </dl>

      <section className="mt-6" aria-labelledby="external-links-heading">
        <h2 id="external-links-heading" className="text-base font-bold">
          {t.externalLinks}
        </h2>
        {safeLinks.length > 0 ? (
          <>
            <p className="mt-1 text-xs text-muted">{t.externalNote}</p>
            <ul className="mt-3 grid gap-2">
              {safeLinks.map((link) => (
                <li key={link.url}>
                  <a
                    href={link.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 rounded-button border border-line bg-card px-4 py-2.5 text-[13px] text-navy hover:bg-paper"
                  >
                    {link.label}
                    <span className="text-[11px] text-muted">· {dict.common.externalSite}</span>
                  </a>
                </li>
              ))}
            </ul>
          </>
        ) : (
          // 外部リンクがないときはボタンを出さない（押せないボタンを置かない）
          <p className="mt-2 text-[13px] text-muted">{t.noExternalLinks}</p>
        )}
      </section>

      <Link href={searchHref} className="mt-8 inline-block text-[13px] text-navy underline">
        {t.backToSearch}
      </Link>
    </article>
  );
}
