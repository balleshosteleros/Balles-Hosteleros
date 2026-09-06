-- ============================================================================
-- Segunda pasada sobre productos de COMPRA que seguían con el 'Sin alérgenos'
-- del seed y que sí llevan alérgeno por su propia naturaleza o receta industrial.
--
-- Criterio: solo se marca lo que es seguro por composición conocida del producto.
-- Lo que depende de marca concreta (siropes, purés Prebeach/Oxefruit, chuches)
-- se deja sin tocar y se pregunta al proveedor antes de declararlo.
-- Idempotente: empareja por nombre exacto y tipo='compra', en todas las empresas.
-- ============================================================================
with m(nombre, alerg) as (values
  ('Barquillos',      ARRAY['Gluten','Huevos','Lácteos']::text[]),
  ('Oreo',            ARRAY['Gluten','Soja']::text[]),
  ('Chocogrofe',      ARRAY['Gluten','Huevos','Lácteos','Soja']::text[]),
  ('Helado',          ARRAY['Lácteos']::text[]),
  ('Cacao en Polvo',  ARRAY['Soja']::text[]),
  ('Sirope Chocolate',ARRAY['Soja']::text[]),
  ('Coco',            ARRAY['Frutos con cáscara']::text[]),
  ('Oxefruit Coco',   ARRAY['Frutos con cáscara']::text[]),
  ('Prebeach Coco Colado',     ARRAY['Frutos con cáscara']::text[]),
  ('Prebeach Coco Colado Sin', ARRAY['Frutos con cáscara']::text[]),
  ('Zumo Melocoton',  ARRAY['Sulfitos']::text[]),
  ('Zumo Naranja',    ARRAY['Sulfitos']::text[]),
  ('Zumo Piña',       ARRAY['Sulfitos']::text[]),
  ('Melocoton S.A',   ARRAY['Sulfitos']::text[]),
  ('Granadina',       ARRAY['Sulfitos']::text[]),
  ('Pulco',           ARRAY['Sulfitos']::text[]),
  ('Cofrutos Melocoton', ARRAY['Sulfitos']::text[]),
  ('Cofrutos Naranja',   ARRAY['Sulfitos']::text[]),
  ('Cofrutos Piña',      ARRAY['Sulfitos']::text[]),
  ('Manzanilla',      ARRAY['Sin alérgenos']::text[]),
  ('Te Negro',        ARRAY['Sin alérgenos']::text[]),
  ('Te Rojo',         ARRAY['Sin alérgenos']::text[]),
  ('Te Verde',        ARRAY['Sin alérgenos']::text[]),
  ('Nescafe',         ARRAY['Sin alérgenos']::text[])
)
update public.productos p
   set alergenos = m.alerg,
       alergenos_modo = 'manual'
  from m
 where p.tipo = 'compra'
   and p.nombre = m.nombre;
