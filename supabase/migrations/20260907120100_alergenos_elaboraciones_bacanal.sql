-- ============================================================================
-- Alérgenos de las ELABORACIONES intermedias (salsas, guarniciones, caldos).
--
-- Son productos tipo='elaboracion' sin composición propia en la BD, así que la
-- cascada no podía derivarles nada y cortaba la herencia hacia los platos que
-- las usan (mayo de trufa, salsa barbacoa, patatas fritas, caldo de marisco...).
-- Se marcan a mano desde las fichas técnicas de elaboración, cruzando lo que
-- declaró cocina con los ingredientes reales de cada ficha.
--
-- Criterio donde la ficha y sus ingredientes no cuadraban:
--  - Las mayonesas parten de mayonesa comercial: llevan Huevos. El Gluten y el
--    Sésamo que la ficha marcaba en la mayo de trufa no salen de ningún
--    ingrediente (mayonesa + pasta de trufa), así que no se arrastran; queda
--    por confirmar con la etiqueta de la marca.
--  - Barbacoa asiática y mayo kimchi sí llevan Soja y Sésamo (salsa de soja,
--    salsa kimchi), y Huevos por la mayonesa base.
--
-- Idempotente: empareja por nombre exacto y tipo='elaboracion'.
-- ============================================================================
with m(nombre, alerg) as (values
  ('Patata frita',                ARRAY['Sin alérgenos']::text[]),
  ('Patatas fritas',              ARRAY['Sin alérgenos']::text[]),
  ('Pure de patatas',             ARRAY['Lácteos']::text[]),
  ('Maiz frito',                  ARRAY['Sin alérgenos']::text[]),
  ('Chimichurri',                 ARRAY['Sulfitos']::text[]),
  ('Salsa brava',                 ARRAY['Sulfitos']::text[]),
  ('Salsa barbacoa',              ARRAY['Sulfitos','Mostaza']::text[]),
  ('Fingers de pollo',            ARRAY['Gluten','Lácteos']::text[]),
  ('Caldo de pescado y marisco',  ARRAY['Pescado','Crustáceos','Moluscos']::text[]),
  ('Salsa mayo kimchi',           ARRAY['Huevos','Soja','Sésamo']::text[]),
  ('Salsa mayonesa de trufa',     ARRAY['Huevos','Lácteos']::text[]),
  ('Salsa mayonesa de chipotle',  ARRAY['Huevos','Sulfitos']::text[]),
  ('Ali oli de lima',             ARRAY['Huevos']::text[]),
  ('Aliño asiático',              ARRAY['Soja','Sésamo','Gluten']::text[]),
  ('Aliño para tartar',           ARRAY['Soja','Sésamo','Gluten']::text[]),
  ('Salsa de curry rojo',         ARRAY['Lácteos','Sulfitos','Sésamo']::text[])
)
update public.productos p
   set alergenos = m.alerg,
       alergenos_modo = 'manual'
  from m
 where p.tipo = 'elaboracion'
   and p.nombre = m.nombre;
