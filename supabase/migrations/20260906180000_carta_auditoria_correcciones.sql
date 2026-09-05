-- Correcciones de la auditoria de cartas digitales.
-- Idempotente: se puede volver a aplicar sin efecto.

-- 1. Errata: "Strawbeery" -> "Strawberry", en carta y en productos.
update public.carta_items
set nombre = replace(nombre, 'Strawbeery', 'Strawberry'), updated_at = now()
where nombre like '%Strawbeery%';

update public.productos
set nombre = replace(nombre, 'Strawbeery', 'Strawberry'), updated_at = now()
where nombre like '%Strawbeery%';

-- 2. Vapers de HABANA: habia dos "Strawberry Ice 2%" porque uno colgaba del
--    producto de COMPRA y otro del de VENTA. En carta solo debe salir el de
--    venta; se retira el que apunta a compra teniendo gemelo de venta.
delete from public.carta_items ci
using public.productos p
where ci.producto_id = p.id
  and p.tipo <> 'venta'
  and exists (
    select 1 from public.carta_items otro
    join public.productos pv on pv.id = otro.producto_id and pv.tipo = 'venta'
    where otro.categoria_id = ci.categoria_id
      and lower(btrim(otro.nombre)) = lower(btrim(ci.nombre))
      and otro.id <> ci.id
  );

-- 3. Los dos vinos "Alma" no eran un duplicado: son el blanco y el rosado, y
--    con el mismo nombre parecian el mismo vino. Se nombran y se enlazan.
update public.carta_items ci
set nombre = 'Alma Blanco', updated_at = now()
where ci.nombre = 'Alma'
  and ci.categoria_id in (select id from public.carta_categorias where nombre = 'Vinos blancos');

update public.carta_items ci
set nombre = 'Alma Rosado', updated_at = now()
where ci.nombre = 'Alma'
  and ci.categoria_id in (select id from public.carta_categorias where nombre = 'Vinos rosados');

-- 4. Vinos que no colgaban de ningun producto de venta: se enlazan por nombre.
update public.carta_items ci
set producto_id = pv.id, updated_at = now()
from public.productos pv
where ci.producto_id is null
  and pv.empresa_id = ci.empresa_id
  and pv.tipo = 'venta'
  and lower(btrim(pv.nombre)) = lower(btrim(ci.nombre))
  and ci.categoria_id in (select id from public.carta_categorias where nombre ilike 'vinos%');

-- 5. Orden visual: 1..N sin huecos ni repetidos dentro de cada categoria.
--    Habia un plato con el numero 99 y varias categorias con empates, que es
--    justo lo que el campo "orden visual" existe para evitar.
with nuevo as (
  select id, row_number() over (partition by categoria_id order by orden, nombre)::smallint as n
  from public.carta_items
)
update public.carta_items ci
set orden = nuevo.n, updated_at = now()
from nuevo
where ci.id = nuevo.id and ci.orden is distinct from nuevo.n;
