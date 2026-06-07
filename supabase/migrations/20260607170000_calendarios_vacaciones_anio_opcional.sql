-- Calendario de vacaciones PREDETERMINADO: anio pasa a ser opcional.
-- anio = null  → el calendario se aplica TODOS los años (referencia perpetua):
--   · los días totales rigen para cualquier año
--   · los periodos bloqueados se repiten cada año (cuentan día y mes)
-- anio = 2026  → calendario específico de ese año (comportamiento original).
alter table public.rrhh_calendarios_vacaciones
  alter column anio drop not null;

comment on column public.rrhh_calendarios_vacaciones.anio is
  'Año al que aplica el calendario. NULL = predeterminado: se usa como referencia todos los años (días y bloqueos recurrentes por día/mes).';
