-- SONARIA 申し込み・依頼・講師登録の保存（第1段階）
-- 方針:
--   - 一般利用者は API から直接読み書きできない。書き込みは Edge Function（submit）だけが private.accept_submission を通して行う
--   - 管理人（public.admins に登録した認証ユーザー）だけが submissions を読める（管理画面の接続は次の PR）
--   - 「新しいテーブルを自動で API に公開しない」設定に合わせ、権限はここで明示する

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

-- ── 管理人 ─────────────────────────────────────────────
create table public.admins (
  user_id uuid primary key references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);
alter table public.admins enable row level security;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.admins a where a.user_id = auth.uid());
$$;
revoke all on function public.is_admin() from public, anon;
grant execute on function public.is_admin() to authenticated;

create policy "admins_read_self" on public.admins
  for select to authenticated using (user_id = auth.uid());

-- ── 申し込み本体 ─────────────────────────────────────────
-- kind: lesson / bowing / recording（統合申込） / performance_quote（演奏依頼） / teacher_application（講師登録）
create table public.submissions (
  id uuid primary key default gen_random_uuid(),
  receipt_no text not null unique,
  kind text not null check (kind in ('lesson', 'bowing', 'recording', 'performance_quote', 'teacher_application')),
  status text not null default 'new' check (status in ('new', 'in_progress', 'quoted', 'accepted', 'declined', 'done', 'cancelled', 'spam')),
  locale text not null check (locale in ('ja', 'en')),
  contact_name text not null check (char_length(contact_name) between 1 and 100),
  contact_email text not null check (char_length(contact_email) between 3 and 254),
  payload jsonb not null,
  -- 画面で表示した概算（参考値）。料金の確定は管理人が行う
  client_estimate integer check (client_estimate is null or client_estimate between 0 and 10000000),
  idempotency_key uuid not null unique,
  consent_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  admin_note text
);
create index submissions_created_at_idx on public.submissions (created_at desc);
create index submissions_kind_status_idx on public.submissions (kind, status);
alter table public.submissions enable row level security;

create policy "submissions_admin_read" on public.submissions
  for select to authenticated using (public.is_admin());

-- 権限を明示（anon には何も与えない。authenticated も RLS で管理人だけに絞られる）
revoke all on public.admins, public.submissions from public, anon, authenticated;
grant select on public.admins to authenticated;
grant select on public.submissions to authenticated;

-- ── 送信回数制限（IP はソルト付きハッシュだけ保存）───────────────
create table private.settings (
  key text primary key,
  value text not null
);
insert into private.settings (key, value)
values ('rate_limit_salt', replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', ''));

create table private.rate_limits (
  ip_hash text not null,
  bucket timestamptz not null,
  hits integer not null default 0,
  primary key (ip_hash, bucket)
);

-- ── 受付処理（Edge Function から呼ぶ）──────────────────────────
-- 戻り値 result: accepted（新規保存）/ duplicate（同じ送信 ID の再送。最初の受付番号を返す）/ rate_limited
create or replace function private.accept_submission(
  p_ip text,
  p_key uuid,
  p_kind text,
  p_locale text,
  p_name text,
  p_email text,
  p_payload jsonb,
  p_estimate integer,
  p_max_per_hour integer
)
returns table (result text, receipt_no text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_existing text;
  v_hash text;
  v_bucket timestamptz := date_trunc('hour', now());
  v_hits integer;
  v_receipt text;
begin
  -- 二重送信: 同じ送信 ID は 1 件だけ保存し、最初の受付番号を返す
  select s.receipt_no into v_existing from public.submissions s where s.idempotency_key = p_key;
  if v_existing is not null then
    return query select 'duplicate'::text, v_existing;
    return;
  end if;

  -- 送信回数制限（送信元ごと・1 時間あたり）
  select encode(sha256(convert_to(coalesce(p_ip, '') || st.value, 'UTF8')), 'hex') into v_hash
    from private.settings st where st.key = 'rate_limit_salt';
  insert into private.rate_limits as rl (ip_hash, bucket, hits) values (v_hash, v_bucket, 1)
    on conflict (ip_hash, bucket) do update set hits = rl.hits + 1
    returning rl.hits into v_hits;
  delete from private.rate_limits where bucket < now() - interval '1 day';
  if v_hits > p_max_per_hour then
    return query select 'rate_limited'::text, null::text;
    return;
  end if;

  -- 受付番号: SN-YYMMDD-XXXXX（日本時間の日付＋ランダム 5 文字）
  loop
    v_receipt := 'SN-' || to_char(now() at time zone 'Asia/Tokyo', 'YYMMDD') || '-'
      || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 5));
    exit when not exists (select 1 from public.submissions s where s.receipt_no = v_receipt);
  end loop;

  insert into public.submissions (receipt_no, kind, locale, contact_name, contact_email, payload, client_estimate, idempotency_key)
  values (v_receipt, p_kind, p_locale, p_name, p_email, p_payload, p_estimate, p_key)
  on conflict (idempotency_key) do nothing;

  -- 同時に同じ送信 ID が来た場合は、先に保存された方の受付番号を返す
  select s.receipt_no into v_existing from public.submissions s where s.idempotency_key = p_key;
  return query select case when v_existing = v_receipt then 'accepted' else 'duplicate' end, v_existing;
end;
$$;
revoke all on function private.accept_submission(text, uuid, text, text, text, text, jsonb, integer, integer) from public, anon, authenticated;

-- ── 停止防止用の軽いアクセス（keepalive.yml）────────────────────
-- データベースに 1 回問い合わせるだけで、個人情報には触れない
create or replace function public.ping()
returns boolean
language sql
stable
set search_path = ''
as $$ select true $$;
revoke all on function public.ping() from public;
grant execute on function public.ping() to anon, authenticated;
