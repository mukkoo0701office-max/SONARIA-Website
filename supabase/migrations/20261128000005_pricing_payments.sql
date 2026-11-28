-- 料金マスタ・請求先の地域と通貨・決済の記録（決済導入 Phase 2）
-- 設計: docs/payments/PAYMENTS_DESIGN.md
-- 方針:
--   - 料金は public.price_items で管理する。改定は「新しい行を足す」だけで、過去の行は書き換えない（過去案件の金額が変わらない）
--   - 受付時にサーバーで計算した金額（server_quote）と、管理人が確定した金額（confirmed_*）を案件に保存する（スナップショット）
--   - 決済（カード・銀行振込・追加料金・返金）は public.payments に 1 件ずつ記録する。決済済みの金額は書き換えない
--   - 入金の確認前は「制作中」「入金済み」にできない（確定金額がある案件のみ）
--   - 金額はすべて最小単位の整数（JPY は円、USD はセント）。表示価格は税込み（2026-11-28 運営者決定）

-- ── 料金マスタ ─────────────────────────────────────────────
create table public.price_items (
  id uuid primary key default gen_random_uuid(),
  service text not null check (service ~ '^[a-z_]{1,40}$'),
  item text not null check (item ~ '^[A-Za-z0-9_]{1,40}$'),
  mode text not null check (mode in ('per_unit', 'fixed', 'quote')),
  jpy integer check (jpy is null or jpy between 0 and 10000000),
  usd_cents integer check (usd_cents is null or usd_cents between 0 and 100000000),
  effective_from date not null,
  active boolean not null default true,
  note text check (note is null or char_length(note) <= 500),
  created_at timestamptz not null default now(),
  created_by uuid references auth.users (id) on delete set null,
  unique (service, item, effective_from)
);
alter table public.price_items enable row level security;

-- 料金は公開情報（申込フォームが表示に使う）。読み取りだけを許可し、書き込みは管理人の RPC だけ
create policy "price_items_public_read" on public.price_items for select to anon, authenticated using (true);
revoke all on public.price_items from public, anon, authenticated;
grant select on public.price_items to anon, authenticated;

-- 初期の料金（frontend/src/lib/orders/priceEngine.ts の SEED_PRICES と同じ値。テストで一致を確認する）
insert into public.price_items (service, item, mode, jpy, usd_cents, effective_from) values
  ('bowing', 'bowing', 'per_unit', 1000, 1500, '2026-11-28'),
  ('bowing', 'fingering', 'per_unit', 1000, 1500, '2026-11-28'),
  ('bowing', 'both', 'per_unit', 1500, 2200, '2026-11-28'),
  ('recording', 'violin', 'per_unit', 9000, 6000, '2026-11-28'),
  ('recording', 'viola', 'per_unit', 9000, 6000, '2026-11-28'),
  ('recording', 'cello', 'per_unit', 14000, 9500, '2026-11-28'),
  ('recording', 'other', 'per_unit', 14000, 9500, '2026-11-28'),
  ('lesson', 'trial', 'fixed', 1000, null, '2026-11-28'),
  ('lesson', 'single', 'fixed', 6000, null, '2026-11-28'),
  ('lesson', 'intensive', 'fixed', 11000, null, '2026-11-28'),
  ('lesson', 'visiting', 'fixed', 10000, null, '2026-11-28'),
  ('performance', 'quote', 'quote', null, null, '2026-11-28');

-- 料金の追加・改定（管理人）。有効開始日は今日（日本時間）以降のみ。同じ日の行は、まだ有効になっていない未来の日付に限り上書きできる
create or replace function public.admin_add_price(
  p_service text, p_item text, p_mode text, p_jpy integer, p_usd_cents integer,
  p_effective_from date, p_active boolean default true, p_note text default null
)
returns public.price_items
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_today date := (now() at time zone 'Asia/Tokyo')::date;
  v_row public.price_items;
begin
  if not public.is_admin() then
    raise exception 'not_admin' using errcode = '42501';
  end if;
  if p_effective_from < v_today then
    raise exception 'past_effective_date' using errcode = '22023';
  end if;
  insert into public.price_items (service, item, mode, jpy, usd_cents, effective_from, active, note, created_by)
  values (p_service, p_item, p_mode, p_jpy, p_usd_cents, p_effective_from, coalesce(p_active, true), nullif(left(coalesce(p_note, ''), 500), ''), auth.uid())
  on conflict (service, item, effective_from) do update set
    mode = excluded.mode, jpy = excluded.jpy, usd_cents = excluded.usd_cents, active = excluded.active,
    note = excluded.note, created_by = excluded.created_by, created_at = now()
    where public.price_items.effective_from > v_today
  returning * into v_row;
  if v_row.id is null then
    -- 今日から有効な行はすでに使われている可能性があるため上書きしない
    raise exception 'effective_today_locked' using errcode = '22023';
  end if;
  return v_row;
end;
$$;
revoke all on function public.admin_add_price(text, text, text, integer, integer, date, boolean, text) from public, anon;
grant execute on function public.admin_add_price(text, text, text, integer, integer, date, boolean, text) to authenticated;

-- ── 案件: 請求先の地域・通貨・金額 ──────────────────────────────
alter table public.submissions
  -- 請求先の地域（申込時の申告。jp = 日本、intl = 日本以外）。これで通貨が決まる
  add column if not exists region text check (region is null or region in ('jp', 'intl')),
  -- 参考: アクセス元から推定した国（判定できたときだけ。VPN などで誤ることがあるので確定には使わない）
  add column if not exists region_detected text check (region_detected is null or region_detected ~ '^[A-Z]{2}$'),
  add column if not exists currency text check (currency is null or currency in ('JPY', 'USD')),
  -- 希望の支払い方法（銀行振込は日本のみ）
  add column if not exists payment_method text check (payment_method is null or payment_method in ('card', 'bank_transfer')),
  -- 受付時にサーバーが料金マスタで計算した金額（スナップショット。見積もり制は ok: false）
  add column if not exists server_quote jsonb,
  -- 管理人が確定した金額（支払い案内の金額）。決済済みの案件では変更できない
  add column if not exists confirmed_amount integer check (confirmed_amount is null or confirmed_amount between 1 and 100000000),
  add column if not exists confirmed_currency text check (confirmed_currency is null or confirmed_currency in ('JPY', 'USD')),
  add column if not exists confirmed_at timestamptz,
  add column if not exists confirmed_snapshot jsonb;

-- 状態に「入金待ち」「入金済み」を追加
alter table public.submissions drop constraint if exists submissions_status_check;
alter table public.submissions add constraint submissions_status_check check (status in (
  'new', 'scheduling', 'quoted', 'awaiting_payment', 'paid', 'booked', 'in_progress', 'delivered', 'completed', 'cancelled',
  'submitted', 'under_review', 'changes_requested', 'approved', 'published', 'unpublished', 'rejected',
  'spam'
));

-- ── 決済の記録 ─────────────────────────────────────────────
-- 1 件 = 1 回の請求（カード決済の 1 セッション、または銀行振込の 1 回の案内）。追加料金は purpose = additional の別の行
create table public.payments (
  id uuid primary key default gen_random_uuid(),
  -- 決済の記録がある案件は削除できない（会計の記録を残す）
  submission_id uuid not null references public.submissions (id) on delete restrict,
  purpose text not null default 'initial' check (purpose in ('initial', 'additional')),
  method text not null check (method in ('card', 'bank_transfer')),
  currency text not null check (currency in ('JPY', 'USD')),
  amount integer not null check (amount between 1 and 100000000),
  status text not null default 'pending' check (status in (
    'pending',            -- 作成済み（未案内）
    'link_sent',          -- 支払いリンク／振込案内を送った
    'paid',               -- 入金確認済み（カードは Webhook、振込は管理人の確認）
    'underpaid',          -- 振込額が不足
    'overpaid',           -- 振込額が超過
    'failed', 'expired', 'cancelled',
    'partially_refunded', 'refunded',
    'disputed'            -- チャージバック
  )),
  received_amount integer check (received_amount is null or received_amount between 0 and 100000000),
  refunded_amount integer not null default 0 check (refunded_amount between 0 and 100000000),
  notified_at timestamptz,
  paid_at timestamptz,
  -- Stripe（Phase 3）。秘密情報は持たない
  stripe_session_id text unique,
  stripe_payment_intent text unique,
  checkout_url text,
  expires_at timestamptz,
  note text check (note is null or char_length(note) <= 2000),
  snapshot jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users (id) on delete set null
);
create index payments_submission_idx on public.payments (submission_id, created_at);
alter table public.payments enable row level security;
create policy "payments_admin_read" on public.payments for select to authenticated using (public.is_admin());
revoke all on public.payments from public, anon, authenticated;
grant select on public.payments to authenticated;

-- 入金済みの合計（確定通貨・初回分）。不足（underpaid）は受け取った額だけ数える
create or replace function private.paid_total(p_submission uuid, p_currency text)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(sum(case
    when p.status in ('paid', 'overpaid', 'partially_refunded') then coalesce(p.received_amount, p.amount) - p.refunded_amount
    when p.status = 'underpaid' then coalesce(p.received_amount, 0)
    else 0 end), 0)::integer
  from public.payments p
  where p.submission_id = p_submission and p.currency = p_currency and p.purpose = 'initial';
$$;
revoke all on function private.paid_total(uuid, text) from public, anon, authenticated;

-- 金額の確定（管理人）。決済済みなら変更できない（追加料金は別の決済にする）。未払いの古い請求は取り消す
create or replace function public.admin_confirm_price(p_id uuid, p_amount integer, p_currency text, p_note text default null)
returns public.submissions
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row public.submissions;
  v_old_amount integer;
begin
  if not public.is_admin() then
    raise exception 'not_admin' using errcode = '42501';
  end if;
  if p_amount is null or p_amount < 1 or p_amount > 100000000 or p_currency not in ('JPY', 'USD') then
    raise exception 'invalid_amount' using errcode = '22023';
  end if;
  select s.confirmed_amount into v_old_amount from public.submissions s where s.id = p_id for update;
  if not found then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
  if exists (select 1 from public.payments p where p.submission_id = p_id and p.purpose = 'initial'
             and p.status in ('paid', 'underpaid', 'overpaid', 'partially_refunded', 'refunded', 'disputed')) then
    raise exception 'already_paid' using errcode = '22023';
  end if;

  -- 金額が変わる場合、未払いの古い請求（リンク・振込案内）を取り消す。Stripe のセッションの失効は Phase 3 の関数が行う
  update public.payments p set status = 'cancelled', updated_at = now(),
    note = left(concat_ws(' / ', p.note, '金額の変更により取り消し'), 2000)
  where p.submission_id = p_id and p.purpose = 'initial' and p.status in ('pending', 'link_sent')
    and (p.amount <> p_amount or p.currency <> p_currency);

  update public.submissions s set
    confirmed_amount = p_amount,
    confirmed_currency = p_currency,
    confirmed_at = now(),
    confirmed_snapshot = jsonb_build_object(
      'amount', p_amount, 'currency', p_currency, 'confirmed_at', now(), 'confirmed_by', auth.uid(),
      'server_quote', s.server_quote, 'region', s.region, 'note', nullif(left(coalesce(p_note, ''), 500), '')),
    updated_at = now()
  where s.id = p_id
  returning * into v_row;

  insert into public.case_activities (submission_id, kind, recorded_by, note, amount, data, important, request_id)
  values (p_id, case when v_old_amount is null then 'quote_sent' else 'quote_changed' end, auth.uid(),
          nullif(left(coalesce(p_note, ''), 4000), ''), p_amount, jsonb_build_object('currency', p_currency, 'previous', v_old_amount), true, gen_random_uuid());
  return v_row;
end;
$$;
revoke all on function public.admin_confirm_price(uuid, integer, text, text) from public, anon;
grant execute on function public.admin_confirm_price(uuid, integer, text, text) to authenticated;

-- ── 状態の更新に「入金前は制作中・入金済みにしない」制約を加える ─────────────
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
  v_amount integer;
  v_currency text;
begin
  if not public.is_admin() then
    raise exception 'not_admin' using errcode = '42501';
  end if;

  select s.status, s.confirmed_amount, s.confirmed_currency into v_old_status, v_amount, v_currency
  from public.submissions s where s.id = p_id for update;
  if not found then
    raise exception 'not_found' using errcode = 'P0002';
  end if;

  v_new_status := coalesce(p_patch ->> 'status', v_old_status);

  -- 確定金額のある案件は、入金の確認が済むまで「入金済み」「制作中」に進めない
  if v_new_status is distinct from v_old_status and v_new_status in ('paid', 'in_progress') and v_amount is not null
     and private.paid_total(p_id, v_currency) < v_amount then
    raise exception 'payment_required' using errcode = '22023';
  end if;

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
