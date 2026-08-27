-- PRP-081 — Importador de Google Drive → Archivos.
-- Aplicada en producción el 2026-08-27. Idempotente.
--
-- Trae el contenido de las unidades compartidas de Drive a R2, replicando la
-- estructura tal cual, para poder dejar de pagar Google Workspace (PRP-077).

-- Marca del origen: permite saltar lo ya importado si el proceso se corta o se
-- relanza. Sin esto, reanudar duplicaría miles de archivos.
alter table public.documentos
  add column if not exists drive_file_id text;

create unique index if not exists documentos_drive_file_uk
  on public.documentos (empresa_id, drive_file_id)
  where drive_file_id is not null;

-- Una fila por importación. Alimenta la pantalla de progreso y el informe
-- final que hay que revisar ANTES de cancelar nada en Google.
create table if not exists public.archivos_importaciones (
  id                uuid primary key default gen_random_uuid(),
  -- Empresa destino. Se elige SIEMPRE de forma explícita: BACANAL y HABANA no
  -- comparten ningún dato.
  empresa_id        uuid not null references public.empresas(id) on delete cascade,
  unidad_id         text not null,
  unidad_nombre     text not null,
  -- Carpeta de primer nivel de Drive → departamento del software.
  mapeo             jsonb not null default '{}'::jsonb,
  estado            text not null default 'pendiente'
                      check (estado in ('pendiente','en_curso','terminada','parada','error')),
  total_archivos    int  not null default 0,
  total_bytes       bigint not null default 0,
  copiados          int  not null default 0,
  copiados_bytes    bigint not null default 0,
  omitidos          int  not null default 0,
  fallidos          int  not null default 0,
  -- Detalle de cada archivo que falló, para el informe de verificación.
  errores           jsonb not null default '[]'::jsonb,
  creado_por        uuid references auth.users(id) on delete set null,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index if not exists archivos_importaciones_empresa_idx
  on public.archivos_importaciones (empresa_id, created_at desc);

alter table public.archivos_importaciones enable row level security;

-- Mismo patrón de aislamiento por empresa que el resto del proyecto (UNION de
-- usuario_empresas y usuarios).
drop policy if exists archivos_importaciones_all on public.archivos_importaciones;
create policy archivos_importaciones_all on public.archivos_importaciones
  for all
  using (
    exists (select 1 from public.usuario_empresas ue
             where ue.user_id = (select auth.uid())
               and ue.empresa_id = archivos_importaciones.empresa_id)
    or exists (select 1 from public.usuarios u
                where u.user_id = (select auth.uid())
                  and u.empresa_id = archivos_importaciones.empresa_id)
  );
