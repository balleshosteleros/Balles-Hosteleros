-- Fecha de fin en la ASIGNACIÓN de turno/patrón a un empleado.
-- vigente_hasta NULL = ilimitado (se repite indefinidamente).
-- Complementa vigente_desde. Al dar de baja a un empleado se recorta
-- automáticamente a la fecha de baja (ver recortarHorarioFuturoPorBaja).

alter table public.rrhh_turno_empleados
  add column if not exists vigente_hasta date;

alter table public.rrhh_patron_empleados
  add column if not exists vigente_hasta date;

comment on column public.rrhh_turno_empleados.vigente_hasta is
  'Último día en que la asignación del turno al empleado es válida. NULL = ilimitado. Se recorta a la fecha de baja al causar baja el empleado.';
comment on column public.rrhh_patron_empleados.vigente_hasta is
  'Último día en que la asignación del patrón al empleado es válida. NULL = ilimitado. Se recorta a la fecha de baja al causar baja el empleado.';

-- Backfill inicial: de momento todo el horario recurrente arranca el 1 de
-- septiembre de 2026 y queda sin fecha de fin (ilimitado). Se reajustará por
-- empleado desde la UI y se recortará automáticamente al causar baja.
update public.rrhh_turno_empleados
  set vigente_desde = date '2026-09-01',
      vigente_hasta = null;

update public.rrhh_patron_empleados
  set vigente_desde = date '2026-09-01',
      vigente_hasta = null;
