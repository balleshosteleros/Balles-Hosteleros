-- ============================================================================
-- Fichajes — configuración del AVISO (pop-up) y del fichaje fuera de horario
-- ----------------------------------------------------------------------------
-- Extiende `empresa_fichajes_config` (Ajustes → Departamentos → RRHH →
-- submódulo "Fichajes") con ajustes por empresa para el aviso de fichar en el
-- móvil y para permitir fichar fuera de horario:
--
--   • popup_modo               : 'ventana' = el aviso solo salta ±margen de la
--                                hora prevista (entrada/salida) del día.
--                                'siempre' = salta siempre que falte fichar.
--   • popup_margen_antes_min   : minutos ANTES de la hora prevista en que ya
--                                salta el aviso (modo ventana).
--   • popup_margen_despues_min : minutos DESPUÉS de la hora prevista en que
--                                sigue saltando el aviso (modo ventana).
--   • popup_sin_horario        : si true, el aviso también salta a quien NO
--                                tiene horario asignado ese día (recordatorio).
--                                Si además no se permite fichar fuera de
--                                horario, es solo aviso (no le deja fichar).
--   • permitir_fuera_horario   : si true, el empleado puede fichar aunque esté
--                                fuera de su ventana o sin turno. En ese caso el
--                                sistema NO auto-paraliza la jornada por horario.
--
-- Valores por defecto = comportamiento actual (ventana ±15, sin avisos extra,
-- sin fichaje fuera de horario), así que ninguna empresa cambia sin tocarlo.
-- ============================================================================

alter table public.empresa_fichajes_config
  add column if not exists popup_modo               text    not null default 'ventana',
  add column if not exists popup_margen_antes_min   integer not null default 15,
  add column if not exists popup_margen_despues_min integer not null default 15,
  add column if not exists popup_sin_horario        boolean not null default false,
  add column if not exists permitir_fuera_horario   boolean not null default false;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'empresa_fichajes_config_popup_modo_chk'
  ) then
    alter table public.empresa_fichajes_config
      add constraint empresa_fichajes_config_popup_modo_chk
        check (popup_modo in ('ventana', 'siempre'));
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'empresa_fichajes_config_popup_margenes_chk'
  ) then
    alter table public.empresa_fichajes_config
      add constraint empresa_fichajes_config_popup_margenes_chk
        check (popup_margen_antes_min between 0 and 120
               and popup_margen_despues_min between 0 and 120);
  end if;
end $$;
