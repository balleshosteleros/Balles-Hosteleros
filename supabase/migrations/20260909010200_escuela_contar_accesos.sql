-- ESCUELA — contar las veces que entra cada alumno.
--
-- `ultimo_acceso_at` solo dice cuándo fue la última vez. El número de entradas
-- es lo que distingue al alumno que vuelve cada semana del que entró una vez y
-- no volvió, y es el dato que ya se traía de GoHighLevel: si no se sigue
-- sumando, se queda congelado en la foto de la migración.
--
-- Se suma en la base de datos, no leyendo y escribiendo desde la aplicación:
-- dos pestañas abiertas a la vez perderían una de las dos entradas.
create or replace function public.escuela_registrar_acceso(p_alumno uuid)
returns void
language sql
set search_path = public
as $$
  update public.escuela_alumnos
     set ultimo_acceso_at = now(),
         accesos_num = coalesce(accesos_num, 0) + 1
   where id = p_alumno;
$$;

-- Solo la entra el servidor del portal (service role). El alumno no está en
-- auth.users y nadie más tiene por qué tocar el contador.
revoke execute on function public.escuela_registrar_acceso(uuid) from public;
revoke execute on function public.escuela_registrar_acceso(uuid) from anon, authenticated;
