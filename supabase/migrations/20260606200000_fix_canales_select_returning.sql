-- Fix: la política SELECT de canales reconsultaba la fila por id mediante
-- bh_canal_visible(id). Durante INSERT ... RETURNING (que usa .insert().select())
-- la fila nueva todavía no es visible para esa subconsulta, así que devolvía
-- false y abortaba la creación de canales/asuntos ("new row violates RLS").
-- Ahora la visibilidad se evalúa sobre las COLUMNAS de la propia fila.

create or replace function public.bh_canal_visible_cols(
  p_empresa uuid,
  p_tipo text,
  p_nombre text,
  p_miembros uuid[],
  p_departamentos text[]
) returns boolean language plpgsql stable security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_user_deps text[];
  v_canal_deps text[];
begin
  if v_uid is null then return false; end if;
  if public.bh_es_admin() then return true; end if;
  if v_uid = any (coalesce(p_miembros, '{}'::uuid[])) then return true; end if;

  v_user_deps := public.bh_departamentos_usuario(p_empresa);

  if p_tipo = 'departamento' then
    v_canal_deps := array[ public.bh_canon(p_nombre) ];
  else
    select coalesce(array_agg(distinct public.bh_canon(x)), '{}')
      into v_canal_deps
    from unnest(coalesce(p_departamentos, '{}'::text[])) as x;
  end if;

  if v_canal_deps is null or array_length(v_canal_deps, 1) is null then
    return false;
  end if;

  return v_user_deps && v_canal_deps;
end;
$$;

create or replace function public.bh_canal_visible(p_canal uuid)
returns boolean language plpgsql stable security definer set search_path = public as $$
declare r record;
begin
  if auth.uid() is null then return false; end if;
  select empresa_id, tipo, nombre, miembros_user_ids, departamentos
    into r from public.canales where id = p_canal;
  if not found then return false; end if;
  return public.bh_canal_visible_cols(r.empresa_id, r.tipo, r.nombre, r.miembros_user_ids, r.departamentos);
end;
$$;

drop policy if exists canales_select on public.canales;
create policy canales_select on public.canales for select
  using (public.bh_canal_visible_cols(empresa_id, tipo, nombre, miembros_user_ids, departamentos));
