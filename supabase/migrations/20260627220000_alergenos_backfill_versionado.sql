-- ============================================================================
-- Backfill de versionado: ALÉRGENOS (cascada productos → escandallos)
-- ----------------------------------------------------------------------------
-- Estos objetos YA EXISTEN en la BD de producción (se aplicaron en su día sin
-- dejar fichero de migración). Esta migración los documenta de forma idempotente
-- para que un despliegue desde cero (BD/entorno/empresa nuevos) recree:
--   1. La columna fuente de verdad  productos.alergenos (text[])
--   2. alergenos_derivados(uuid)        → UNION recursivo de alérgenos de la receta
--   3. alergenos_derivados_origen(uuid) → idem con trazabilidad de origen
--
-- Catálogo único: ALERGENOS_UE_14 (Reglamento UE 1169/2011), valores PascalCase
-- guardados literales. No aplica a una empresa concreta: es el código compartido.
-- No altera datos existentes (add column if not exists / create or replace).
-- ============================================================================

-- 1. Columna fuente de verdad ------------------------------------------------
alter table public.productos
  add column if not exists alergenos text[] not null default '{}';

-- 2. Alérgenos derivados (UNION recursivo a través de producto_composicion) ---
create or replace function public.alergenos_derivados(p_producto_id uuid)
  returns text[]
  language sql
  stable
as $function$
  with recursive cadena as (
    select p_producto_id as id, array[p_producto_id] as visited
    union all
    select pc.ingrediente_id, c.visited || pc.ingrediente_id
      from public.producto_composicion pc
      join cadena c on pc.producto_venta_id = c.id
      where pc.ingrediente_id is not null
        and pc.ingrediente_id <> all (c.visited)
  )
  select coalesce(
    array_agg(distinct a order by a),
    '{}'::text[]
  )
  from (
    select unnest(p.alergenos) as a
    from public.productos p
    where p.id in (select id from cadena)
      and p.alergenos is not null
  ) t
  where a is not null and a <> '';
$function$;

-- 3. Alérgenos derivados con trazabilidad de origen --------------------------
create or replace function public.alergenos_derivados_origen(p_producto_id uuid)
  returns table(alergeno text, origen_id uuid, origen_nombre text, origen_tipo text)
  language sql
  stable
as $function$
  with recursive cadena as (
    select p_producto_id as id, array[p_producto_id]::uuid[] as visited
    union all
    select pc.ingrediente_id, c.visited || pc.ingrediente_id
      from public.producto_composicion pc
      join cadena c on pc.producto_venta_id = c.id
      where pc.ingrediente_id is not null
        and pc.ingrediente_id <> all (c.visited)
  )
  select distinct
    unnest(p.alergenos) as alergeno,
    p.id as origen_id,
    p.nombre as origen_nombre,
    p.tipo::text as origen_tipo
  from public.productos p
  where p.id in (select id from cadena)
    and p.id <> p_producto_id
    and p.alergenos is not null
    and array_length(p.alergenos, 1) > 0
  order by 1, 3;
$function$;
