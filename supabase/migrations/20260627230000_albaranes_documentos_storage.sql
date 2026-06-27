-- Albaranes: persistencia de documentos adjuntos (OCR del albarán del proveedor)
-- Antes el análisis OCR vivía solo en estado React y se perdía al recargar.

-- 1. Columna para los documentos adjuntos + su análisis (array JSON) ─────────
alter table public.albaranes add column if not exists documentos jsonb not null default '[]'::jsonb;

-- 2. Bucket privado para los archivos de albarán ────────────────────────────
insert into storage.buckets (id, name, public)
values ('logistica-albaranes', 'logistica-albaranes', false)
on conflict (id) do nothing;

-- 3. Políticas de acceso por empresa (1er segmento de la ruta = empresa_id) ──
drop policy if exists logistica_albaranes_read on storage.objects;
create policy logistica_albaranes_read on storage.objects for select
  using (
    bucket_id = 'logistica-albaranes'
    and ((storage.foldername(name))[1])::uuid in (
      select (p.empresa_id::text)::uuid from usuarios p where p.user_id = auth.uid()
    )
  );

drop policy if exists logistica_albaranes_insert on storage.objects;
create policy logistica_albaranes_insert on storage.objects for insert
  with check (
    bucket_id = 'logistica-albaranes'
    and ((storage.foldername(name))[1])::uuid in (
      select (p.empresa_id::text)::uuid from usuarios p where p.user_id = auth.uid()
    )
  );

drop policy if exists logistica_albaranes_update on storage.objects;
create policy logistica_albaranes_update on storage.objects for update
  using (
    bucket_id = 'logistica-albaranes'
    and ((storage.foldername(name))[1])::uuid in (
      select (p.empresa_id::text)::uuid from usuarios p where p.user_id = auth.uid()
    )
  );

drop policy if exists logistica_albaranes_delete on storage.objects;
create policy logistica_albaranes_delete on storage.objects for delete
  using (
    bucket_id = 'logistica-albaranes'
    and ((storage.foldername(name))[1])::uuid in (
      select (p.empresa_id::text)::uuid from usuarios p where p.user_id = auth.uid()
    )
  );
