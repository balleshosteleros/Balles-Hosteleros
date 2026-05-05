-- ============================================================
-- 068_empleados_estado_constraint.sql
-- Reglas duras de baja en RRHH:
--   • Solo dos estados de baja: 'Baja temporal' o 'Baja definitiva'.
--   • Para cambiar a baja, hay que rellenar `fecha_baja` (la fecha
--     concreta da igual — pasada o futura — pero el dato debe estar).
--   • Si el empleado está 'Activo', `fecha_baja` debe quedar nula.
--
-- También simplificamos el helper empleado_esta_activo para que
-- solo mire `estado` (la fecha pierde su rol de filtro).
-- ============================================================

alter table public.empleados
  drop constraint if exists empleados_estado_check;

alter table public.empleados
  add constraint empleados_estado_check
  check (
    (estado = 'Activo' and fecha_baja is null)
    or (estado in ('Baja temporal', 'Baja definitiva') and fecha_baja is not null)
  );

-- empleado activo = estado='Activo'. Punto. La fecha es irrelevante.
create or replace function public.empleado_esta_activo(
  p_estado text,
  p_fecha_baja date
)
returns boolean
language sql
immutable
as $$
  select p_estado = 'Activo';
$$;

comment on function public.empleado_esta_activo(text, date) is
  'true sólo si estado=Activo. fecha_baja se mantiene como parámetro por compatibilidad pero no se evalúa.';
