-- ============================================================================
-- Alérgenos corregidos con las respuestas del jefe de cocina (Borja, 08-09-2026).
-- Cada uno se marca en SU ORIGEN REAL, no en el plato, para que la cascada lo
-- reparta sola a todos los platos que lo usen.
--
-- 1) Ceviche Thai: los crustáceos y moluscos vienen de la salsa de pescado del
--    aliño asiático. Se marcan en el aliño (y con ellos el pescado, que también
--    aporta), no en el plato.
-- 2) Vieiras: la vieira es SOLO molusco. El gluten venía del furikake → se marca
--    en el furikake, así lo hereda cualquier plato que lo lleve.
-- 3) Curry rojo: el apio y la mostaza salen de la pasta de curry rojo.
--    (El gluten de la corvina frita queda pendiente: ver nota al final.)
-- 4) Tomahawk y lomo bajo: el gluten viene de las patatas fritas, que comparten
--    freidora con producto empanado. Se marca en las dos elaboraciones de patata
--    frita, de modo que TODOS los platos con guarnición frita lo declaren. Esto
--    explica de golpe el gluten que las fichas ya declaraban en entraña, huevos
--    rotos, tomahawk y lomo bajo.
-- 5) El pan de hamburguesa High Potato NO lleva sésamo: se retira.
--
-- PENDIENTE, no lo resuelve esta migración: el gluten del curry rojo. Borja dice
-- que viene de la corvina frita, pero el escandallo lleva "Lubina" y la harina del
-- rebozado no está como ingrediente. Hay que decidir si el pescado del plato es
-- corvina o lubina y añadir el rebozado antes de que la cascada pueda derivarlo.
-- Los pimientos fritos comparten el mismo caso: marcar de gluten el "Pimiento Rojo"
-- crudo declararía gluten también en ensaladas, así que haría falta una
-- elaboración "Pimientos fritos" aparte.
--
-- Idempotente: empareja por nombre exacto; reescribe el mismo valor si se repite.
-- ============================================================================
with m(nombre, tipo, alerg) as (values
  ('Aliño asiático',      'elaboracion', ARRAY['Soja','Sésamo','Gluten','Crustáceos','Moluscos','Pescado']::text[]),
  ('Furikake',            'compra',      ARRAY['Sésamo','Pescado','Gluten']::text[]),
  ('Salsa de curry rojo', 'elaboracion', ARRAY['Lácteos','Sulfitos','Sésamo','Apio','Mostaza']::text[]),
  ('Patata frita',        'elaboracion', ARRAY['Gluten']::text[]),
  ('Patatas fritas',      'elaboracion', ARRAY['Gluten']::text[]),
  ('Pan de Hamburguesa ( High Potato )', 'compra', ARRAY['Gluten']::text[])
)
update public.productos p
   set alergenos = m.alerg,
       alergenos_modo = 'manual'
  from m
 where p.nombre = m.nombre
   and p.tipo::text = m.tipo;
