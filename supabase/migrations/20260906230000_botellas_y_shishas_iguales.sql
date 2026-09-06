-- Botellas con fondo de humo + mismo catalogo de shishas en los dos locales.
--
-- BOTELLAS: Agora tiene la foto de fabricante de casi todos los destilados,
-- pero sobre blanco liso: en una carta de fondo oscuro cantan como un recorte
-- de catalogo. Se recorta el blanco y se monta cada botella sobre un fondo de
-- barra -negro con jirones de humo calido y contraluz-. El script vive en
-- scripts/carta-fondo-humo.py. 156 platos con foto (103 imagenes; una misma
-- botella sirve a la copa y a la botella entera).
--
-- SHISHAS: HABANA vendia 6 sabores que BACANAL no tenia (Casper, Lady Killer,
-- Mango Tango, Moon Dream, Play, Tornado, a 15,00 EUR). Se dan de alta como
-- producto de venta en BACANAL y se anaden a su carta con la misma foto.
--
-- "Shisha 1 Sabor" y "Shisha 2 Sabor" salen de la carta: como las de
-- liquidacion, son la forma de cobrar en el TPV, no un sabor que el cliente
-- elija. Se ocultan, no se borran: el producto de venta sigue activo.
update public.carta_items ci
set visible = false, updated_at = now()
from public.carta_categorias cc
where cc.id = ci.categoria_id
  and cc.nombre = 'Shishas'
  and ci.nombre in ('Shisha 1 Sabor','Shisha 2 Sabor')
  and ci.visible is not false;

-- Orden visual 1..N sin huecos tras las altas.
with nuevo as (
  select id, row_number() over (partition by categoria_id order by orden, nombre)::smallint as n
  from public.carta_items where visible is not false
)
update public.carta_items ci set orden = nuevo.n, updated_at = now()
from nuevo where ci.id = nuevo.id and ci.orden is distinct from nuevo.n;
