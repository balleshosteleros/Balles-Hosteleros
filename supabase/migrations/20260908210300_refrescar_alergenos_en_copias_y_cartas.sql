-- ============================================================================
-- Con los escandallos montados, se vuelven a bajar los alérgenos:
--   1) A las copias de HABANA (que van en manual: allí no hay escandallo, el
--      plato se elabora en BACANAL).
--   2) A las fichas de carta de las dos empresas, que es lo que lee el cliente
--      (`carta_items.alergenos` es una copia, no se deriva en caliente).
-- Idempotente.
-- ============================================================================
with pares(habana, bacanal) as (values
  ('Alitas de pollo glaseadas en BBQ asiática',                'Alitas de pollo glaseadas en bbq asiatica y mayo de aji asiatico'),
  ('Bao-cadillo de oreja a baja temperatura con brava y lima', 'Bao-cadillo de oreja a baja temperatura con brava y lima'),
  ('Burger Balles Hosteleros',                                 'Burger Balles Hosteleros'),
  ('Ensaladilla rusa con pan suflado y huevas de tobiko',      'Ensaladilla Rusa'),
  ('Gyozas de pollo al curry con perlas de arroz',             'Gyozas pollo al curry'),
  ('Torreznos con guacamole y pico de gallo',                  'Torreznos con guacamole y pico de gallo'),
  ('Croquetas Jamon Iberico',                                  'Croquetas Jamon Iberico')
),
origen as (
  select pr.habana,
         case when b.alergenos_modo = 'manual' then b.alergenos
              else public.alergenos_derivados(b.id) end as alergenos
    from pares pr
    join public.empresas eb on eb.nombre = 'BACANAL'
    join public.productos b on b.empresa_id = eb.id and b.tipo = 'venta' and b.nombre = pr.bacanal
)
update public.productos h
   set alergenos = o.alergenos, alergenos_modo = 'manual'
  from origen o, public.empresas eh
 where eh.nombre = 'HABANA' and h.empresa_id = eh.id
   and h.tipo = 'venta' and h.nombre = o.habana;

update public.carta_items ci
   set alergenos = case when p.alergenos_modo = 'manual'
                        then p.alergenos
                        else public.alergenos_derivados(p.id) end
  from public.productos p
 where p.id = ci.producto_id;
