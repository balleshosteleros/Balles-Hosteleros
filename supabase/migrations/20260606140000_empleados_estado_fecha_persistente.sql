-- La fecha de baja debe quedar siempre reflejada, incluso tras reactivar al
-- empleado (estado = 'Activo'). Antes el constraint exigia fecha_baja NULL en
-- 'Activo', lo que borraba el historico al darle de alta de nuevo.
-- Nuevo constraint: 'Desactivado' sigue exigiendo fecha; 'Activo' la permite
-- (null si nunca estuvo de baja, o la ultima baja como historico).

alter table public.empleados
  drop constraint if exists empleados_estado_check;

alter table public.empleados
  add constraint empleados_estado_check
  check (
    estado = 'Activo'
    or (estado = 'Desactivado' and fecha_baja is not null)
  );
