-- chat_empleados: devolver SOLO empleados/usuarios activos (dados de alta) en la empresa.
--
-- Motivo: el selector de "Miembros sueltos" del chat (Nuevo asunto / Editar miembros)
-- listaba también a empleados dados de baja o usuarios con acceso Inactivo. Debe
-- sincronizarse con las altas/bajas: si se deshabilita un empleado desaparece, si se
-- añade uno nuevo aparece.
--
-- Criterio de inclusión:
--   * El usuario debe estar Activo (usuarios.estado_acceso = 'Activo').
--   * NO debe existir para esa empresa una ficha de empleado suya marcada como
--     Inactivo (ex-empleado / baja). Regla del proyecto: ex-empleado = Inactivo.
--   * Se conservan las cuentas SIN ficha de empleado (dirección/gerencia/admin),
--     que participan en el chat aunque no tengan empleado asociado.
--
-- Idempotente: CREATE OR REPLACE.

CREATE OR REPLACE FUNCTION public.chat_empleados(p_empresa uuid)
 RETURNS TABLE(user_id uuid, nombre text, apellidos text, rol_label text, departamento text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select distinct p.user_id, p.nombre, p.apellidos, p.rol_label, p.departamento
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
  order by p.nombre;
$function$;
