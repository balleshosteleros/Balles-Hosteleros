-- ============================================================
-- 044_marketing_campanas.sql — Submódulo Campañas (Marketing)
--
-- Tabla única `campanas_marketing` que almacena los 3 canales
-- (email, whatsapp, meta) con un campo JSONB `payload` que contiene
-- la configuración específica de cada canal.
--
-- Por qué una sola tabla:
--  - Los 3 canales comparten 90% de campos (nombre, estado, empresa,
--    estadísticas, fechas). Unificar simplifica el listado, filtros
--    y dashboards.
--  - El payload JSONB permite evolucionar la configuración de cada
--    canal sin migraciones extra.
--
-- Reutiliza: empresas, profiles
-- Idempotente: DO $$ ... $$ para enums, IF NOT EXISTS para tablas
-- ============================================================

-- ─── 0. Enums ────────────────────────────────────────────────
do $$ begin
  create type canal_campana as enum ('email', 'whatsapp', 'meta');
exception when duplicate_object then null; end $$;

do $$ begin
  create type estado_campana as enum (
    'borrador', 'programada', 'activa', 'pausada', 'finalizada', 'fallida'
  );
exception when duplicate_object then null; end $$;

-- ─── 1. Tabla principal ──────────────────────────────────────
create table if not exists public.campanas_marketing (
  id                uuid primary key default gen_random_uuid(),
  empresa_id        uuid not null references public.empresas(id) on delete cascade,
  canal             canal_campana not null,
  nombre            text not null,
  estado            estado_campana not null default 'borrador',
  segmento          text,
  fecha_envio       timestamptz,
  fecha_inicio      timestamptz,
  fecha_fin         timestamptz,
  -- Configuración canal-específica (asunto, cuerpo, plantilla,
  -- objetivo, presupuesto, público, creatividad...)
  payload           jsonb not null default '{}'::jsonb,
  -- Estadísticas (enviados, abiertos, clicks, gasto...)
  estadisticas      jsonb not null default '{}'::jsonb,
  -- Referencias externas (Meta, Resend, WhatsApp)
  meta_campaign_id  text,
  meta_adset_id     text,
  meta_ad_id        text,
  meta_synced_at    timestamptz,
  meta_sync_error   text,
  resend_batch_id   text,
  whatsapp_job_id   text,
  -- Metadatos
  created_by        uuid references auth.users(id),
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index if not exists idx_campanas_empresa on public.campanas_marketing (empresa_id);
create index if not exists idx_campanas_canal   on public.campanas_marketing (empresa_id, canal);
create index if not exists idx_campanas_estado  on public.campanas_marketing (empresa_id, estado);

-- ─── 2. Trigger updated_at ───────────────────────────────────
create or replace function public.campanas_set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_campanas_updated_at on public.campanas_marketing;
create trigger trg_campanas_updated_at
  before update on public.campanas_marketing
  for each row execute function public.campanas_set_updated_at();

-- ─── 3. RLS ──────────────────────────────────────────────────
alter table public.campanas_marketing enable row level security;

drop policy if exists campanas_select_own on public.campanas_marketing;
create policy campanas_select_own on public.campanas_marketing
  for select using (
    empresa_id in (
      select empresa_id from public.profiles where user_id = auth.uid()
    )
  );

drop policy if exists campanas_insert_own on public.campanas_marketing;
create policy campanas_insert_own on public.campanas_marketing
  for insert with check (
    empresa_id in (
      select empresa_id from public.profiles where user_id = auth.uid()
    )
  );

drop policy if exists campanas_update_own on public.campanas_marketing;
create policy campanas_update_own on public.campanas_marketing
  for update using (
    empresa_id in (
      select empresa_id from public.profiles where user_id = auth.uid()
    )
  );

drop policy if exists campanas_delete_own on public.campanas_marketing;
create policy campanas_delete_own on public.campanas_marketing
  for delete using (
    empresa_id in (
      select empresa_id from public.profiles where user_id = auth.uid()
    )
  );

comment on table public.campanas_marketing is
  'Campañas de marketing multi-canal (email, whatsapp, meta). El payload JSONB contiene la configuración específica de cada canal.';
