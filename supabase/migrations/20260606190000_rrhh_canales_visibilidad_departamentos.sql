-- ════════════════════════════════════════════════════════════════════════
-- Comunicación: visibilidad de canales por departamento (seguridad RLS)
-- Cada canal "asunto"/"grupo" se liga a uno o varios departamentos.
-- Solo ven un canal: admins/directores, los miembros explícitos, o los
-- empleados cuyo ROL da acceso a alguno de los departamentos del canal.
-- Los canales "departamento" se visibilizan por su propio nombre.
-- ════════════════════════════════════════════════════════════════════════

-- 1) Columna de enlace a departamentos (nombres, p.ej. {'COCINA','CALIDAD'})
alter table public.canales
  add column if not exists departamentos text[] not null default '{}';

-- 2) Normalizador: mayúsculas + sin acentos
create or replace function public.bh_norm(p text)
returns text language sql immutable as $$
  select translate(
    upper(coalesce(trim(p), '')),
    'ÁÉÍÓÚÀÈÌÒÙÂÊÎÔÛÄËÏÖÜÑ',
    'AEIOUAEIOUAEIOUAEIOUN'
  );
$$;

-- 3) Canonicalizador: agrupa sinónimos (RRHH ↔ RECURSOS HUMANOS, etc.)
create or replace function public.bh_canon(p text)
returns text language sql immutable as $$
  select case public.bh_norm(p)
    when 'RECURSOS HUMANOS' then 'RRHH'
    when 'RRHH' then 'RRHH'
    when 'RR.HH' then 'RRHH'
    when 'RR HH' then 'RRHH'
    when 'RESPONSABLE RRHH' then 'RRHH'
    when 'DIRECCION' then 'DIRECCION'
    when 'DIRECTOR' then 'DIRECCION'
    when 'COCINA' then 'COCINA'
    when 'JEFE DE COCINA' then 'COCINA'
    when 'SALA' then 'SALA'
    when 'JEFE DE SALA' then 'SALA'
    when 'LOGISTICA' then 'LOGISTICA'
    when 'JEFE DE LOGISTICA' then 'LOGISTICA'
    when 'GERENCIA' then 'GERENCIA'
    when 'GERENTE' then 'GERENCIA'
    when 'CALIDAD' then 'CALIDAD'
    when 'RESPONSABLE CALIDAD' then 'CALIDAD'
    when 'MARKETING' then 'MARKETING'
    when 'RESPONSABLE MARKETING' then 'MARKETING'
    when 'CONTABILIDAD' then 'CONTABILIDAD'
    when 'CONTABLE' then 'CONTABILIDAD'
    when 'GESTORIA' then 'GESTORIA'
    when 'GESTOR' then 'GESTORIA'
    when 'JURIDICO' then 'JURIDICO'
    when 'ABOGADO' then 'JURIDICO'
    else public.bh_norm(p)
  end;
$$;

-- 4) ¿El usuario actual es admin/director? (acceso total)
create or replace function public.bh_es_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.user_roles
    where user_id = auth.uid() and role in ('director','admin')
  );
$$;

-- 5) Departamentos (canónicos) a los que el usuario tiene acceso por su rol
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
begin
  if v_uid is null then return '{}'; end if;

  select public.bh_canon(departamento), public.bh_norm(rol_label)
    into v_dep, v_rol
  from public.profiles where user_id = v_uid;

  if coalesce(v_dep,'') <> '' then v_out := array_append(v_out, v_dep); end if;
  if coalesce(v_rol,'') <> '' then v_out := array_append(v_out, public.bh_canon(v_rol)); end if;

  select permisos into v_perm
  from public.empresa_roles
  where empresa_id = p_empresa and public.bh_norm(nombre) = v_rol
  limit 1;

  if v_perm is not null then
    for v_item in select * from jsonb_array_elements(v_perm) loop
      if coalesce((v_item->>'ver')::boolean, false) then
        v_name := public.bh_canon(v_item->>'modulo');
        if v_name <> '' then v_out := array_append(v_out, v_name); end if;
      end if;
    end loop;
  end if;

  return (select coalesce(array_agg(distinct x), '{}') from unnest(v_out) as x);
end;
$$;

-- 6) ¿Puede el usuario actual ver este canal?
create or replace function public.bh_canal_visible(p_canal uuid)
returns boolean language plpgsql stable security definer set search_path = public as $$
declare
  r record;
  v_uid uuid := auth.uid();
  v_user_deps text[];
  v_canal_deps text[];
begin
  if v_uid is null then return false; end if;
  select id, empresa_id, tipo, nombre, miembros_user_ids, departamentos
    into r from public.canales where id = p_canal;
  if not found then return false; end if;

  if public.bh_es_admin() then return true; end if;

  -- miembro explícito
  if v_uid = any (coalesce(r.miembros_user_ids, '{}')) then return true; end if;

  v_user_deps := public.bh_departamentos_usuario(r.empresa_id);

  if r.tipo = 'departamento' then
    v_canal_deps := array[ public.bh_canon(r.nombre) ];
  else
    select coalesce(array_agg(distinct public.bh_canon(x)), '{}')
      into v_canal_deps
    from unnest(coalesce(r.departamentos, '{}')) as x;
  end if;

  if v_canal_deps is null or array_length(v_canal_deps, 1) is null then
    return false; -- asunto sin departamentos: solo admins o miembros
  end if;

  return v_user_deps && v_canal_deps; -- intersección no vacía
end;
$$;

-- 7) Políticas RLS
-- canales: SELECT por visibilidad; escritura sigue acotada por empresa.
drop policy if exists canales_read on public.canales;
drop policy if exists canales_write on public.canales;

create policy canales_select on public.canales for select
  using (public.bh_canal_visible(id));

create policy canales_insert on public.canales for insert
  with check (empresa_id in (select public.empresas_del_usuario()));

create policy canales_update on public.canales for update
  using (empresa_id in (select public.empresas_del_usuario()))
  with check (empresa_id in (select public.empresas_del_usuario()));

create policy canales_delete on public.canales for delete
  using (empresa_id in (select public.empresas_del_usuario()));

-- mensajes: lectura/escritura solo si el canal es visible para el usuario.
drop policy if exists mensajes_read on public.mensajes;
drop policy if exists mensajes_insert on public.mensajes;
drop policy if exists mensajes_update on public.mensajes;
drop policy if exists mensajes_delete on public.mensajes;

create policy mensajes_read on public.mensajes for select
  using (public.bh_canal_visible(canal_id));

create policy mensajes_insert on public.mensajes for insert
  with check (public.bh_canal_visible(canal_id));

create policy mensajes_update on public.mensajes for update
  using (public.bh_canal_visible(canal_id))
  with check (public.bh_canal_visible(canal_id));

create policy mensajes_delete on public.mensajes for delete
  using (public.bh_canal_visible(canal_id));

-- 8) Evita departamentos duplicados por empresa (los asuntos sí pueden repetir nombre).
--    Necesario porque, con la visibilidad filtrada, un usuario que no ve todos los
--    departamentos no debe poder recrearlos.
create unique index if not exists canales_departamento_unico
  on public.canales (empresa_id, upper(trim(nombre)))
  where tipo = 'departamento';
