-- ============================================================================
-- Alta a gestoría → subida de contrato → firma del empleado (PRP-068).
--
-- 1) Tabla `gestoria_contrato_tokens`: enlace tokenizado único por empleado que
--    se envía a la gestoría en el correo de alta. La gestoría sube por él el
--    contrato firmado (PDF). Single-use + expiración (igual que firmas_tokens).
-- 2) Bucket privado `contratos-gestoria` (staging del PDF que sube la gestoría
--    antes de convertirse en documento de firma del empleado).
-- 3) Config en `reclutamiento_config`:
--      - recordatorio a la gestoría (activo + nº de días sin subir el contrato)
--      - 4 toggles de notificación al departamento de RRHH (tick por evento).
-- Idempotente.
-- ============================================================================

-- 1) Tokens de subida de contrato por la gestoría --------------------------------
create table if not exists public.gestoria_contrato_tokens (
  id                 uuid primary key default gen_random_uuid(),
  empresa_id         uuid not null references public.empresas(id) on delete cascade,
  empleado_id        uuid not null references public.empleados(id) on delete cascade,
  token_hash         text not null,                 -- HMAC-SHA256 del token (PII)
  expira_en          timestamptz not null,
  -- Trazabilidad del ciclo de vida:
  alta_enviada_en    timestamptz not null default now(),  -- tick 1 (correo de alta)
  recordatorio_en    timestamptz,                         -- tick 2 (correo recordatorio)
  contrato_subido_en timestamptz,                         -- tick 3 (gestoría sube)
  contrato_path      text,                                -- staging en contratos-gestoria
  -- Documento de firma generado al subir el contrato (FK lógica a firmas_documentos):
  firma_documento_id uuid,
  created_at         timestamptz not null default now()
);

create index if not exists gestoria_contrato_tokens_hash_idx
  on public.gestoria_contrato_tokens (token_hash);
create index if not exists gestoria_contrato_tokens_empresa_idx
  on public.gestoria_contrato_tokens (empresa_id);
-- Para el cron de recordatorio: pendientes = sin subir y sin recordar todavía.
create index if not exists gestoria_contrato_tokens_pendientes_idx
  on public.gestoria_contrato_tokens (empresa_id, contrato_subido_en, recordatorio_en);

alter table public.gestoria_contrato_tokens enable row level security;

-- Solo lectura para usuarios de la empresa (la escritura va por service-role:
-- enlace público de la gestoría sin sesión + crons del sistema).
drop policy if exists gestoria_contrato_tokens_sel on public.gestoria_contrato_tokens;
create policy gestoria_contrato_tokens_sel on public.gestoria_contrato_tokens
  for select using (empresa_id in (select empresas_del_usuario()));

-- 2) Bucket privado para el PDF subido por la gestoría ---------------------------
insert into storage.buckets (id, name, public)
values ('contratos-gestoria', 'contratos-gestoria', false)
on conflict (id) do nothing;

-- 3) Config de reclutamiento ----------------------------------------------------
-- Recordatorio automático a la gestoría
alter table public.reclutamiento_config
  add column if not exists gestoria_recordatorio_activo boolean not null default true;
alter table public.reclutamiento_config
  add column if not exists gestoria_recordatorio_dias integer not null default 3;

-- Notificaciones al departamento de RRHH (un tick por evento del flujo)
alter table public.reclutamiento_config
  add column if not exists notif_alta_gestoria boolean not null default true;
alter table public.reclutamiento_config
  add column if not exists notif_recordatorio_gestoria boolean not null default true;
alter table public.reclutamiento_config
  add column if not exists notif_contrato_subido boolean not null default true;
alter table public.reclutamiento_config
  add column if not exists notif_contrato_firmado boolean not null default true;

comment on table public.gestoria_contrato_tokens is
  'Enlace tokenizado por empleado para que la gestoría suba el contrato firmado (PRP-068).';
comment on column public.reclutamiento_config.gestoria_recordatorio_dias is
  'Días sin subir el contrato tras los que se envía un recordatorio a la gestoría.';
