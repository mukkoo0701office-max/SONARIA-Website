-- 管理画面からの削除（管理人だけ）。元に戻せないため、関数を通してだけ行う
-- 迷惑な送信の非表示は削除ではなく状態 'spam'（admin_update_submission）で行う
create or replace function public.admin_delete_submission(p_id uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_receipt text;
begin
  if not public.is_admin() then
    raise exception 'not_admin' using errcode = '42501';
  end if;
  -- 状態の履歴（submission_events）は外部キーの on delete cascade で一緒に消える
  delete from public.submissions s where s.id = p_id returning s.receipt_no into v_receipt;
  if v_receipt is null then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
  return v_receipt;
end;
$$;
revoke all on function public.admin_delete_submission(uuid) from public, anon;
grant execute on function public.admin_delete_submission(uuid) to authenticated;
