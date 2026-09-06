-- Las shishas "de liquidacion" no estan en la carta fisica y no deben salir
-- en la digital: son una forma de cobrar en el TPV, no un sabor que el
-- cliente elija. Mezcladas entre los sabores reales solo confunden.
--
-- Se ocultan de la carta, NO se borran: el producto de venta sigue activo
-- porque el TPV las sigue cobrando.
update public.carta_items ci
set visible = false, updated_at = now()
from public.carta_categorias cc
where cc.id = ci.categoria_id
  and cc.nombre = 'Shishas'
  and ci.nombre ilike '%liquidacion%'
  and ci.visible is not false;
