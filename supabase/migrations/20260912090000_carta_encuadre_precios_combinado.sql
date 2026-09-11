-- Carta digital: encuadre de las fotos y precio de referencia de los destilados.
--
-- FOTOS (320). Se guardan ya recortadas a 4:3, la misma proporcion que el
-- hueco de la tarjeta y de la ficha, asi que la pantalla no vuelve a recortar
-- y se ve exactamente el encuadre elegido. El recorte busca la franja con mas
-- contenido por percentil de energia, NO por maximo: con el maximo, el recorte
-- se iba a la llama del flambeado y dejaba la copa fuera. Script en
-- scripts/carta-encuadre.py.
--
-- BOTELLAS. Se rehacen sobre el fondo de humo con dos arreglos:
--   · el recorte del fondo mide el blanco real del marco en vez de usar un
--     umbral fijo; el fijo se comia media botella de Malibu, que es blanca;
--   · la botella ya no se amplia nunca. Moet venia a 173x290 px y estirarla a
--     900 la dejaba borrosa; ahora el lienzo se adapta y sale nitida.
-- Script en scripts/carta-fondo-humo.py.
--
-- CERVEZAS. La foto de Radler de cana era en realidad la botella. Se separan:
-- 2416 botella San Miguel = "San miguel Tercio", 2418 vaso = "Radler",
-- 2419 botella Radler = "Radler Tercio".
--
-- PRECIOS. En destilados el precio que se enseña pasa a ser el del COMBINADO,
-- que es como se pide habitualmente; antes salia el del chupito y parecia
-- barato de mas. Los tres formatos quedan en la descripcion, y la botella solo
-- aparece en los que se venden asi. La categoria "Botellas" deja de mostrarse:
-- ese precio ya vive dentro de cada producto.
update public.carta_categorias
set visible = false, updated_at = now()
where nombre = 'Botellas' and visible is not false;

-- Las shishas de un mismo sabor se escribian distinto en cada local.
update public.carta_items set nombre = 'Al Kaher Yellow', updated_at = now()
where nombre in ('AL Kaher Yellow', 'Al Kaher Yelow');
update public.carta_items set nombre = 'Miss Jossy', updated_at = now()
where nombre in ('Miis Jossy', 'MissJossy');
update public.carta_items set nombre = 'My Amor', updated_at = now()
where nombre in ('MY Amor', 'My amor');
update public.carta_items set nombre = 'Cotton Candy', updated_at = now()
where nombre = 'Catton Candy';

-- Las croquetas de HABANA se quedaron sin arranque de me gusta; es el mismo
-- plato que en BACANAL, que va con 119.
update public.carta_items ci
set likes_base = 119, updated_at = now()
from public.empresas e
where e.id = ci.empresa_id and e.nombre = 'HABANA'
  and ci.nombre ilike '%croqueta%' and coalesce(ci.likes_base, 0) = 0;
