-- ════════════════════════════════════════════════════════════════════════
-- Seguridad: la AGENDA pasa a ser un permiso, y el CHAT deja de dejar gente fuera.
--
-- 1) HERR_AGENDA — la libreta de contactos guarda los teléfonos y correos
--    PERSONALES de empleados y proveedores. Deja de verse por defecto: se
--    enciende en Ajustes → Roles, igual que Videovigilancia. De fábrica solo
--    DIRECCIÓN y GERENCIA. El resto podrá llamar a sus compañeros por la app
--    (llamada interna), pero sin ver ningún dato suyo.
--
-- 2) `bh_departamentos_usuario` descarta HERR_AGENDA: es un toggle, no un
--    departamento, así que nunca puede dar acceso a un grupo de chat.
--
-- 3) Un grupo de chat por cada departamento ACTIVO de cada empresa. Faltaban
--    ARTISTAS, MANTENIMIENTO y PRODUCTO: su gente abría el chat y no veía nada.
--
-- Idempotente: se puede volver a lanzar sin efecto.
-- ════════════════════════════════════════════════════════════════════════

-- ─── 1) Encender AGENDA en DIRECCIÓN y GERENCIA de cada empresa ────────────
update public.empresa_roles r
set permisos = (
      select coalesce(jsonb_agg(p), '[]'::jsonb)
      from jsonb_array_elements(r.permisos) p
      where public.bh_norm(p->>'modulo') <> 'HERR_AGENDA'
    ) || jsonb_build_array(
      jsonb_build_object('modulo', 'HERR_AGENDA', 'ver', true, 'editar', true)
    )
where public.bh_norm(r.nombre) in ('DIRECCION', 'GERENCIA');

-- ─── 2) HERR_AGENDA no es departamento: no da acceso a ningún chat ─────────
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
  v_no_dept text[] := array['AJUSTES','CAMARAS','HERR_AGENDA','HERR_APLICACIONES','HERR_ACCESOS'];
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

-- ─── 3) Un grupo de chat por departamento activo ───────────────────────────
insert into public.canales (empresa_id, nombre, tipo)
select d.empresa_id, upper(trim(d.nombre)), 'departamento'
from public.departamentos d
where coalesce(d.estado, 'Activo') = 'Activo'
  and trim(coalesce(d.nombre, '')) <> ''
  and not exists (
    select 1 from public.canales c
    where c.empresa_id = d.empresa_id
      and c.tipo = 'departamento'
      and public.bh_canon(c.nombre) = public.bh_canon(d.nombre)
  )
group by d.empresa_id, upper(trim(d.nombre));

-- ─── 4) Grupos de departamentos que ya no existen en la empresa ────────────
-- BALLES es la matriz y se le retiraron SALA, COCINA y LOGÍSTICA; su grupo
-- "RR.HH" es además un duplicado de RECURSOS HUMANOS. Se borran solo los que
-- no tienen ni un mensaje: un grupo con conversación NO se toca nunca.
delete from public.canales c
where c.tipo = 'departamento'
  and not exists (
    select 1 from public.departamentos d
    where d.empresa_id = c.empresa_id
      and coalesce(d.estado, 'Activo') = 'Activo'
      and upper(trim(d.nombre)) = upper(trim(c.nombre))
  )
  and not exists (select 1 from public.mensajes m where m.canal_id = c.id);
