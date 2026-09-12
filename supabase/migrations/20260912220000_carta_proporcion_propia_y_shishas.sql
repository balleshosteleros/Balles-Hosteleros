-- Cada foto se enseña con SU proporcion, y el catalogo de shishas se ajusta.
--
-- EL MARCO FIJO ERA EL PROBLEMA DE RAIZ. El hueco era 4:3 y una foto de
-- coctel es vertical: al Desliz de cobra le cortaba la cobra entera y solo
-- quedaba el vaso. Rellenar los lados tampoco valia, dejaba recuadros. Ahora
-- manda la foto: al recortarla se guarda su proporcion en el nombre del
-- archivo (-r75 = 0,75) y la tarjeta la lee. Va en el nombre y no en una
-- columna nueva porque la foto y su proporcion son el mismo dato: si cambia
-- la foto cambia el nombre, y no pueden quedar descuadrados. Solo se acota
-- entre 3:4 y 4:3 para que la rejilla no baile: ahi se pierde como mucho un
-- 11%, y lo que se pierde es borde, nunca producto.
--
-- EL CONTADOR DE ID DE PRODUCTO ESTABA ROTO. Al importar de Agora se grabo el
-- numero a mano sin tocar el contador, asi que iba por detras de los datos y
-- CUALQUIER alta de producto fallaba por ID duplicado: BACANAL compra (417 vs
-- 422), BACANAL elaboracion (22 vs 35) y HABANA venta (207 vs 208). Puesto al
-- dia; sin esto no se podia crear ni un producto en esas empresas.
update public.numero_counters nc set ultimo = m.maximo
from (
  select nc2.tabla, nc2.empresa_id,
         (select max(p.numero_secuencial) from public.productos p
          where p.empresa_id = nc2.empresa_id and 'productos:' || p.tipo = nc2.tabla) as maximo
  from public.numero_counters nc2 where nc2.tabla like 'productos:%'
) m
where nc.tabla = m.tabla and nc.empresa_id = m.empresa_id
  and m.maximo is not null and nc.ultimo < m.maximo;

-- SHISHAS: la casa sirve 15 sabores. Salen de la carta los 7 que ya no se
-- hacen (no se borran, para no perder el historico de ventas) y entra el que
-- faltaba, Sexy Green. Las dos cartas quedan con la misma lista.
update public.carta_items ci
set visible = false, updated_at = now()
from public.carta_categorias cc
where cc.id = ci.categoria_id and cc.nombre = 'Shishas' and ci.visible is not false
  and ci.nombre in ('Casper','Chao Bella','Lady Killer','Mango Tango','Moon Dream','Play','Tornado');

-- FOTOS: el zumo de coco salia azulado -lo teñia la luz de la barra- y se le
-- neutraliza el tinte. Y las botellas de origen pequeño, como el Tequila de
-- frutas de la pasion (225 px, con mucho margen blanco), salian diminutas al
-- lado del resto: ahora todas ocupan la misma parte del marco.
