-- Aislamiento REAL por empresa activa.
--
-- PROBLEMA (estructural): `empresas_del_usuario()` devuelve TODAS las empresas
-- del usuario, y 448 politicas RLS se apoyan en ella. Es decir: la base de datos
-- autorizaba HABANA y BACANAL A LA VEZ para un mismo usuario, y nunca sabia cual
-- estaba mirando. Cualquier consulta que se olvidara del `.eq("empresa_id", ...)`
-- devolvia datos mezclados de varias sociedades sin que nada lo impidiera.
--
-- SOLUCION: la empresa activa (la del selector) viaja a la base de datos en la
-- cabecera `x-bh-empresa`. Si viene y el usuario pertenece a esa empresa, la
-- funcion devuelve SOLO esa. Asi las 448 politicas pasan a aislar de verdad,
-- sin tocar ninguna de ellas una por una.
--
-- Idempotente: se puede ejecutar varias veces sin efectos secundarios.

-- ── 1. Empresa activa declarada por la peticion ─────────────────────────────
-- Lee la cabecera `x-bh-empresa`. Devuelve NULL si no viene o no es un UUID.
-- NO decide permisos por si sola: solo dice "el usuario esta mirando esta".
create or replace function public.bh_empresa_activa()
returns uuid
language plpgsql
stable
security definer
set search_path to 'public'
as $$
declare
  v_raw text;
begin
  begin
    v_raw := current_setting('request.headers', true)::json->>'x-bh-empresa';
  exception when others then
    return null;  -- conexion directa (sin PostgREST): no hay cabeceras
  end;

  if v_raw is null or v_raw !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    return null;
  end if;

  return v_raw::uuid;
end;
$$;

comment on function public.bh_empresa_activa() is
  'Empresa que el usuario esta viendo (cabecera x-bh-empresa). NULL si no se declara.';

-- ── 2. Empresas visibles: SOLO la activa cuando se declara ──────────────────
-- Mantiene el nombre y la firma, asi que las 448 politicas existentes siguen
-- funcionando y pasan a aislar automaticamente.
--
-- Reglas:
--   a) La empresa activa debe ser una de las del usuario. Si no lo es, no
--      devuelve NADA (no se cae al comportamiento antiguo: eso seria una via
--      para saltarse el aislamiento mandando una cabecera cualquiera).
--   b) Si no se declara empresa activa (crons, webhooks, portales publicos por
--      token, procesos sin sesion), se conserva el comportamiento anterior:
--      todas las empresas del usuario. Esos caminos no tienen selector.
create or replace function public.empresas_del_usuario()
returns setof uuid
language sql
stable
security definer
set search_path to 'public'
as $$
  with propias as (
    select empresa_id from public.usuarios
      where user_id = auth.uid() and empresa_id is not null
    union
    select empresa_id from public.usuario_empresas
      where user_id = auth.uid() and empresa_id is not null
  ),
  activa as (
    select public.bh_empresa_activa() as id
  )
  select p.empresa_id
  from propias p
  where
    -- Sin empresa activa declarada: comportamiento anterior (todas las suyas).
    (select id from activa) is null
    -- Con empresa activa: solo esa, y solo si de verdad es suya.
    or p.empresa_id = (select id from activa);
$$;

comment on function public.empresas_del_usuario() is
  'Empresas visibles en esta peticion. Con x-bh-empresa declarada devuelve SOLO esa (si pertenece al usuario); sin ella, todas las del usuario. Base del aislamiento multi-empresa.';
