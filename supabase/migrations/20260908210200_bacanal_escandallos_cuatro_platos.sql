-- ============================================================================
-- Los 4 platos que salían sin alérgenos no tenían escandallo: ensaladilla rusa,
-- gyozas de pollo al curry, alitas en BBQ asiática y torreznos. Se montan con los
-- ingredientes y las cantidades de sus fichas técnicas, y se dejan en modo AUTO
-- para que los alérgenos los coja solos de la cascada.
--
-- Cantidades en gramos (convención del sistema), salvo las que la ficha da en
-- unidades: gyozas (6) y alitas (10).
-- Idempotente: no duplica líneas ya existentes.
-- ============================================================================
do $$
declare
  v_emp uuid; v_plato uuid; v_ing uuid; r record;
begin
  select id into v_emp from public.empresas where nombre = 'BACANAL';
  if v_emp is null then return; end if;

  for r in select * from (values
      ('Ensaladilla Rusa', 'Ensaladilla',                      250),
      ('Ensaladilla Rusa', 'Tobiko naranja',                    10),
      ('Ensaladilla Rusa', 'Aceituna negra expolvoreada',        8),
      ('Ensaladilla Rusa', 'Pani puri golcappa bls. 200 grs.',  10),
      ('Ensaladilla Rusa', 'Cebollino',                          2),
      ('Gyozas pollo al curry', 'Gyozas pollo y verduras',       6),
      ('Gyozas pollo al curry', 'Salsa de curry mango',         25),
      ('Gyozas pollo al curry', 'Mango',                        20),
      ('Gyozas pollo al curry', 'Papel de arroz',               10),
      ('Gyozas pollo al curry', 'Sésamo negro',                  2),
      ('Alitas de pollo glaseadas en bbq asiatica y mayo de aji asiatico', 'Alitas de pollo',    10),
      ('Alitas de pollo glaseadas en bbq asiatica y mayo de aji asiatico', 'Barbacoa asiatica',  60),
      ('Alitas de pollo glaseadas en bbq asiatica y mayo de aji asiatico', 'Polvo de cacahuete', 15),
      ('Alitas de pollo glaseadas en bbq asiatica y mayo de aji asiatico', 'Mayo de ají',        10),
      ('Torreznos con guacamole y pico de gallo', 'Panceta adobada', 150),
      ('Torreznos con guacamole y pico de gallo', 'Guacamole',        60),
      ('Torreznos con guacamole y pico de gallo', 'Pico de gallo',    25)
    ) as t(plato, ingr, cant)
  loop
    select id into v_plato from public.productos
     where empresa_id = v_emp and tipo = 'venta' and nombre = r.plato;
    select id into v_ing from public.productos
     where empresa_id = v_emp and nombre = r.ingr and tipo in ('compra','elaboracion')
     order by case when tipo = 'elaboracion' then 0 else 1 end limit 1;
    if v_plato is null or v_ing is null then continue; end if;
    insert into public.producto_composicion (producto_venta_id, ingrediente_id, cantidad)
    values (v_plato, v_ing, r.cant) on conflict do nothing;
  end loop;

  update public.productos
     set alergenos_modo = 'auto', alergenos = '{}'::text[]
   where empresa_id = v_emp and tipo = 'venta'
     and nombre in ('Ensaladilla Rusa','Gyozas pollo al curry',
                    'Alitas de pollo glaseadas en bbq asiatica y mayo de aji asiatico',
                    'Torreznos con guacamole y pico de gallo');
end $$;
