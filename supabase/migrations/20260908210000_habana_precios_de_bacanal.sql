-- ============================================================================
-- Los 7 platos de BACANAL que HABANA enseña en su carta se cobran en BACANAL,
-- así que el precio que ve el cliente tiene que ser el de allí. De los 7 solo
-- dos estaban distintos: la burger (14,80 → 15,80) y la ensaladilla (10,70 → 12,70).
-- Se actualiza el producto (precio maestro) y la ficha de carta (la copia que lee
-- la carta pública). El gofre NO se toca: ese es de HABANA y lo cobran ellos.
-- Idempotente.
-- ============================================================================
with pares(bacanal, habana) as (values
  ('Alitas de pollo glaseadas en bbq asiatica y mayo de aji asiatico', 'Alitas de pollo glaseadas en BBQ asiática'),
  ('Bao-cadillo de oreja a baja temperatura con brava y lima',         'Bao-cadillo de oreja a baja temperatura con brava y lima'),
  ('Burger Balles Hosteleros',                                         'Burger Balles Hosteleros'),
  ('Ensaladilla Rusa',                                                 'Ensaladilla rusa con pan suflado y huevas de tobiko'),
  ('Gyozas pollo al curry',                                            'Gyozas de pollo al curry con perlas de arroz'),
  ('Torreznos con guacamole y pico de gallo',                          'Torreznos con guacamole y pico de gallo'),
  ('Croquetas Jamon Iberico',                                          'Croquetas Jamon Iberico')
),
precio as (
  select pr.habana, to_char(round(b.precio_venta::numeric, 2), 'FM999999990.00') as pvp
    from pares pr
    join public.empresas eb on eb.nombre = 'BACANAL'
    join public.productos b on b.empresa_id = eb.id and b.tipo = 'venta' and b.nombre = pr.bacanal
   where b.precio_venta ~ '^[0-9]+([.,][0-9]+)?$'
),
upd_prod as (
  update public.productos h set precio_venta = p.pvp
    from precio p, public.empresas eh
   where eh.nombre = 'HABANA' and h.empresa_id = eh.id
     and h.tipo = 'venta' and h.nombre = p.habana
  returning h.id
)
update public.carta_items ci set precio = p.pvp::numeric
  from precio p, public.empresas eh, public.productos h
 where eh.nombre = 'HABANA' and ci.empresa_id = eh.id
   and h.empresa_id = eh.id and h.tipo = 'venta' and h.nombre = p.habana
   and ci.producto_id = h.id;
