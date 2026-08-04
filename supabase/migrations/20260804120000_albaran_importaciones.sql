-- ============================================================
-- 20260804120000_albaran_importaciones.sql
-- PRP-073 Fase 1 (TASK-201): base fiable de importación de albaranes.
--
-- · albaran_importaciones: cada intento de subir un albarán por foto/archivo es
--   una IMPORTACIÓN persistente con estado, huella y evidencia de error. El
--   archivo sube DIRECTO a Storage (credencial firmada) y el OCR se ejecuta
--   desde Storage — el documento deja de viajar en base64 por Server Actions
--   (límite real ~10,5 MB que causaba fallos mudos en móvil).
-- · albaran_eventos: traza append-only de todo el ciclo (carga, OCR, retry,
--   creación, duplicados...). Sin UPDATE/DELETE: lo escrito, escrito está.
-- · albaranes.importacion_id: vínculo albarán → importación de origen.
--
-- Idempotente. RLS multiempresa vía helper canónico empresas_del_usuario().
-- ============================================================

-- 1. Importaciones ──────────────────────────────────────────────────────────
create table if not exists public.albaran_importaciones (
  id              uuid primary key default gen_random_uuid(),
  empresa_id      uuid not null,
  created_by      uuid,                                  -- auth.uid() del que sube
  flujo           text not null default 'libre',         -- alta libre o recepción de pedido
  pedido_id       uuid,                                  -- solo flujo 'pedido'
  albaran_id      uuid,                                  -- se rellena al crear el albarán
  estado          text not null default 'pendiente_subida',
  storage_path    text,                                  -- objeto en logistica-albaranes
  file_name       text,
  mime_type       text,
  size_bytes      bigint,
  archivo_sha256  text,                                  -- huella autoritativa (calculada en servidor)
  ocr_resultado   jsonb,                                 -- cabecera + líneas extraídas
  intentos        integer not null default 0,
  error_code      text,                                  -- código estable (FILE_TOO_LARGE, OCR_FAILED...)
  error_message   text,                                  -- mensaje en español para la persona
  trace_id        text,                                  -- correlación con logs de Vercel/Gemini
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  constraint albaran_imp_flujo_chk check (flujo in ('libre', 'pedido')),
  constraint albaran_imp_estado_chk check (
    estado in ('pendiente_subida', 'subido', 'analizando', 'revisable', 'error', 'finalizado')
  )
);

-- El mismo archivo (huella) solo puede haber producido UN albarán por empresa.
-- Parcial: mientras la importación no cuaje en albarán, se permite reintentar
-- (varias importaciones del mismo archivo pueden quedar en error/abandonadas).
create unique index if not exists uq_albaran_imp_sha_con_albaran
  on public.albaran_importaciones(empresa_id, archivo_sha256)
  where albaran_id is not null and archivo_sha256 is not null;

create index if not exists idx_albaran_imp_empresa_estado
  on public.albaran_importaciones(empresa_id, estado);
create index if not exists idx_albaran_imp_empresa_sha
  on public.albaran_importaciones(empresa_id, archivo_sha256);

alter table public.albaran_importaciones enable row level security;

drop policy if exists "albaran_imp_select" on public.albaran_importaciones;
drop policy if exists "albaran_imp_insert" on public.albaran_importaciones;
drop policy if exists "albaran_imp_update" on public.albaran_importaciones;

create policy "albaran_imp_select" on public.albaran_importaciones
  for select to authenticated
  using (empresa_id in (select empresas_del_usuario()));

create policy "albaran_imp_insert" on public.albaran_importaciones
  for insert to authenticated
  with check (empresa_id in (select empresas_del_usuario()));

create policy "albaran_imp_update" on public.albaran_importaciones
  for update to authenticated
  using (empresa_id in (select empresas_del_usuario()));

-- Sin policy de DELETE a propósito: las importaciones huérfanas se limpian por
-- mantenimiento (service role), no desde la app.

-- 2. Eventos (append-only) ──────────────────────────────────────────────────
create table if not exists public.albaran_eventos (
  id              uuid primary key default gen_random_uuid(),
  empresa_id      uuid not null,
  albaran_id      uuid,
  importacion_id  uuid,
  actor_id        uuid,                                  -- auth.uid(); null = sistema
  tipo            text not null,                         -- importacion_creada, subida_completada,
                                                         -- ocr_ok, ocr_error, reintento,
                                                         -- albaran_creado, duplicado_override...
  payload         jsonb,                                 -- NUNCA fichero, base64 ni secretos
  created_at      timestamptz not null default now()
);

create index if not exists idx_albaran_eventos_empresa
  on public.albaran_eventos(empresa_id, created_at desc);
create index if not exists idx_albaran_eventos_albaran
  on public.albaran_eventos(albaran_id) where albaran_id is not null;
create index if not exists idx_albaran_eventos_importacion
  on public.albaran_eventos(importacion_id) where importacion_id is not null;

alter table public.albaran_eventos enable row level security;

drop policy if exists "albaran_eventos_select" on public.albaran_eventos;
drop policy if exists "albaran_eventos_insert" on public.albaran_eventos;

create policy "albaran_eventos_select" on public.albaran_eventos
  for select to authenticated
  using (empresa_id in (select empresas_del_usuario()));

create policy "albaran_eventos_insert" on public.albaran_eventos
  for insert to authenticated
  with check (empresa_id in (select empresas_del_usuario()));

-- Append-only: sin policies de UPDATE ni DELETE.

-- 3. Vínculo en albaranes ───────────────────────────────────────────────────
alter table public.albaranes add column if not exists importacion_id uuid;

create index if not exists idx_albaranes_importacion
  on public.albaranes(importacion_id) where importacion_id is not null;
