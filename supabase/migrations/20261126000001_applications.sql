-- SONARIA: 申し込み受付の基盤
-- docs/decisions/0003-external-backend.md
--
-- 方針:
-- - すべてのテーブルで RLS を有効にする
-- - 一般利用者（anon）には申し込みテーブルの読み書きを一切許可しない。書き込みは Edge Function（service role）だけ
-- - 管理人は admins テーブルに登録された認証ユーザーだけ。is_admin() で判定する

create extension if not exists pgcrypto;

-- ---------- 管理人 ----------

create table public.admins (
  user_id uuid primary key references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);
alter table public.admins enable row level security;

-- 自分が管理人かどうかだけは確認できる（管理画面の表示切り替え用）
create policy admins_select_self on public.admins
  for select to authenticated
  using (user_id = auth.uid());

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.admins where user_id = auth.uid());
$$;
revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to anon, authenticated;

-- ---------- 受付番号 ----------
-- 例: SON-261126-00001（日付は日本時間）

create sequence public.receipt_seq;

create or replace function public.next_receipt_no()
returns text
language sql
volatile
set search_path = public
as $$
  select 'SON-' || to_char(now() at time zone 'Asia/Tokyo', 'YYMMDD') || '-' || lpad(nextval('public.receipt_seq')::text, 5, '0');
$$;
revoke all on function public.next_receipt_no() from public, anon, authenticated;
-- 申し込みの登録は service role（Edge Function）だけが行う
grant execute on function public.next_receipt_no() to service_role;
grant usage on sequence public.receipt_seq to service_role;

-- ---------- 申し込み ----------

create table public.applications (
  id uuid primary key default gen_random_uuid(),
  receipt_no text not null unique default public.next_receipt_no(),
  -- 二重送信防止: 画面で 1 回の申し込みごとに作る ID。同じ ID の再送は同じ受付番号を返す
  client_request_id uuid not null unique,
  service text not null check (service in ('lesson', 'bowing', 'recording', 'performance', 'contact')),
  status text not null default 'new'
    check (status in ('new', 'reviewing', 'quoted', 'awaiting_reply', 'in_progress', 'completed', 'cancelled')),
  locale text not null default 'ja' check (locale in ('ja', 'en')),
  name text not null,
  email text not null,
  phone text,
  -- サービスごとの入力内容（Edge Function で検証・整形済みのものだけ）
  payload jsonb not null default '{}'::jsonb,
  -- サーバー側で計算した料金の目安（確定金額ではない）
  quote jsonb,
  admin_note text,
  notify_admin_status text not null default 'pending'
    check (notify_admin_status in ('pending', 'sent', 'failed', 'not_configured')),
  notify_applicant_status text not null default 'pending'
    check (notify_applicant_status in ('pending', 'sent', 'failed', 'not_configured', 'disabled')),
  consent_at timestamptz not null,
  redacted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index applications_service_status_idx on public.applications (service, status, created_at desc);
create index applications_created_idx on public.applications (created_at desc);

alter table public.applications enable row level security;

create policy applications_admin_select on public.applications
  for select to authenticated
  using (public.is_admin());

-- 管理人が直接更新できるのは管理用メモだけ（状態の変更は admin_set_status を使う）
create policy applications_admin_update on public.applications
  for update to authenticated
  using (public.is_admin())
  with check (public.is_admin());

revoke update on public.applications from anon, authenticated;
grant update (admin_note) on public.applications to authenticated;

-- insert / delete のポリシーは作らない（一般利用者・管理人とも不可。削除は admin_redact_application）

-- ---------- 状態の履歴 ----------

create table public.application_status_history (
  id bigserial primary key,
  application_id uuid not null references public.applications (id) on delete cascade,
  from_status text,
  to_status text not null,
  note text,
  changed_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);
create index application_status_history_app_idx on public.application_status_history (application_id, created_at);

alter table public.application_status_history enable row level security;

create policy status_history_admin_select on public.application_status_history
  for select to authenticated
  using (public.is_admin());

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger applications_touch_updated_at
  before update on public.applications
  for each row execute function public.touch_updated_at();

-- 状態を変える（管理人のみ）。履歴に誰がいつ変えたかを残す
create or replace function public.admin_set_status(p_id uuid, p_status text, p_note text default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_from text;
begin
  if not public.is_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  select status into v_from from public.applications where id = p_id for update;
  if not found then
    raise exception 'not found' using errcode = 'P0002';
  end if;
  update public.applications set status = p_status where id = p_id;
  insert into public.application_status_history (application_id, from_status, to_status, note, changed_by)
    values (p_id, v_from, p_status, nullif(trim(p_note), ''), auth.uid());
end;
$$;
revoke all on function public.admin_set_status(uuid, text, text) from public, anon;
grant execute on function public.admin_set_status(uuid, text, text) to authenticated;

-- ---------- 添付ファイル ----------

create table public.application_files (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.applications (id) on delete cascade,
  storage_path text not null unique,
  original_name text not null,
  mime text not null,
  size_bytes bigint not null check (size_bytes > 0),
  uploaded boolean not null default false,
  created_at timestamptz not null default now()
);
create index application_files_app_idx on public.application_files (application_id);

alter table public.application_files enable row level security;

create policy application_files_admin_select on public.application_files
  for select to authenticated
  using (public.is_admin());

-- 非公開バケット。種類と容量はバケット側でも制限する（Edge Function の検証と二重）
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'application-files',
  'application-files',
  false,
  20971520,
  array['application/pdf', 'image/png', 'image/jpeg']
)
on conflict (id) do nothing;

-- アップロードは Edge Function が発行する署名付き URL だけ（insert のポリシーは作らない）
create policy application_files_storage_admin_select on storage.objects
  for select to authenticated
  using (bucket_id = 'application-files' and public.is_admin());

create policy application_files_storage_admin_delete on storage.objects
  for delete to authenticated
  using (bucket_id = 'application-files' and public.is_admin());

-- ---------- 個人情報の削除（管理人のみ） ----------
-- 添付ファイルの実体は、管理画面から Storage API で先に削除する（SQL から storage.objects を直接消さない）

create or replace function public.admin_redact_application(p_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  update public.applications
    set name = '(deleted)',
        email = 'deleted@invalid',
        phone = null,
        payload = '{}'::jsonb,
        admin_note = null,
        redacted_at = now()
    where id = p_id;
  delete from public.application_files where application_id = p_id;
  insert into public.application_status_history (application_id, from_status, to_status, note, changed_by)
    select id, status, status, 'personal data deleted', auth.uid() from public.applications where id = p_id;
end;
$$;
revoke all on function public.admin_redact_application(uuid) from public, anon;
grant execute on function public.admin_redact_application(uuid) to authenticated;

-- ---------- 設定 ----------

create table public.settings (
  key text primary key,
  value jsonb not null,
  is_public boolean not null default false,
  updated_at timestamptz not null default now()
);
alter table public.settings enable row level security;

-- 公開してよい設定（例: 税の扱い）だけは誰でも読める
create policy settings_public_select on public.settings
  for select to anon, authenticated
  using (is_public);

create policy settings_admin_all on public.settings
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create trigger settings_touch_updated_at
  before update on public.settings
  for each row execute function public.touch_updated_at();

insert into public.settings (key, value, is_public) values
  -- 運指・ボウイング料金の税の扱い: undecided（確認後に案内）/ included（税込）/ excluded（税抜）
  ('bowing_tax_mode', '"undecided"'::jsonb, true),
  -- 支払い案内（銀行振込・PayPay 等）。後から管理画面で設定する
  ('payment_instructions', '{"ja": "", "en": ""}'::jsonb, false);

-- ---------- 送信回数制限 ----------

create table public.rate_limits (
  key text not null,
  window_start timestamptz not null,
  count integer not null default 0,
  primary key (key, window_start)
);
alter table public.rate_limits enable row level security;
-- ポリシーなし: service role（Edge Function）からだけ使う

-- 許可なら true。p_key は IP アドレスのハッシュ（生の IP は保存しない）
create or replace function public.hit_rate_limit(p_key text, p_limit integer, p_window_seconds integer)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_window timestamptz := to_timestamp(floor(extract(epoch from now()) / p_window_seconds) * p_window_seconds);
  v_count integer;
begin
  insert into public.rate_limits (key, window_start, count)
    values (p_key, v_window, 1)
    on conflict (key, window_start) do update set count = public.rate_limits.count + 1
    returning count into v_count;
  -- 古い記録を掃除する
  delete from public.rate_limits where window_start < now() - interval '2 days';
  return v_count <= p_limit;
end;
$$;
revoke all on function public.hit_rate_limit(text, integer, integer) from public, anon, authenticated;
grant execute on function public.hit_rate_limit(text, integer, integer) to service_role;
