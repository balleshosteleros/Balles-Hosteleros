-- ============================================================
-- rrhh_turnos.flex_modo
-- Solo aplica a turnos flexibles. Define el ámbito del objetivo de horas y
-- del autocierre del fichaje:
--   'diario'  → objetivo = horas de ese día (flex_horas[díaSemana]); al
--               alcanzarlas se cierra el fichaje y no puede volver a fichar
--               hasta el día siguiente. Reinicia cada día.
--   'semanal' → objetivo = suma semanal (flex_horas); puede fichar esas horas
--               cuando quiera (incluso del tirón); al alcanzar el total semanal
--               se cierra y no puede volver hasta el lunes siguiente.
-- ============================================================

alter table public.rrhh_turnos
  add column if not exists flex_modo text not null default 'diario'
  check (flex_modo in ('diario', 'semanal'));

comment on column public.rrhh_turnos.flex_modo is
  'Ámbito del objetivo de horas de un turno flexible: diario (reinicia cada día) o semanal (bolsa semanal, reinicia el lunes). Ignorado en turnos fijos.';
