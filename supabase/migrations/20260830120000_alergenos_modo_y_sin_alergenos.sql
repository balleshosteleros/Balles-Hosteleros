-- Alérgenos: modo de declaración (automático/manual) y opción "Sin alérgenos".
--
-- POR QUÉ EL MODO:
-- Los productos de VENTA y de ELABORACIÓN pueden declarar sus alérgenos de dos
-- formas, y hasta ahora la elección estaba implícita en el tipo:
--   - AUTOMÁTICO: se derivan de los productos del escandallo que los compone.
--   - MANUAL: los marca el gestor a mano.
-- Los de COMPRA son SIEMPRE manuales: son la raíz de la cascada y no tienen de
-- dónde derivar.
--
-- POR QUÉ "SIN ALÉRGENOS" ES UN VALOR MÁS DE LA LISTA:
-- Una lista vacía significaba dos cosas muy distintas: "no lleva ninguno" y
-- "nadie lo ha mirado todavía". Para una carta pública eso es un problema: no
-- se puede publicar como libre de alérgenos algo que nadie ha declarado. En vez
-- de una columna aparte, "Sin alérgenos" entra como una opción más del mismo
-- selector, así SIEMPRE hay algo marcado y el estado "sin declarar" desaparece.
--
-- Idempotente: se puede aplicar varias veces sin efecto.

-- 1) Modo de declaración -------------------------------------------------------
alter table public.productos
  add column if not exists alergenos_modo text not null default 'auto';

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'productos_alergenos_modo_chk'
  ) then
    alter table public.productos
      add constraint productos_alergenos_modo_chk
      check (alergenos_modo in ('auto', 'manual'));
  end if;
end $$;

-- Los productos de compra son la raíz de la cascada: no derivan de nada.
update public.productos
   set alergenos_modo = 'manual'
 where tipo = 'compra'
   and alergenos_modo <> 'manual';

-- 2) Backfill de "Sin alérgenos" ----------------------------------------------
-- Los productos de compra ya grabados sin nada marcado se dan por declarados
-- "Sin alérgenos", que es lo acordado con el negocio para no dejar el catálogo
-- entero en estado pendiente. El valor viaja en la MISMA columna `alergenos`,
-- como un elemento más de la lista.
update public.productos
   set alergenos = array['Sin alérgenos']
 where tipo = 'compra'
   and (alergenos is null or array_length(alergenos, 1) is null);

comment on column public.productos.alergenos_modo is
  'Cómo se declaran los alérgenos: auto = derivados de los productos del escandallo; manual = marcados a mano. Los de compra son siempre manual.';
comment on column public.productos.alergenos is
  'Alérgenos UE declarados. En modo manual siempre lleva al menos uno; "Sin alérgenos" es un valor válido que declara explícitamente que no contiene ninguno.';

-- 3) La derivación automática ignora el marcador "Sin alérgenos" --------------
-- Si un ingrediente está declarado como "Sin alérgenos", no aporta nada al
-- plato: sería absurdo que un guiso saliera etiquetado "Sin alérgenos" porque
-- uno de sus diez ingredientes lo esté. Se filtra en las dos RPC de derivación.
--
-- El cuerpo es el de `20260627220000_alergenos_backfill_versionado.sql`; lo
-- único que cambia es el filtro del marcador. No tocar la forma del recorrido
-- (`producto_venta_id` / `ingrediente_id`) sin revisar aquella migración.
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
  where a is not null and a <> '' and a <> 'Sin alérgenos';
$function$;

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
  select * from (
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
  ) t
  where t.alergeno <> 'Sin alérgenos'
  order by 1, 3;
$function$;
