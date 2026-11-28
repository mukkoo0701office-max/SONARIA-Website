-- 申込に添付する楽譜 PDF（決済導入 Phase 5）
-- 設計: docs/payments/PAYMENTS_DESIGN.md「7. 楽譜 PDF のアップロード」
-- 方針:
--   - 非公開のバケット submission-files。PDF だけ・1 ファイル 20 MB まで（バケットの設定でサーバー側が拒否する）
--   - アップロードは Edge Function（upload-url）が発行する 1 回限りの署名付き URL だけで行う。利用者は一覧も読み取りもできない
--   - 読めるのは管理人だけ（短時間の署名付き URL を管理画面で発行する）
--   - 送信回数制限は申込と同じ考え方（IP はソルト付きハッシュだけ保存）

-- ── バケット（Storage が有効な環境だけ。CI のローカル環境でも有効にしている） ─────────
do $$
begin
  if to_regclass('storage.buckets') is not null then
    insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
    values ('submission-files', 'submission-files', false, 20971520, array['application/pdf'])
    on conflict (id) do update set public = false, file_size_limit = 20971520, allowed_mime_types = array['application/pdf'];

    -- 管理人だけが読める（署名付き URL の発行に必要）。書き込み・削除のポリシーは作らない（署名付きアップロードだけ）
    execute 'drop policy if exists "submission_files_admin_read" on storage.objects';
    execute $p$create policy "submission_files_admin_read" on storage.objects for select to authenticated
             using (bucket_id = 'submission-files' and public.is_admin())$p$;
  end if;
end;
$$;

-- ── アップロード URL の発行回数の制限（送信元ごと・1 時間あたり） ───────────────
create or replace function private.allow_upload(p_ip text, p_max_per_hour integer)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_hash text;
  v_bucket timestamptz := date_trunc('hour', now());
  v_hits integer;
begin
  -- 申込の制限とは別に数える（ハッシュの材料に用途を混ぜる）
  select encode(sha256(convert_to('upload:' || coalesce(p_ip, '') || st.value, 'UTF8')), 'hex') into v_hash
    from private.settings st where st.key = 'rate_limit_salt';
  insert into private.rate_limits as rl (ip_hash, bucket, hits) values (v_hash, v_bucket, 1)
    on conflict (ip_hash, bucket) do update set hits = rl.hits + 1
    returning rl.hits into v_hits;
  return v_hits <= p_max_per_hour;
end;
$$;
revoke all on function private.allow_upload(text, integer) from public, anon, authenticated;
