-- 修正: 申込の内容（payload）が JSON の文字列値として保存されていた行を、オブジェクトに直す
-- 原因: 受付関数が「文字列::jsonb」で渡しており、postgres.js がそれを JSON の文字列値として送っていた
-- （受付関数は text を経由する形に修正済み。supabase/functions/submit/index.ts）
-- 文字列の中身が JSON のオブジェクトとして読める行だけを直す。何度実行しても結果は同じ
create or replace function private.repair_string_payloads()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count integer := 0;
  r record;
begin
  for r in select s.id, s.payload #>> '{}' as raw from public.submissions s where jsonb_typeof(s.payload) = 'string' loop
    begin
      if jsonb_typeof(r.raw::jsonb) = 'object' then
        update public.submissions set payload = r.raw::jsonb where id = r.id;
        v_count := v_count + 1;
      end if;
    exception when others then
      -- JSON として読めない行は触らない
      null;
    end;
  end loop;
  return v_count;
end;
$$;
revoke all on function private.repair_string_payloads() from public, anon, authenticated;

select private.repair_string_payloads();
