-- `empleado_esta_activo` volvía a ignorar `fecha_baja`: en producción era
-- literalmente `select p_estado = 'Activo'`, con el parámetro de fecha recibido
-- y descartado. La versión original (067_sync_profile_estado_from_empleado.sql)
-- sí la comprobaba; en algún punto se perdió.
--
-- Consecuencia real: una baja con fecha futura NUNCA cortaba el acceso. Aunque
-- alguien pusiera la fecha de baja a mano, el trabajador seguía entrando en la
-- app hasta que un humano cambiaba el estado. Es el caso que provocó que una
-- baja aprobada en mayo siguiera con acceso completo en agosto.
--
-- Se restaura la comprobación. La función alimenta el trigger
-- `empleados_sync_estado_acceso`, que deriva `usuarios.estado_acceso` y es lo
-- que el proxy consulta en cada petición para cortar la sesión.
--
-- Idempotente: se puede reejecutar sin efectos.

create or replace function public.empleado_esta_activo(p_estado text, p_fecha_baja date)
returns boolean
language sql
immutable
set search_path to 'public', 'pg_temp'
as $$
  select p_estado = 'Activo'
     and (p_fecha_baja is null or p_fecha_baja > current_date);
$$;

comment on function public.empleado_esta_activo(text, date) is
  'Un empleado está activo si su estado es Activo Y su fecha de baja no ha llegado todavía. La fecha de baja corta el acceso por sí sola.';

-- Recalcula el acceso de todo el mundo con la regla ya corregida: si alguien
-- arrastra una fecha de baja vencida y seguía entrando, deja de hacerlo ahora.
update public.usuarios u
set estado_acceso = case
  when exists (
    select 1 from public.empleados e
    where e.user_id = u.user_id
      and public.empleado_esta_activo(e.estado, e.fecha_baja)
  ) then 'Activo'
  else 'Inactivo'
end
where u.user_id is not null;
