-- ============================================================================
-- Configuración general de fichajes por empresa (Ajustes RRHH → Fichajes)
-- ----------------------------------------------------------------------------
-- Política de margen de fichaje respecto a la HORA DE INICIO del turno del día:
--   • permitir_antes   : permite fichar antes de la hora del turno.
--   • margen_antes_min : cuántos minutos antes (5–30, paso 5).
--   • permitir_despues : permite fichar después (llegar tarde) de la hora.
--   • margen_despues_min: cuántos minutos después (5–30, paso 5).
--   • redondear_antes  : si llega antes y se ficha dentro de margen, registra la
--                        hora EXACTA del turno (en vez de la hora real).
--   • redondear_despues: igual si llega tarde dentro de margen.
--
-- Fuera de [inicio − antes, inicio + después] no se permite fichar; el empleado
-- puede pedir una solicitud para que se validen las horas.
-- ============================================================================

create table if not exists public.empresa_fichajes_config (
  empresa_id         uuid primary key references public.empresas(id) on delete cascade,
  permitir_antes     boolean not null default true,
  margen_antes_min   integer not null default 15,
  permitir_despues   boolean not null default true,
  margen_despues_min integer not null default 15,
  redondear_antes    boolean not null default true,
  redondear_despues  boolean not null default false,
  updated_at         timestamptz not null default now(),
  constraint empresa_fichajes_config_margenes_chk
    check (margen_antes_min between 0 and 120 and margen_despues_min between 0 and 120)
);

alter table public.empresa_fichajes_config enable row level security;

drop policy if exists empresa_fichajes_config_rw on public.empresa_fichajes_config;
create policy empresa_fichajes_config_rw on public.empresa_fichajes_config
  for all to authenticated
  using (empresa_id in (select empresas_del_usuario()))
  with check (empresa_id in (select empresas_del_usuario()));
