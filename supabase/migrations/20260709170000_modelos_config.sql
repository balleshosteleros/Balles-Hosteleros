-- ============================================================
-- 20260709170000_modelos_config.sql — PRP-072
-- Config del submódulo Gestoría → Modelos, una fila por empresa.
--   - tipos_activos: qué tipos de modelo se muestran/generan.
--   - emails a la gestoría (trimestral / anual) con offset de días
--     respecto a la fecha límite de presentación.
-- Patrón: reclutamiento_config (upsert onConflict empresa_id).
-- Idempotente.
-- ============================================================

create table if not exists public.modelos_config (
  empresa_id             uuid primary key references public.empresas(id) on delete cascade,
  -- NULL = todos los tipos activos (comportamiento por defecto).
  tipos_activos          text[],
  -- Email a la gestoría para modelos TRIMESTRALES.
  email_trim_activo      boolean not null default false,
  email_trim_dias_offset integer not null default 1,
  -- Email a la gestoría para modelos ANUALES.
  email_anual_activo     boolean not null default false,
  email_anual_dias_offset integer not null default 1,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now()
);

alter table public.modelos_config enable row level security;

drop policy if exists "modelos_config_empresa" on public.modelos_config;
create policy "modelos_config_empresa" on public.modelos_config
  for all to authenticated
  using (
    empresa_id in (select p.empresa_id from public.usuarios p where p.user_id = auth.uid())
    or empresa_id in (select ue.empresa_id from public.usuario_empresas ue where ue.user_id = auth.uid())
  )
  with check (
    empresa_id in (select p.empresa_id from public.usuarios p where p.user_id = auth.uid())
    or empresa_id in (select ue.empresa_id from public.usuario_empresas ue where ue.user_id = auth.uid())
  );

drop trigger if exists modelos_config_updated_at on public.modelos_config;
create trigger modelos_config_updated_at
  before update on public.modelos_config
  for each row execute function public.set_updated_at();
