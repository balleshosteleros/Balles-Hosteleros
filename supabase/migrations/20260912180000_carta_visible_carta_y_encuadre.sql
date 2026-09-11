-- Tres cosas que hacian que la carta no enseñara lo que tiene.
--
-- 1. LA CATEGORIA VAPERS SALIA VACIA, con el cartel de "Proximamente".
--    La carta publica respeta el interruptor "es de carta" de la ficha del
--    PRODUCTO, que manda sobre el plato. Los productos dados de alta a mano
--    nacian con ese interruptor apagado, asi que sus platos no llegaban al
--    comensal: los 10 vapers de HABANA (la categoria entera), 6 shishas de
--    BACANAL y 6 vinos. Se enciende en todo producto que cuelgue de un plato
--    visible.
update public.productos p
set visible_carta = true, updated_at = now()
from public.carta_items ci
join public.carta_categorias cc on cc.id = ci.categoria_id
where p.id = ci.producto_id
  and ci.visible is not false and cc.visible is not false
  and coalesce(p.visible_carta, false) = false;

-- 2. La estrella de best seller la gobierna tambien la ficha del producto, asi
--    que marcarla solo en la carta no se veia.
update public.productos p
set carta_destacado = true, updated_at = now()
from public.carta_items ci
join public.carta_categorias cc on cc.id = ci.categoria_id
where p.id = ci.producto_id and ci.destacado
  and ci.visible is not false and cc.visible is not false
  and coalesce(p.carta_destacado, false) = false;

-- 3. ENCUADRE. En una foto vertical de coctel (2:3) el recorte a 4:3 se lleva
--    media altura y la copa sale partida: "fuera del marco". Esas fotos pasan
--    a entrar ENTERAS, con la propia foto ampliada y desenfocada rellenando
--    los lados, que es como se presenta una copa alta. Las apaisadas siguen
--    recortadas, que ya llenan el marco. Ver scripts/carta-encuadre.py.
--
-- Y en HABANA: Boom-boom, Sex On Habana y Banana Daiquiri pasan a best seller
-- con arranque de me gusta muy por encima del resto. Los dos de "Nuestros
-- cocteles" se separan a las posiciones 1 y 8: en 1 y 4 caian casi pegados y
-- los recuadros dorados juntos cantaban.
