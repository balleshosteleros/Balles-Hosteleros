-- ============================================================
-- 047_storage_buckets_juridico_cronogramas.sql
--
-- Crea los buckets de Supabase Storage necesarios para:
--   - documentos-juridicos: adjuntos de expedientes jurídicos (privado)
--   - cronogramas-videos:   vídeos de cronogramas operativos (privado)
-- ============================================================

-- Bucket para documentos jurídicos (privado, requiere auth)
insert into storage.buckets (id, name, public)
values ('documentos-juridicos', 'documentos-juridicos', false)
on conflict (id) do nothing;

-- Bucket para vídeos de cronogramas operativos (privado)
insert into storage.buckets (id, name, public)
values ('cronogramas-videos', 'cronogramas-videos', false)
on conflict (id) do nothing;

-- RLS: solo usuarios autenticados pueden subir/leer sus propios archivos

-- documentos-juridicos
create policy if not exists "auth_select_docs_juridicos"
  on storage.objects for select
  using (bucket_id = 'documentos-juridicos' and auth.role() = 'authenticated');

create policy if not exists "auth_insert_docs_juridicos"
  on storage.objects for insert
  with check (bucket_id = 'documentos-juridicos' and auth.role() = 'authenticated');

create policy if not exists "auth_delete_docs_juridicos"
  on storage.objects for delete
  using (bucket_id = 'documentos-juridicos' and auth.role() = 'authenticated');

-- cronogramas-videos
create policy if not exists "auth_select_cronogramas_videos"
  on storage.objects for select
  using (bucket_id = 'cronogramas-videos' and auth.role() = 'authenticated');

create policy if not exists "auth_insert_cronogramas_videos"
  on storage.objects for insert
  with check (bucket_id = 'cronogramas-videos' and auth.role() = 'authenticated');

create policy if not exists "auth_delete_cronogramas_videos"
  on storage.objects for delete
  using (bucket_id = 'cronogramas-videos' and auth.role() = 'authenticated');
