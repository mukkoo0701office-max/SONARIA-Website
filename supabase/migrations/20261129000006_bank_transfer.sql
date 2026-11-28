-- 銀行振込の手動管理（決済導入 Phase 4）と、地域の自動判定の誤りを管理人が直す仕組み
-- 設計: docs/payments/PAYMENTS_DESIGN.md
-- 方針（指示書・2026-11-28/29 運営者決定）:
--   - 銀行振込は日本（円）だけ。案内の送付・着金の確認は管理人が手動で記録する（自動照合・銀行 API なし）
--   - 「案内を送った」はメールアプリを開いただけでは記録しない。管理人がボタンで記録する
--   - 利用者の「振り込みました」の連絡だけでは入金済みにしない。着金を確かめた管理人が金額と日付を記録する
--   - 着金額と請求額を比べて、入金済み／不足／超過を自動で付ける。重複入金は超過として扱い、返金を記録できる
--   - 同じ操作の再送（二重クリック・通信の再試行）は request_id で 1 回にまとめる

-- ── 金額の確定: 確定した通貨で料金区分を直す（自動判定の誤りの修正） ─────────────
-- 20261128000005 の admin_confirm_price に、料金区分・支払い方法の修正を加えたもの
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
    -- 確定した通貨が料金区分を決める（円＝日本、ドル＝日本以外）。日本以外は銀行振込を使えないのでカードに戻す
    region = case when p_currency = 'JPY' then 'jp' else 'intl' end,
    currency = p_currency,
    payment_method = case when p_currency = 'USD' and s.payment_method = 'bank_transfer' then 'card' else s.payment_method end,
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

-- 状態を自動で進める（管理画面の状態の変更と同じく履歴を残す）
create or replace function private.advance_status(p_id uuid, p_from text[], p_to text, p_note text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_old text;
begin
  select s.status into v_old from public.submissions s where s.id = p_id for update;
  if v_old = any (p_from) then
    update public.submissions s set status = p_to, updated_at = now() where s.id = p_id;
    insert into public.submission_events (submission_id, from_status, to_status, note, changed_by)
    values (p_id, v_old, p_to, p_note, auth.uid());
  end if;
end;
$$;
revoke all on function private.advance_status(uuid, text[], text, text) from public, anon, authenticated;

-- ── 振込案内を送ったことの記録 ───────────────────────────────
-- 確定金額（円）で振込の請求を 1 件作り「案内済み」にする。同じ金額の未払いの振込請求があれば、案内日を更新するだけ（再案内）
create or replace function public.admin_record_bank_notice(p_id uuid, p_request_id uuid, p_note text default null)
returns public.payments
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_sub public.submissions;
  v_pay public.payments;
begin
  if not public.is_admin() then
    raise exception 'not_admin' using errcode = '42501';
  end if;
  if p_request_id is null then
    raise exception 'request_id_required' using errcode = '22023';
  end if;
  select * into v_sub from public.submissions s where s.id = p_id for update;
  if not found then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
  if v_sub.confirmed_amount is null then
    raise exception 'amount_not_confirmed' using errcode = '22023';
  end if;
  -- 銀行振込は日本（円）だけ
  if v_sub.confirmed_currency <> 'JPY' then
    raise exception 'bank_transfer_jp_only' using errcode = '22023';
  end if;
  if exists (select 1 from public.payments p where p.submission_id = p_id and p.purpose = 'initial'
             and p.status in ('paid', 'overpaid', 'partially_refunded', 'disputed')) then
    raise exception 'already_paid' using errcode = '22023';
  end if;

  -- 同じ操作の再送は 1 回にまとめる（記録を先に入れ、重複なら何もしない）
  insert into public.case_activities (submission_id, kind, recorded_by, note, amount, data, important, request_id)
  values (p_id, 'invoiced', auth.uid(), nullif(left(coalesce(p_note, ''), 4000), ''), v_sub.confirmed_amount,
          jsonb_build_object('method', 'bank_transfer', 'currency', 'JPY'), true, p_request_id)
  on conflict (request_id) do nothing;
  if not found then
    select * into v_pay from public.payments p where p.submission_id = p_id and p.method = 'bank_transfer' order by p.updated_at desc limit 1;
    return v_pay;
  end if;

  select * into v_pay from public.payments p
  where p.submission_id = p_id and p.purpose = 'initial' and p.method = 'bank_transfer'
    and p.status in ('pending', 'link_sent', 'underpaid') and p.amount = v_sub.confirmed_amount and p.currency = 'JPY'
  order by p.created_at desc limit 1 for update;

  if found then
    update public.payments p set status = case when p.status = 'underpaid' then p.status else 'link_sent' end,
      notified_at = now(), updated_at = now(),
      note = case when p_note is null or p_note = '' then p.note else left(concat_ws(' / ', p.note, p_note), 2000) end
    where p.id = v_pay.id returning * into v_pay;
  else
    insert into public.payments (submission_id, purpose, method, currency, amount, status, notified_at, note, snapshot, created_by)
    values (p_id, 'initial', 'bank_transfer', 'JPY', v_sub.confirmed_amount, 'link_sent', now(), nullif(left(coalesce(p_note, ''), 2000), ''),
            coalesce(v_sub.confirmed_snapshot, '{}'::jsonb), auth.uid())
    returning * into v_pay;
  end if;

  -- 振込を選んだ案件として記録し、状態を「入金待ち」へ
  update public.submissions s set payment_method = 'bank_transfer', updated_at = now() where s.id = p_id;
  perform private.advance_status(p_id, array['new', 'scheduling', 'quoted'], 'awaiting_payment', '振込案内を記録');
  return v_pay;
end;
$$;
revoke all on function public.admin_record_bank_notice(uuid, uuid, text) from public, anon;
grant execute on function public.admin_record_bank_notice(uuid, uuid, text) to authenticated;

-- ── 着金の記録 ─────────────────────────────────────────
-- 1 回の着金（金額・着金日・メモ）を足す。合計を請求額と比べて 入金済み／不足／超過 を付ける。
-- 全額がそろったら案件を「入金済み」へ進める（制作開始は管理人が別に行う）
create or replace function public.admin_record_bank_receipt(p_payment uuid, p_amount integer, p_received_on date, p_request_id uuid, p_note text default null)
returns public.payments
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_pay public.payments;
  v_total integer;
  v_status text;
begin
  if not public.is_admin() then
    raise exception 'not_admin' using errcode = '42501';
  end if;
  if p_request_id is null then
    raise exception 'request_id_required' using errcode = '22023';
  end if;
  if p_amount is null or p_amount < 1 or p_amount > 100000000 then
    raise exception 'invalid_amount' using errcode = '22023';
  end if;
  -- 着金日は未来にできない（日本時間）
  if p_received_on is null or p_received_on > (now() at time zone 'Asia/Tokyo')::date then
    raise exception 'invalid_date' using errcode = '22023';
  end if;
  select * into v_pay from public.payments p where p.id = p_payment for update;
  if not found then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
  if v_pay.method <> 'bank_transfer' then
    raise exception 'not_bank_transfer' using errcode = '22023';
  end if;
  if v_pay.status not in ('pending', 'link_sent', 'underpaid', 'paid', 'overpaid') then
    raise exception 'invalid_state' using errcode = '22023';
  end if;

  insert into public.case_activities (submission_id, kind, occurred_at, recorded_by, note, amount, data, important, request_id)
  values (v_pay.submission_id, 'paid', (p_received_on::timestamp at time zone 'Asia/Tokyo'), auth.uid(),
          nullif(left(coalesce(p_note, ''), 4000), ''), p_amount,
          jsonb_build_object('method', 'bank_transfer', 'currency', v_pay.currency, 'payment_id', v_pay.id, 'received_on', p_received_on), true, p_request_id)
  on conflict (request_id) do nothing;
  if not found then
    return v_pay;
  end if;

  v_total := coalesce(v_pay.received_amount, 0) + p_amount;
  v_status := case when v_total = v_pay.amount then 'paid' when v_total < v_pay.amount then 'underpaid' else 'overpaid' end;
  update public.payments p set
    received_amount = v_total,
    status = v_status,
    paid_at = (p_received_on::timestamp at time zone 'Asia/Tokyo'),
    note = case when p_note is null or p_note = '' then p.note else left(concat_ws(' / ', p.note, p_note), 2000) end,
    updated_at = now()
  where p.id = v_pay.id returning * into v_pay;

  if v_status in ('paid', 'overpaid') and v_pay.purpose = 'initial' then
    perform private.advance_status(v_pay.submission_id, array['new', 'scheduling', 'quoted', 'awaiting_payment'], 'paid', '振込の着金を確認');
  end if;
  return v_pay;
end;
$$;
revoke all on function public.admin_record_bank_receipt(uuid, integer, date, uuid, text) from public, anon;
grant execute on function public.admin_record_bank_receipt(uuid, integer, date, uuid, text) to authenticated;

-- ── 返金の記録（銀行振込。管理人が振り込み返したあとに記録する） ─────────────
-- カードの返金は Stripe の Webhook（Phase 3）で記録する
create or replace function public.admin_record_bank_refund(p_payment uuid, p_amount integer, p_request_id uuid, p_note text default null)
returns public.payments
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_pay public.payments;
  v_refunded integer;
begin
  if not public.is_admin() then
    raise exception 'not_admin' using errcode = '42501';
  end if;
  if p_request_id is null then
    raise exception 'request_id_required' using errcode = '22023';
  end if;
  select * into v_pay from public.payments p where p.id = p_payment for update;
  if not found then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
  if v_pay.method <> 'bank_transfer' then
    raise exception 'not_bank_transfer' using errcode = '22023';
  end if;
  if v_pay.status not in ('paid', 'underpaid', 'overpaid', 'partially_refunded') then
    raise exception 'invalid_state' using errcode = '22023';
  end if;
  v_refunded := v_pay.refunded_amount + coalesce(p_amount, 0);
  if p_amount is null or p_amount < 1 or v_refunded > coalesce(v_pay.received_amount, 0) then
    raise exception 'invalid_amount' using errcode = '22023';
  end if;

  insert into public.case_activities (submission_id, kind, recorded_by, note, amount, data, important, request_id)
  values (v_pay.submission_id, 'refunded', auth.uid(), nullif(left(coalesce(p_note, ''), 4000), ''), p_amount,
          jsonb_build_object('method', 'bank_transfer', 'currency', v_pay.currency, 'payment_id', v_pay.id), true, p_request_id)
  on conflict (request_id) do nothing;
  if not found then
    return v_pay;
  end if;

  update public.payments p set
    refunded_amount = v_refunded,
    -- 超過分だけを返した場合は、請求額ちょうどの入金済みに戻す
    status = case
      when v_refunded >= coalesce(p.received_amount, 0) then 'refunded'
      when p.status = 'overpaid' and coalesce(p.received_amount, 0) - v_refunded = p.amount then 'paid'
      when p.status = 'overpaid' and coalesce(p.received_amount, 0) - v_refunded > p.amount then 'overpaid'
      else 'partially_refunded' end,
    note = case when p_note is null or p_note = '' then p.note else left(concat_ws(' / ', p.note, p_note), 2000) end,
    updated_at = now()
  where p.id = v_pay.id returning * into v_pay;
  return v_pay;
end;
$$;
revoke all on function public.admin_record_bank_refund(uuid, integer, uuid, text) from public, anon;
grant execute on function public.admin_record_bank_refund(uuid, integer, uuid, text) to authenticated;

-- ── 未払いの請求の取り消し（振込の案内を取り下げるなど） ───────────────
create or replace function public.admin_cancel_payment(p_payment uuid, p_note text default null)
returns public.payments
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_pay public.payments;
begin
  if not public.is_admin() then
    raise exception 'not_admin' using errcode = '42501';
  end if;
  update public.payments p set status = 'cancelled', updated_at = now(),
    note = case when p_note is null or p_note = '' then p.note else left(concat_ws(' / ', p.note, p_note), 2000) end
  where p.id = p_payment and p.status in ('pending', 'link_sent')
  returning * into v_pay;
  if v_pay.id is null then
    raise exception 'invalid_state' using errcode = '22023';
  end if;
  return v_pay;
end;
$$;
revoke all on function public.admin_cancel_payment(uuid, text) from public, anon;
grant execute on function public.admin_cancel_payment(uuid, text) to authenticated;
