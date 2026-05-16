-- ============================================================
-- 20260513170000_gerencia_informes.sql
-- Submódulo INFORMES (Gerencia):
--   Registro de informes con importe (positivo/negativo),
--   documento adjunto y agrupación por tipo (descuentos,
--   cancelaciones, inventarios, menu_ingeniering).
--   Permite construir histórico mensual y gráfica por tipo.
-- ============================================================

-- ─── 1. TABLA informes_gerencia ──────────────────────────────
create table if not exists public.informes_gerencia (
  id              uuid primary key default gen_random_uuid(),
  empresa_id      uuid not null,
  tipo            text not null check (tipo in (
                    'descuentos',
                    'cancelaciones',
                    'inventarios',
                    'menu_ingeniering'
                  )),
  fecha           date not null,
  importe         numeric(14,2) not null default 0,  -- admite negativos
  observaciones   text,
  storage_path    text,
  file_name       text,
  size_bytes      bigint,
  mime_type       text,
  registrado_por  text,
  registrado_por_uid uuid,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists idx_informes_empresa_tipo_fecha
  on public.informes_gerencia(empresa_id, tipo, fecha desc);

create index if not exists idx_informes_empresa_fecha
  on public.informes_gerencia(empresa_id, fecha desc);

alter table public.informes_gerencia enable row level security;

drop policy if exists "informes_select" on public.informes_gerencia;
drop policy if exists "informes_insert" on public.informes_gerencia;
drop policy if exists "informes_update" on public.informes_gerencia;
drop policy if exists "informes_delete" on public.informes_gerencia;

create policy "informes_select" on public.informes_gerencia
  for select to authenticated
  using (
    empresa_id in (
      select p.empresa_id from public.profiles p where p.user_id = auth.uid()
    )
  );

create policy "informes_insert" on public.informes_gerencia
  for insert to authenticated
  with check (
    empresa_id in (
      select p.empresa_id from public.profiles p where p.user_id = auth.uid()
    )
  );

create policy "informes_update" on public.informes_gerencia
  for update to authenticated
  using (
    empresa_id in (
      select p.empresa_id from public.profiles p where p.user_id = auth.uid()
    )
  );

create policy "informes_delete" on public.informes_gerencia
  for delete to authenticated
  using (
    empresa_id in (
      select p.empresa_id from public.profiles p where p.user_id = auth.uid()
    )
  );

-- ─── 2. STORAGE BUCKET (PRIVADO) ─────────────────────────────
insert into storage.buckets (id, name, public)
values ('gerencia-informes', 'gerencia-informes', false)
on conflict (id) do nothing;

drop policy if exists "informes_docs_read"   on storage.objects;
drop policy if exists "informes_docs_insert" on storage.objects;
drop policy if exists "informes_docs_update" on storage.objects;
drop policy if exists "informes_docs_delete" on storage.objects;

-- Path layout: <empresa_id>/<informe_id>/<filename>
create policy "informes_docs_read" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'gerencia-informes'
    and (storage.foldername(name))[1] in (
      select p.empresa_id::text from public.profiles p where p.user_id = auth.uid()
    )
  );

create policy "informes_docs_insert" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'gerencia-informes'
    and (storage.foldername(name))[1] in (
      select p.empresa_id::text from public.profiles p where p.user_id = auth.uid()
    )
  );

create policy "informes_docs_update" on storage.objects
  for update to authenticated
  using (
    bucket_id = 'gerencia-informes'
    and (storage.foldername(name))[1] in (
      select p.empresa_id::text from public.profiles p where p.user_id = auth.uid()
    )
  );

create policy "informes_docs_delete" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'gerencia-informes'
    and (storage.foldername(name))[1] in (
      select p.empresa_id::text from public.profiles p where p.user_id = auth.uid()
    )
  );
