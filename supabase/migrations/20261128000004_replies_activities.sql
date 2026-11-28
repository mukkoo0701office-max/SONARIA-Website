-- 返信の下書き（自動保存）と、案件の対応記録（タイムライン）
-- 方針:
--   - 管理人だけが読める・書ける（書き込みは関数を通す）
--   - 対応記録は追記だけ。金額・契約に関わる重要な記録（important）は通常の操作で消せない
--   - 「送った」は運営者の確認で記録する。実際の送信日時が分からないときは occurred_at を空にし、記録日時（recorded_at）と区別する

-- ── 返信の下書き（案件ごとに 1 件。送信を確認したら消す） ─────────────
create table public.reply_drafts (
  submission_id uuid primary key references public.submissions (id) on delete cascade,
  purpose text not null,
  locale text not null check (locale in ('ja', 'en')),
  selected text[] not null default '{}',
  inputs jsonb not null default '{}'::jsonb,
  subject text not null default '' check (char_length(subject) <= 300),
  body text not null default '' check (char_length(body) <= 20000),
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users (id) on delete set null
);
alter table public.reply_drafts enable row level security;
create policy "reply_drafts_admin_read" on public.reply_drafts for select to authenticated using (public.is_admin());
revoke all on public.reply_drafts from public, anon, authenticated;
grant select on public.reply_drafts to authenticated;

create or replace function public.admin_save_reply_draft(p_submission uuid, p_purpose text, p_locale text, p_selected text[], p_inputs jsonb, p_subject text, p_body text)
returns timestamptz
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_at timestamptz := now();
begin
  if not public.is_admin() then
    raise exception 'not_admin' using errcode = '42501';
  end if;
  insert into public.reply_drafts (submission_id, purpose, locale, selected, inputs, subject, body, updated_at, updated_by)
  values (p_submission, p_purpose, p_locale, coalesce(p_selected, '{}'), coalesce(p_inputs, '{}'::jsonb), left(coalesce(p_subject, ''), 300), left(coalesce(p_body, ''), 20000), v_at, auth.uid())
  on conflict (submission_id) do update set
    purpose = excluded.purpose, locale = excluded.locale, selected = excluded.selected, inputs = excluded.inputs,
    subject = excluded.subject, body = excluded.body, updated_at = excluded.updated_at, updated_by = excluded.updated_by;
  return v_at;
end;
$$;
revoke all on function public.admin_save_reply_draft(uuid, text, text, text[], jsonb, text, text) from public, anon;
grant execute on function public.admin_save_reply_draft(uuid, text, text, text[], jsonb, text, text) to authenticated;

-- ── 対応記録（タイムライン） ───────────────────────────────
create table public.case_activities (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid not null references public.submissions (id) on delete cascade,
  kind text not null check (kind in (
    'reply_sent',      -- 返信メールを送った（運営者が確認）
    'email', 'line', 'phone', 'other',            -- 連絡の記録
    'quote_sent', 'quote_changed', 'booked', 'invoiced', 'paid', 'refunded', 'completed', 'cancelled'  -- 金額・契約（重要）
  )),
  occurred_at timestamptz,           -- 実際に起きた日時（分からなければ空）
  recorded_at timestamptz not null default now(),
  recorded_by uuid references auth.users (id) on delete set null,
  note text check (char_length(note) <= 4000),
  amount integer check (amount is null or amount between 0 and 100000000),
  data jsonb not null default '{}'::jsonb,   -- 送った返信の件名・本文など、その時点の内容
  important boolean not null default false,
  request_id uuid not null unique            -- 二重保存の防止（同じ操作の再送は 1 件にまとめる）
);
create index case_activities_submission_idx on public.case_activities (submission_id, recorded_at);
alter table public.case_activities enable row level security;
create policy "case_activities_admin_read" on public.case_activities for select to authenticated using (public.is_admin());
revoke all on public.case_activities from public, anon, authenticated;
grant select on public.case_activities to authenticated;

create or replace function public.admin_add_activity(
  p_submission uuid, p_kind text, p_request_id uuid,
  p_note text default null, p_amount integer default null, p_occurred_at timestamptz default null, p_data jsonb default '{}'::jsonb
)
returns public.case_activities
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row public.case_activities;
begin
  if not public.is_admin() then
    raise exception 'not_admin' using errcode = '42501';
  end if;
  insert into public.case_activities (submission_id, kind, occurred_at, recorded_by, note, amount, data, important, request_id)
  values (
    p_submission, p_kind, p_occurred_at, auth.uid(), nullif(left(coalesce(p_note, ''), 4000), ''), p_amount, coalesce(p_data, '{}'::jsonb),
    p_kind in ('quote_sent', 'quote_changed', 'booked', 'invoiced', 'paid', 'refunded', 'completed', 'cancelled'),
    p_request_id
  )
  on conflict (request_id) do nothing;
  select * into v_row from public.case_activities a where a.request_id = p_request_id;

  -- 返信・連絡の記録は「返信済み」の印も付ける
  if p_kind in ('reply_sent', 'email', 'line', 'phone') then
    update public.submissions s set replied_at = coalesce(s.replied_at, now()), updated_at = now() where s.id = p_submission;
  end if;
  -- 返信を送ったら、その案件の下書きは消す（送った内容は data に残る）
  if p_kind = 'reply_sent' then
    delete from public.reply_drafts d where d.submission_id = p_submission;
  end if;
  return v_row;
end;
$$;
revoke all on function public.admin_add_activity(uuid, text, uuid, text, integer, timestamptz, jsonb) from public, anon;
grant execute on function public.admin_add_activity(uuid, text, uuid, text, integer, timestamptz, jsonb) to authenticated;
