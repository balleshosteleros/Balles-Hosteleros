-- ============================================================
-- 048_juridico_documentos_storage.sql
-- Storage privado para documentos jurídicos + columnas
-- adicionales en documentos_juridicos para soportar la UI.
-- ============================================================

-- ─── 1. STORAGE BUCKET (PRIVADO) ───────────────────────────
insert into storage.buckets (id, name, public)
values ('juridico-documentos', 'juridico-documentos', false)
on conflict (id) do nothing;

-- Path layout: <empresa_id>/<proceso_id>/<filename>
drop policy if exists "juridico_docs_read"    on storage.objects;
drop policy if exists "juridico_docs_insert"  on storage.objects;
drop policy if exists "juridico_docs_update"  on storage.objects;
drop policy if exists "juridico_docs_delete"  on storage.objects;

create policy "juridico_docs_read" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'juridico-documentos'
    and (storage.foldername(name))[1] in (
      select p.empresa_id::text from public.profiles p where p.user_id = auth.uid()
    )
  );

create policy "juridico_docs_insert" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'juridico-documentos'
    and (storage.foldername(name))[1] in (
      select p.empresa_id::text from public.profiles p where p.user_id = auth.uid()
    )
  );

create policy "juridico_docs_update" on storage.objects
  for update to authenticated
  using (
    bucket_id = 'juridico-documentos'
    and (storage.foldername(name))[1] in (
      select p.empresa_id::text from public.profiles p where p.user_id = auth.uid()
    )
  );

create policy "juridico_docs_delete" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'juridico-documentos'
    and (storage.foldername(name))[1] in (
      select p.empresa_id::text from public.profiles p where p.user_id = auth.uid()
    )
  );

-- ─── 2. COLUMNAS ADICIONALES ──────────────────────────────
alter table public.documentos_juridicos
  add column if not exists storage_path     text,
  add column if not exists size_bytes       bigint,
  add column if not exists actualizacion_id text;

create index if not exists idx_docjur_actualizacion
  on public.documentos_juridicos(actualizacion_id)
  where actualizacion_id is not null;
