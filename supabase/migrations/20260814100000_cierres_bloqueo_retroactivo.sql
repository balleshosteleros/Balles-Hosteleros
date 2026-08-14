-- ============================================================
-- 20260814100000_cierres_bloqueo_retroactivo.sql
-- Cierres: BLOQUEO DE APUNTES RETROACTIVOS.
-- No se puede meter ningún apunte (cierre, retirada o ingreso) con más
-- de N días de retraso. Dirección SIEMPRE puede. Además se puede
-- autorizar a UN rol concreto a saltarse el plazo.
--
-- dias_bloqueo: 0 = sin bloqueo (todo permitido). Por defecto 7.
-- rol_excepcion_id: rol (además de dirección) que puede saltarse el
--   plazo. NULL = solo dirección.
-- Idempotente.
-- ============================================================

alter table public.cierres_config
  add column if not exists dias_bloqueo smallint not null default 7;

alter table public.cierres_config
  add column if not exists rol_excepcion_id uuid references public.empresa_roles(id) on delete set null;

-- Plazo razonable: de 0 (sin bloqueo) a 365 días.
alter table public.cierres_config
  drop constraint if exists cierres_config_dias_bloqueo_chk;

alter table public.cierres_config
  add constraint cierres_config_dias_bloqueo_chk
  check (dias_bloqueo >= 0 and dias_bloqueo <= 365);
