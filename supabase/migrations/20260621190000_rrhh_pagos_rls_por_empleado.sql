-- Endurece la RLS de rrhh_pagos: antes era empresa-wide (cualquier usuario de la
-- empresa podia leer por API TODOS los sueldos). Ahora:
--   * Gestor de nominas (rol con modulo 'RECURSOS HUMANOS' ver=true) o director
--     (es_admin_plataforma): ve / gestiona TODAS las filas de sus empresas.
--   * Empleado normal: solo ve y acepta SUS propias liquidaciones.
-- El trigger de bloqueo (20260621180000) sigue limitando QUE puede cambiar el
-- empleado (solo confirmacion_aceptada_at). Idempotente.

-- ¿El usuario actual puede gestionar nominas? (director o acceso a RRHH)
create or replace function public.puede_gestionar_pagos()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from usuarios u
    join empresa_roles r on r.id = u.rol_id
    where u.user_id = auth.uid()
      and (
        r.es_admin_plataforma = true
        or exists (
          select 1
          from jsonb_array_elements(coalesce(r.permisos, '[]'::jsonb)) p
          where p->>'modulo' = 'RECURSOS HUMANOS'
            and coalesce((p->>'ver')::boolean, false) = true
        )
      )
  );
$$;

-- IDs de las fichas de empleado del usuario actual (multi-empresa).
create or replace function public.mis_empleado_ids()
returns setof uuid
language sql
stable
security definer
set search_path = public
as $$
  select id from empleados where user_id = auth.uid();
$$;

-- SELECT: gestor ve todo lo de sus empresas; empleado solo lo suyo.
drop policy if exists rrhh_pagos_select on public.rrhh_pagos;
create policy rrhh_pagos_select on public.rrhh_pagos
  for select using (
    empresa_id in (select empresas_del_usuario())
    and (
      public.puede_gestionar_pagos()
      or empleado_id in (select public.mis_empleado_ids())
    )
  );

-- INSERT: solo gestores crean liquidaciones.
drop policy if exists rrhh_pagos_insert on public.rrhh_pagos;
create policy rrhh_pagos_insert on public.rrhh_pagos
  for insert with check (
    empresa_id in (select empresas_del_usuario())
    and public.puede_gestionar_pagos()
  );

-- UPDATE: gestor sobre todo; empleado solo su propia fila (aceptar la
-- liquidacion). El trigger impide que el empleado toque importes.
drop policy if exists rrhh_pagos_update on public.rrhh_pagos;
create policy rrhh_pagos_update on public.rrhh_pagos
  for update using (
    empresa_id in (select empresas_del_usuario())
    and (
      public.puede_gestionar_pagos()
      or empleado_id in (select public.mis_empleado_ids())
    )
  ) with check (
    empresa_id in (select empresas_del_usuario())
    and (
      public.puede_gestionar_pagos()
      or empleado_id in (select public.mis_empleado_ids())
    )
  );

-- DELETE: solo gestores.
drop policy if exists rrhh_pagos_delete on public.rrhh_pagos;
create policy rrhh_pagos_delete on public.rrhh_pagos
  for delete using (
    empresa_id in (select empresas_del_usuario())
    and public.puede_gestionar_pagos()
  );
