-- chat_empleados: añadir el PUESTO REAL del empleado.
--
-- Motivo: los selectores/listas de la familia "canal" (chat, comunicados,
-- sanciones, comunicación móvil) mostraban `rol_label · departamento`. Pero en
-- este sistema `usuarios.rol_label` ES el nombre del departamento (el rol de un
-- usuario = su departamento: una camarera de SALA tiene rol SALA). Por eso el
-- texto SIEMPRE se duplicaba: p. ej. Ruth (cantante del depto ARTISTAS) aparecía
-- como "ARTISTAS · ARTISTAS" en vez de "CANTANTE · ARTISTAS".
--
-- Solución: exponer el puesto REAL resolviéndolo igual que getEmpleadosActivos:
--   * puesto principal (es_principal) de `empleado_puestos`, con fallback al
--     primero disponible, y por último a la columna legacy `empleados.puesto`.
-- El nombre del puesto viene de `puestos.nombre`, o de `empleado_puestos.puesto_nombre`.
--
-- Idempotente: DROP + CREATE (cambia el tipo de retorno: añade la columna
-- `puesto`). Se conserva `rol_label` por compatibilidad con consumidores existentes.

DROP FUNCTION IF EXISTS public.chat_empleados(uuid);

CREATE OR REPLACE FUNCTION public.chat_empleados(p_empresa uuid)
 RETURNS TABLE(user_id uuid, nombre text, apellidos text, rol_label text, departamento text, puesto text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select distinct on (p.user_id)
    p.user_id,
    p.nombre,
    p.apellidos,
    p.rol_label,
    p.departamento,
    -- Puesto real del empleado en esta empresa (principal → primero → legacy).
    coalesce(
      (
        select coalesce(pu.nombre, ep.puesto_nombre)
        from public.empleados e
        join public.empleado_puestos ep on ep.empleado_id = e.id
        left join public.puestos pu on pu.id = ep.puesto_id
        where e.user_id = p.user_id
          and e.empresa_id = p_empresa
          and coalesce(pu.nombre, ep.puesto_nombre) is not null
        order by ep.es_principal desc nulls last
        limit 1
      ),
      (
        select e.puesto
        from public.empleados e
        where e.user_id = p.user_id
          and e.empresa_id = p_empresa
          and e.puesto is not null
        limit 1
      )
    ) as puesto
  from public.usuarios p
  where p.user_id is not null
    and coalesce(p.estado_acceso, 'Activo') = 'Activo'
    and (p.empresa_id = p_empresa
      or p.user_id in (select ue.user_id from public.usuario_empresas ue where ue.empresa_id = p_empresa))
    and p_empresa in (select public.empresas_del_usuario())
    -- Excluir a quien tenga una ficha de empleado INACTIVA en esta empresa
    -- (baja / ex-empleado). Las cuentas sin ficha (dirección/gerencia) se conservan.
    and not exists (
      select 1 from public.empleados e
      where e.user_id = p.user_id
        and e.empresa_id = p_empresa
        and e.estado is distinct from 'Activo'
    )
  order by p.user_id, p.nombre;
$function$;
