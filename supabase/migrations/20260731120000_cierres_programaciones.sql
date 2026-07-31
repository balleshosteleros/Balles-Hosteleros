-- ============================================================
-- 20260731120000_cierres_programaciones.sql
-- Reglas de cierre periódicas (estilo Google Calendar) para Gerencia → Cierres.
-- Cada regla define en qué días TOCA registrar un cierre:
--   · cada N semanas (1 = cada semana, 2 = quincenal, ...)
--   · uno o varios días de la semana (0=Lun .. 6=Dom, mismo orden que la UI)
--   · vigente desde fecha_inicio, opcionalmente hasta fecha_fin
-- La expansión a fechas concretas se hace en el backend/UI a partir de estas reglas.
-- Idempotente.
-- ============================================================

create table if not exists public.cierres_programaciones (
  id            uuid primary key default gen_random_uuid(),
  empresa_id    uuid not null,
  nombre        text not null default 'Cierre',
  intervalo_semanas smallint not null default 1,      -- cada N semanas
  dias_semana   smallint[] not null default '{}',     -- 0=Lun .. 6=Dom
  fecha_inicio  date not null,
  fecha_fin     date,                                  -- null = sin fin
  activo        boolean not null default true,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  constraint cierres_prog_intervalo_chk check (intervalo_semanas between 1 and 52)
);

create index if not exists idx_cierres_prog_empresa
  on public.cierres_programaciones(empresa_id);

alter table public.cierres_programaciones enable row level security;

drop policy if exists "cierres_prog_select" on public.cierres_programaciones;
drop policy if exists "cierres_prog_insert" on public.cierres_programaciones;
drop policy if exists "cierres_prog_update" on public.cierres_programaciones;
drop policy if exists "cierres_prog_delete" on public.cierres_programaciones;

-- RLS multiempresa vía helper canónico.
create policy "cierres_prog_select" on public.cierres_programaciones
  for select to authenticated
  using (empresa_id in (select empresas_del_usuario()));

create policy "cierres_prog_insert" on public.cierres_programaciones
  for insert to authenticated
  with check (empresa_id in (select empresas_del_usuario()));

create policy "cierres_prog_update" on public.cierres_programaciones
  for update to authenticated
  using (empresa_id in (select empresas_del_usuario()));

create policy "cierres_prog_delete" on public.cierres_programaciones
  for delete to authenticated
  using (empresa_id in (select empresas_del_usuario()));
