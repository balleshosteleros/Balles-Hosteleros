-- "Para empezar" de BACANAL: los recomendados dejan de ir en bloque.
--
-- Los cuatro platos con estrella abrian la categoria uno detras de otro: la
-- recomendacion se lee como el principio de la carta, no como recomendacion, y
-- lo que viene despues parece relleno. Intercalados, la estrella vuelve a
-- destacar y el ojo recorre la categoria entera.
--
-- Idempotente: fija la posicion exacta de cada plato.
with orden (item_id, pos) as (
  values
    ('7e18090e-f998-4f94-a008-6f37e929de0b'::uuid, 1),   -- Alcachofas ★
    ('fc939e8c-8c88-43ec-bce3-b16979ff0b6c'::uuid, 2),   -- Croquetas
    ('483bf980-e562-4eaf-85b7-b3c61ba41fff'::uuid, 3),   -- Torreznos ★
    ('f8520023-516a-44c7-a57d-8efc0c802d78'::uuid, 4),   -- Ensaladilla rusa
    ('53491d00-44ac-476c-b9a0-09e081c1d821'::uuid, 5),   -- Ceviche Thai ★
    ('311bbd39-5205-4ec0-b4c8-00bba25bd92e'::uuid, 6),   -- Ensalada de burrata
    ('37a1bf3c-6e86-46e1-bc5a-bc6d835c9f15'::uuid, 7),   -- Tortilla trufada ★
    ('94c25b4d-90f3-4e51-86b5-4e5d31958e92'::uuid, 8),   -- Huevos rotos
    ('778baa8f-4fac-4a70-a7c0-f4016710924c'::uuid, 9),   -- Alitas BBQ
    ('a3b47cbb-21b9-4453-aa76-e76e7b9b0431'::uuid, 10),  -- Jamon iberico
    ('80e9183a-ba76-45f9-9573-9caeccae2dc9'::uuid, 11)   -- Servicio de pan
)
update public.carta_items ci
   set orden = o.pos, updated_at = now()
  from orden o
 where ci.id = o.item_id
   and ci.orden is distinct from o.pos;
