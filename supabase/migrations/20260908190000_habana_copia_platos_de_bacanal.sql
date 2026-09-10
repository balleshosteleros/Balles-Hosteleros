-- ============================================================================
-- Los 6 platos de "Delicateses para cenar" de HABANA son platos de BACANAL: se
-- comandan y se sirven allí, en HABANA solo salen en la carta (por eso son los
-- únicos productos de HABANA sin `agora_id`, no están en su terminal).
--
-- Se copian los datos de presentación desde el gemelo de BACANAL para que las dos
-- cartas digan lo mismo. Son COPIAS INDEPENDIENTES, no un vínculo: cada empresa
-- mantiene su propia fila, su propio precio y su propio catálogo.
--
-- Se copia: nombre de carta, texto, destacado, alérgenos (con su modo) y foto.
-- NO se copia: precio, agora_id, categoría, numeración ni nada de stock.
--
-- Idempotente: empareja por nombre exacto y reescribe el mismo valor si se repite.
-- ============================================================================
with pares(habana, bacanal) as (values
  ('Alitas de pollo glaseadas en BBQ asiática',            'Alitas de pollo glaseadas en bbq asiatica y mayo de aji asiatico'),
  ('Bao-cadillo de oreja a baja temperatura con brava y lima', 'Bao-cadillo de oreja a baja temperatura con brava y lima'),
  ('Burger Balles Hosteleros',                             'Burger Balles Hosteleros'),
  ('Ensaladilla rusa con pan suflado y huevas de tobiko',  'Ensaladilla Rusa'),
  ('Gyozas de pollo al curry con perlas de arroz',         'Gyozas pollo al curry'),
  ('Torreznos con guacamole y pico de gallo',              'Torreznos con guacamole y pico de gallo')
),
origen as (
  select pr.habana,
         b.carta_nombre, b.carta_texto, b.carta_destacado, b.estilo_imagen_url,
         case when b.alergenos_modo = 'manual'
              then b.alergenos
              else public.alergenos_derivados(b.id)
         end as alergenos
    from pares pr
    join public.empresas eb on eb.nombre = 'BACANAL'
    join public.productos b on b.empresa_id = eb.id and b.tipo = 'venta' and b.nombre = pr.bacanal
)
update public.productos h
   set carta_nombre      = o.carta_nombre,
       carta_texto       = o.carta_texto,
       carta_destacado   = o.carta_destacado,
       estilo_imagen_url = coalesce(o.estilo_imagen_url, h.estilo_imagen_url),
       alergenos         = o.alergenos,
       alergenos_modo    = 'manual'
  from origen o, public.empresas eh
 where eh.nombre = 'HABANA'
   and h.empresa_id = eh.id
   and h.tipo = 'venta'
   and h.nombre = o.habana;
