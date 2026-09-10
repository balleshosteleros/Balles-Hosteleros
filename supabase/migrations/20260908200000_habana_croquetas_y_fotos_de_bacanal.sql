-- ============================================================================
-- 1) Las croquetas de jamón son el 7º plato de BACANAL que HABANA enseña en su
--    carta, pero no existían en HABANA ni como producto. Se crean como copia
--    independiente: sin agora_id (no está en su terminal) y con
--    visible_terminal = false, porque se comandan y se cobran en BACANAL.
--
-- 2) Las fotos viven en `carta_items.foto_url` (no en el producto). Se copian las
--    mismas imágenes de BACANAL a los platos de HABANA. Comparten fichero en el
--    bucket público `carta-fotos`: si algún día se borra la foto en BACANAL,
--    la de HABANA se queda sin imagen.
--
-- Idempotente: no duplica el producto ni la ficha de carta si ya existen.
-- ============================================================================
do $$
declare
  v_hab   uuid;
  v_bac   uuid;
  v_cat   uuid;
  v_prod  uuid;
  v_seq   int;
  v_orden smallint;
begin
  select id into v_hab from public.empresas where nombre = 'HABANA';
  select id into v_bac from public.empresas where nombre = 'BACANAL';
  if v_hab is null or v_bac is null then return; end if;

  select id into v_prod from public.productos
   where empresa_id = v_hab and tipo = 'venta' and nombre = 'Croquetas Jamon Iberico';

  if v_prod is null then
    select coalesce(max(numero_secuencial), 0) + 1 into v_seq
      from public.productos where empresa_id = v_hab and tipo = 'venta';

    insert into public.productos
      (empresa_id, tipo, nombre, categoria, estado, medida, numero_secuencial,
       precio_venta, iva, carta_texto, visible_carta, visible_terminal,
       alergenos, alergenos_modo)
    select v_hab, 'venta', 'Croquetas Jamon Iberico', 'Delicateses para cenar', 'Activo',
           'Unidades', v_seq,
           b.precio_venta, b.iva, b.carta_texto, true, false,
           public.alergenos_derivados(b.id), 'manual'
      from public.productos b
     where b.empresa_id = v_bac and b.tipo = 'venta' and b.nombre = 'Croquetas Jamon Iberico'
    returning id into v_prod;
  end if;

  select id into v_cat from public.carta_categorias
   where empresa_id = v_hab and nombre = 'Delicateses para cenar';

  if v_cat is not null and v_prod is not null
     and not exists (select 1 from public.carta_items ci
                      where ci.empresa_id = v_hab and ci.producto_id = v_prod) then
    select coalesce(max(orden), 0) + 1 into v_orden
      from public.carta_items where empresa_id = v_hab and categoria_id = v_cat;

    insert into public.carta_items
      (empresa_id, categoria_id, producto_id, nombre, descripcion, precio,
       alergenos, orden, visible)
    select v_hab, v_cat, v_prod, 'Croquetas de jamón ibérico', b.carta_texto,
           b.precio_venta::numeric, public.alergenos_derivados(b.id), v_orden, true
      from public.productos b
     where b.empresa_id = v_bac and b.tipo = 'venta' and b.nombre = 'Croquetas Jamon Iberico';
  end if;
end $$;

with pares(habana, bacanal) as (values
  ('Alitas de pollo glaseadas en BBQ asiática',                'Alitas glaseadas en BBQ asiática'),
  ('Bao-cadillo de oreja a baja temperatura con brava y lima', 'Bao-cadillo de oreja a baja temperatura'),
  ('Burger Balles Hosteleros',                                 'Burger Balles Hosteleros'),
  ('Ensaladilla rusa con pan suflado y huevas de tobiko',      'Ensaladilla rusa'),
  ('Gyozas de pollo al curry con perlas de arroz',             'Gyozas de pollo al curry'),
  ('Torreznos con guacamole y pico de gallo',                  'Torreznos con guacamole y pico de gallo'),
  ('Croquetas de jamón ibérico',                               'Croquetas de jamón ibérico')
),
foto as (
  select distinct on (pr.habana) pr.habana, b.foto_url, b.foto_storage_path
    from pares pr
    join public.empresas eb on eb.nombre = 'BACANAL'
    join public.carta_items b on b.empresa_id = eb.id and b.nombre = pr.bacanal
   where b.foto_url is not null
   order by pr.habana, b.foto_url
)
update public.carta_items ci
   set foto_url = f.foto_url,
       foto_storage_path = f.foto_storage_path
  from foto f, public.empresas eh
 where eh.nombre = 'HABANA'
   and ci.empresa_id = eh.id
   and ci.nombre = f.habana;
