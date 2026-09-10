-- ============================================================================
-- Monta los 6 escandallos que quedaban de comida real, con las cantidades de sus
-- fichas técnicas, todos en modo AUTO para que los alérgenos salgan de la cascada.
--
-- Antes corrige un duplicado introducido en 20260908210100: se creó "Mayo de ají"
-- cuando ya existía "Emulsión de ají amarillo", que es lo mismo. Se conserva el
-- nombre que ya estaba y se borra el nuevo.
--
-- ⚠️ Las cantidades de las elaboraciones nuevas (ragout de setas, espuma de
-- tiramisú) van a 0: no están en las fichas. Los alérgenos salen bien; el coste
-- de esas elaboraciones queda a 0 hasta que cocina las rellene.
-- Idempotente.
-- ============================================================================
do $$
declare v_emp uuid; v_seq int; v_id uuid; v_dup uuid; v_ok uuid; r record;
begin
  select id into v_emp from public.empresas where nombre = 'BACANAL';
  if v_emp is null then return; end if;

  select id into v_ok  from public.productos
   where empresa_id = v_emp and tipo = 'elaboracion' and nombre = 'Emulsión de ají amarillo';
  select id into v_dup from public.productos
   where empresa_id = v_emp and tipo = 'elaboracion' and nombre = 'Mayo de ají';

  if v_ok is not null then
    for r in select * from (values ('Mayonesa'), ('Pasta ají amarillo')) as t(ingr) loop
      insert into public.producto_composicion (producto_venta_id, ingrediente_id, cantidad)
      select v_ok, i.id, 0 from public.productos i
       where i.empresa_id = v_emp and i.tipo = 'compra' and i.nombre = r.ingr limit 1
      on conflict do nothing;
    end loop;
    if v_dup is not null then
      update public.producto_composicion pc set ingrediente_id = v_ok
       where pc.ingrediente_id = v_dup
         and not exists (select 1 from public.producto_composicion o
                          where o.producto_venta_id = pc.producto_venta_id and o.ingrediente_id = v_ok);
      delete from public.producto_composicion where ingrediente_id = v_dup;
      delete from public.productos where id = v_dup;
    end if;
  end if;

  for r in select * from (values
      ('Mix de setas congeladas',  'Despensa', ARRAY['Sin alérgenos']::text[]),
      ('Coulant de chocolate',     'Despensa', ARRAY['Gluten','Huevos','Lácteos','Soja']::text[]),
      ('Base de galleta de café',  'Despensa', ARRAY['Gluten','Lácteos']::text[])
    ) as t(nombre, categoria, alerg)
  loop
    if not exists (select 1 from public.productos
                    where empresa_id = v_emp and tipo = 'compra' and nombre = r.nombre) then
      select coalesce(max(numero_secuencial), 0) + 1 into v_seq
        from public.productos where empresa_id = v_emp and tipo = 'compra';
      insert into public.productos
        (empresa_id, tipo, nombre, categoria, estado, medida, numero_secuencial, alergenos, alergenos_modo)
      values (v_emp, 'compra', r.nombre, r.categoria, 'Activo', 'Kilogramos', v_seq, r.alerg, 'manual');
    end if;
  end loop;

  for r in select * from (values ('Ragout de setas'), ('Espuma de tiramisú')) as t(nombre) loop
    if not exists (select 1 from public.productos
                    where empresa_id = v_emp and tipo = 'elaboracion' and nombre = r.nombre) then
      select coalesce(max(numero_secuencial), 0) + 1 into v_seq
        from public.productos where empresa_id = v_emp and tipo = 'elaboracion';
      insert into public.productos
        (empresa_id, tipo, nombre, categoria, estado, medida, numero_secuencial, alergenos, alergenos_modo)
      values (v_emp, 'elaboracion', r.nombre, 'Sin categoría', 'Activo', 'Kilogramos', v_seq, '{}'::text[], 'auto');
    end if;
  end loop;

  for r in select * from (values
      ('Ragout de setas','Mix de setas congeladas'),('Ragout de setas','Cebolla'),
      ('Ragout de setas','Nata para montar 35%'),('Ragout de setas','Salsa tartufata'),
      ('Espuma de tiramisú','Nata para montar 35%'),('Espuma de tiramisú','Huevo')
    ) as t(elab, ingr)
  loop
    select id into v_id from public.productos
     where empresa_id = v_emp and tipo = 'elaboracion' and nombre = r.elab;
    if v_id is null then continue; end if;
    insert into public.producto_composicion (producto_venta_id, ingrediente_id, cantidad)
    select v_id, i.id, 0 from public.productos i
     where i.empresa_id = v_emp and i.tipo = 'compra' and i.nombre = r.ingr limit 1
    on conflict do nothing;
  end loop;

  for r in select * from (values
      ('Falso risotto con setas','Puntalette',100),('Falso risotto con setas','Ragout de setas',70),
      ('Falso risotto con setas','Salsa tartufata',10),('Falso risotto con setas','Nata para montar 35%',80),
      ('Entrecot Lomo bajo frisona','Lomo bajo frisona ( 350 gr )',350),
      ('Entrecot Lomo bajo frisona','Patatas fritas',150),('Entrecot Lomo bajo frisona','Pimientos fritos',30),
      ('Alcachofas con huevo de codorniz','Alcachofa confitada',2),
      ('Alcachofas con huevo de codorniz','Emulsión de ají amarillo',20),
      ('Alcachofas con huevo de codorniz','Huevo de codorniz',20),
      ('Alcachofas con huevo de codorniz','Pure de patatas',20),
      ('Alcachofas con huevo de codorniz','Paleta cebo ibérico 50% loncheada',15),
      ('Huevos rotos con jamon iberico y patatas','Patatas fritas',120),
      ('Huevos rotos con jamon iberico y patatas','Huevo',1),
      ('Huevos rotos con jamon iberico y patatas','Paleta cebo ibérico 50% loncheada',13),
      ('Coulant de Chocolate','Coulant de chocolate',1),('Coulant de Chocolate','Helado de vainilla',40),
      ('Tiramisu','Espuma de tiramisú',70),('Tiramisu','Base de galleta de café',25)
    ) as t(plato, ingr, cant)
  loop
    select id into v_id from public.productos
     where empresa_id = v_emp and tipo = 'venta' and nombre = r.plato;
    if v_id is null then continue; end if;
    insert into public.producto_composicion (producto_venta_id, ingrediente_id, cantidad)
    select v_id, i.id, r.cant from public.productos i
     where i.empresa_id = v_emp and i.nombre = r.ingr and i.tipo in ('compra','elaboracion')
     order by case when i.tipo = 'elaboracion' then 0 else 1 end limit 1
    on conflict do nothing;
  end loop;

  update public.productos set alergenos_modo = 'auto', alergenos = '{}'::text[]
   where empresa_id = v_emp and tipo = 'venta'
     and nombre in ('Falso risotto con setas','Entrecot Lomo bajo frisona',
                    'Alcachofas con huevo de codorniz','Huevos rotos con jamon iberico y patatas',
                    'Coulant de Chocolate','Tiramisu');
end $$;
