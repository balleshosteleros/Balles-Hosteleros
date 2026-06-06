-- Simplifica el estado del empleado a dos valores: 'Activo' / 'Desactivado'.
-- Antes existian 'Baja temporal' / 'Baja definitiva' (y 'Excedencia' historico).
-- 'Desactivado' sigue exigiendo fecha_baja; el trigger empleado_esta_activo ya
-- pone profiles.estado_acceso = 'Inactivo' para cualquier estado != 'Activo',
-- de modo que un empleado desactivado no puede iniciar sesion.

-- 1) Soltar el constraint combinado vigente (estado + fecha_baja).
alter table public.empleados
  drop constraint if exists empleados_estado_check;

-- 2) Migrar datos existentes: cualquier estado distinto de 'Activo' -> 'Desactivado'.
--    Garantiza fecha_baja para las filas desactivadas (constraint nuevo lo exige).
update public.empleados
   set estado = 'Desactivado',
       fecha_baja = coalesce(fecha_baja, current_date)
 where estado <> 'Activo';

-- 3) Reponer el constraint con el catalogo simplificado.
alter table public.empleados
  add constraint empleados_estado_check
  check (
    (estado = 'Activo' and fecha_baja is null)
    or (estado = 'Desactivado' and fecha_baja is not null)
  );
