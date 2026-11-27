-- 管理画面（/admin）から申し込みを扱うための追加
-- 方針:
--   - 管理人（public.admins）だけが読める・変えられる。変更は public.admin_update_submission() だけを通す
--   - お客さんの入力内容（payload・氏名・連絡先）は管理人も書き換えられない（運営側の項目だけ変更できる）
--   - 状態の変更は履歴（submission_events）に残す

-- 状態: 管理画面の案件の状態（CaseStatus）と講師申請の状態（TeacherApplicationStatus）に合わせる
alter table public.submissions drop constraint if exists submissions_status_check;
update public.submissions set status = case status
  when 'accepted' then 'booked'
  when 'declined' then 'cancelled'
  when 'done' then 'completed'
  else status end
where status in ('accepted', 'declined', 'done');
alter table public.submissions add constraint submissions_status_check check (status in (
  -- 案件（レッスン・運指運弓・録音・演奏依頼）
  'new', 'scheduling', 'quoted', 'booked', 'in_progress', 'delivered', 'completed', 'cancelled',
  -- 講師申請（受付直後は 'new' のまま。管理画面では「申請済み」と表示する）
  'submitted', 'under_review', 'changes_requested', 'approved', 'published', 'unpublished', 'rejected',
  -- 迷惑な送信
  'spam'
));

alter table public.submissions
  add column if not exists read_at timestamptz,
  add column if not exists replied_at timestamptz,
  -- 運営側の項目（実施日時・締切・見積・支払い）。お客さんの入力とは分けて持つ
  add column if not exists admin_data jsonb not null default '{}'::jsonb;

-- ── 状態の履歴 ─────────────────────────────────────────────
create table if not exists public.submission_events (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid not null references public.submissions (id) on delete cascade,
  from_status text,
  to_status text not null,
  note text,
  changed_at timestamptz not null default now(),
  changed_by uuid references auth.users (id) on delete set null
);
create index if not exists submission_events_submission_idx on public.submission_events (submission_id, changed_at);
alter table public.submission_events enable row level security;

create policy "submission_events_admin_read" on public.submission_events
  for select to authenticated using (public.is_admin());

revoke all on public.submission_events from public, anon, authenticated;
grant select on public.submission_events to authenticated;

-- ── 管理人による更新 ───────────────────────────────────────
-- p_patch に入れてよいキー: status / read（true・false）/ replied（true・false）/ admin_note / admin_data（オブジェクト。キーごとに上書き）
create or replace function public.admin_update_submission(p_id uuid, p_patch jsonb, p_note text default null)
returns public.submissions
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row public.submissions;
  v_old_status text;
  v_new_status text;
begin
  if not public.is_admin() then
    raise exception 'not_admin' using errcode = '42501';
  end if;

  select s.status into v_old_status from public.submissions s where s.id = p_id for update;
  if not found then
    raise exception 'not_found' using errcode = 'P0002';
  end if;

  v_new_status := coalesce(p_patch ->> 'status', v_old_status);

  update public.submissions s set
    status = v_new_status,
    read_at = case when p_patch ? 'read' then (case when (p_patch ->> 'read')::boolean then coalesce(s.read_at, now()) else null end) else s.read_at end,
    replied_at = case when p_patch ? 'replied' then (case when (p_patch ->> 'replied')::boolean then coalesce(s.replied_at, now()) else null end) else s.replied_at end,
    admin_note = case when p_patch ? 'admin_note' then left(p_patch ->> 'admin_note', 10000) else s.admin_note end,
    admin_data = case when jsonb_typeof(p_patch -> 'admin_data') = 'object' then s.admin_data || (p_patch -> 'admin_data') else s.admin_data end,
    updated_at = now()
  where s.id = p_id
  returning * into v_row;

  if v_new_status is distinct from v_old_status then
    insert into public.submission_events (submission_id, from_status, to_status, note, changed_by)
    values (p_id, v_old_status, v_new_status, nullif(left(coalesce(p_note, ''), 2000), ''), auth.uid());
  end if;

  return v_row;
end;
$$;
revoke all on function public.admin_update_submission(uuid, jsonb, text) from public, anon;
grant execute on function public.admin_update_submission(uuid, jsonb, text) to authenticated;

-- 管理人かどうかを画面から確かめる（ログイン直後の判定用）
grant execute on function public.is_admin() to authenticated;
