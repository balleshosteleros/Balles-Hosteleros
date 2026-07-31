-- ════════════════════════════════════════════════════════════════════════
-- Comunicación: los chats existen SOLO por departamento.
--
-- Algunos módulos de permiso en `empresa_roles.permisos` NO son departamentos,
-- sino ajustes/toggles extra dentro de Roles: el candado de AJUSTES, la CÁMARA
-- de la toolbar y los lanzadores de apps/accesos (HERR_APLICACIONES, HERR_ACCESOS).
-- Estos NUNCA deben dar acceso a un chat aunque estén con "ver:true".
--
-- Redefinimos `bh_departamentos_usuario` para descartarlos. Idempotente.
-- (Espejo de MODULOS_NO_DEPARTAMENTO en comunicacion-actions.ts.)
-- ════════════════════════════════════════════════════════════════════════

create or replace function public.bh_departamentos_usuario(p_empresa uuid)
returns text[] language plpgsql stable security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_dep text;
  v_rol text;
  v_out text[] := '{}';
  v_perm jsonb;
  v_item jsonb;
  v_name text;
  -- Módulos que NO son departamentos (ajustes/toggles extra de Roles).
  v_no_dept text[] := array['AJUSTES','CAMARAS','HERR_APLICACIONES','HERR_ACCESOS'];
begin
  if v_uid is null then return '{}'; end if;

  select public.bh_canon(departamento), public.bh_norm(rol_label)
    into v_dep, v_rol
  from public.usuarios where user_id = v_uid;

  if coalesce(v_dep,'') <> '' then v_out := array_append(v_out, v_dep); end if;
  if coalesce(v_rol,'') <> '' then v_out := array_append(v_out, public.bh_canon(v_rol)); end if;

  select permisos into v_perm
  from public.empresa_roles
  where empresa_id = p_empresa and public.bh_norm(nombre) = v_rol
  limit 1;

  if v_perm is not null then
    for v_item in select * from jsonb_array_elements(v_perm) loop
      if coalesce((v_item->>'ver')::boolean, false) then
        -- Descartamos los módulos que no son departamentos (por nombre normalizado,
        -- antes de canonicalizar, para cubrir 'CÁMARAS' -> 'CAMARAS').
        if public.bh_norm(v_item->>'modulo') = any (v_no_dept) then
          continue;
        end if;
        v_name := public.bh_canon(v_item->>'modulo');
        if v_name <> '' then v_out := array_append(v_out, v_name); end if;
      end if;
    end loop;
  end if;

  return (select coalesce(array_agg(distinct x), '{}') from unnest(v_out) as x);
end;
$$;
