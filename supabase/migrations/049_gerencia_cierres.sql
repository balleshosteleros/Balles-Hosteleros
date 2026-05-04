-- ============================================================
-- 049_gerencia_cierres.sql
-- Submódulo CIERRES (Gerencia): cierres semanales con documento
-- adjunto + configuración de día prefijado por empresa.
-- ============================================================

-- ─── 1. TABLA cierres_semanales ──────────────────────────────
create table if not exists public.cierres_semanales (
  id                uuid primary key default gen_random_uuid(),
  empresa_id        uuid not null,
  fecha             date not null,
  semana_iso        text,                       -- ej: "2026-W18"
  efectivo_retirado numeric(12,2) not null default 0,
  total_contado     numeric(12,2) not null default 0,
  cuadra            boolean not null default true,
  descuadre         numeric(12,2) not null default 0,  -- positivo = sobra; negativo = falta
  notas             text,
  storage_path      text,
  file_name         text,
  size_bytes        bigint,
  mime_type         text,
  registrado_por    text,
  registrado_por_uid uuid,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index if not exists idx_cierres_empresa_fecha
  on public.cierres_semanales(empresa_id, fecha desc);

create index if not exists idx_cierres_semana
  on public.cierres_semanales(empresa_id, semana_iso);

alter table public.cierres_semanales enable row level security;

drop policy if exists "cierres_select" on public.cierres_semanales;
drop policy if exists "cierres_insert" on public.cierres_semanales;
drop policy if exists "cierres_update" on public.cierres_semanales;
drop policy if exists "cierres_delete" on public.cierres_semanales;

create policy "cierres_select" on public.cierres_semanales
  for select to authenticated
  using (
    empresa_id in (
      select p.empresa_id from public.profiles p where p.user_id = auth.uid()
    )
  );

create policy "cierres_insert" on public.cierres_semanales
  for insert to authenticated
  with check (
    empresa_id in (
      select p.empresa_id from public.profiles p where p.user_id = auth.uid()
    )
  );

create policy "cierres_update" on public.cierres_semanales
  for update to authenticated
  using (
    empresa_id in (
      select p.empresa_id from public.profiles p where p.user_id = auth.uid()
    )
  );

create policy "cierres_delete" on public.cierres_semanales
  for delete to authenticated
  using (
    empresa_id in (
      select p.empresa_id from public.profiles p where p.user_id = auth.uid()
    )
  );

-- ─── 2. TABLA cierres_config ─────────────────────────────────
-- modo:
--   'fijo'  → dia_semana 0..6 (0=lunes ... 6=domingo) prefijado
--   'libre' → sin día prefijado; se marca el día en el calendario al registrar
create table if not exists public.cierres_config (
  empresa_id uuid primary key,
  modo       text not null default 'libre' check (modo in ('fijo','libre')),
  dia_semana smallint check (dia_semana between 0 and 6),
  updated_at timestamptz not null default now()
);

alter table public.cierres_config enable row level security;

drop policy if exists "cierres_cfg_select" on public.cierres_config;
drop policy if exists "cierres_cfg_upsert" on public.cierres_config;
drop policy if exists "cierres_cfg_update" on public.cierres_config;

create policy "cierres_cfg_select" on public.cierres_config
  for select to authenticated
  using (
    empresa_id in (
      select p.empresa_id from public.profiles p where p.user_id = auth.uid()
    )
  );

create policy "cierres_cfg_upsert" on public.cierres_config
  for insert to authenticated
  with check (
    empresa_id in (
      select p.empresa_id from public.profiles p where p.user_id = auth.uid()
    )
  );

create policy "cierres_cfg_update" on public.cierres_config
  for update to authenticated
  using (
    empresa_id in (
      select p.empresa_id from public.profiles p where p.user_id = auth.uid()
    )
  );

-- ─── 3. STORAGE BUCKET (PRIVADO) ─────────────────────────────
insert into storage.buckets (id, name, public)
values ('cierres-documentos', 'cierres-documentos', false)
on conflict (id) do nothing;

drop policy if exists "cierres_docs_read"   on storage.objects;
drop policy if exists "cierres_docs_insert" on storage.objects;
drop policy if exists "cierres_docs_update" on storage.objects;
drop policy if exists "cierres_docs_delete" on storage.objects;

-- Path layout: <empresa_id>/<cierre_id>/<filename>
create policy "cierres_docs_read" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'cierres-documentos'
    and (storage.foldername(name))[1] in (
      select p.empresa_id::text from public.profiles p where p.user_id = auth.uid()
    )
  );

create policy "cierres_docs_insert" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'cierres-documentos'
    and (storage.foldername(name))[1] in (
      select p.empresa_id::text from public.profiles p where p.user_id = auth.uid()
    )
  );

create policy "cierres_docs_update" on storage.objects
  for update to authenticated
  using (
    bucket_id = 'cierres-documentos'
    and (storage.foldername(name))[1] in (
      select p.empresa_id::text from public.profiles p where p.user_id = auth.uid()
    )
  );

create policy "cierres_docs_delete" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'cierres-documentos'
    and (storage.foldername(name))[1] in (
      select p.empresa_id::text from public.profiles p where p.user_id = auth.uid()
    )
  );
