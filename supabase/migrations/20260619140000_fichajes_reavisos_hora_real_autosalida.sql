-- ============================================================================
-- PRP-060 — Fichajes: reavisos push, hora real vs oficial, auto-fichar salida,
--           sonido/vibración del aviso.
-- ----------------------------------------------------------------------------
-- Todo configurable por empresa. Defaults = comportamiento actual (nada cambia
-- sin tocar la config en Ajustes → Departamentos → RRHH → "Fichajes").
-- ============================================================================

-- 1) Nuevos ajustes por empresa --------------------------------------------------
alter table public.empresa_fichajes_config
  add column if not exists reaviso_activo          boolean not null default false,
  add column if not exists reaviso_intervalo_min   integer not null default 5,
  add column if not exists aviso_sonido            boolean not null default false,
  add column if not exists aviso_vibracion         boolean not null default false,
  add column if not exists auto_salida_activa      boolean not null default false,
  add column if not exists auto_salida_margen_min  integer not null default 15;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'empresa_fichajes_config_reaviso_intervalo_chk'
  ) then
    alter table public.empresa_fichajes_config
      add constraint empresa_fichajes_config_reaviso_intervalo_chk
        check (reaviso_intervalo_min between 1 and 60);
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'empresa_fichajes_config_auto_salida_margen_chk'
  ) then
    alter table public.empresa_fichajes_config
      add constraint empresa_fichajes_config_auto_salida_margen_chk
        check (auto_salida_margen_min between 0 and 120);
  end if;
end $$;

-- 2) Hora real vs oficial en fichajes -------------------------------------------
-- `hora_entrada`/`hora_salida` quedan como la OFICIAL (redondeada, la que cuenta
-- para el contador y horas_totales). `hora_*_real` = instante físico del fichaje
-- (informativa). Nullable: los fichajes antiguos quedan en null.
alter table public.fichajes
  add column if not exists hora_entrada_real timestamptz,
  add column if not exists hora_salida_real  timestamptz;

-- 3) Idempotencia del reaviso ---------------------------------------------------
-- Una fila por (empleado, fecha, slot de minutos respecto a su hora de entrada).
-- El cron de cada minuto inserta antes de enviar; el UNIQUE evita duplicar el
-- mismo slot aunque el cron se solape o reintente.
create table if not exists public.fichaje_reavisos_log (
  id          uuid primary key default gen_random_uuid(),
  empresa_id  uuid not null references public.empresas(id) on delete cascade,
  user_id     uuid not null,
  fecha       date not null,
  slot_min    integer not null,
  sent_at     timestamptz not null default now(),
  constraint fichaje_reavisos_log_uniq unique (user_id, fecha, slot_min)
);

create index if not exists fichaje_reavisos_log_empresa_fecha_idx
  on public.fichaje_reavisos_log (empresa_id, fecha);

alter table public.fichaje_reavisos_log enable row level security;

drop policy if exists fichaje_reavisos_log_rw on public.fichaje_reavisos_log;
create policy fichaje_reavisos_log_rw on public.fichaje_reavisos_log
  for all to authenticated
  using (empresa_id in (select empresas_del_usuario()))
  with check (empresa_id in (select empresas_del_usuario()));
