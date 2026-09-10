-- ============================================================================
-- Para que los alérgenos de 4 platos salgan SOLOS hay que darle a la cascada de
-- qué tirar: los ingredientes de compra marcados, y las salsas y guarniciones
-- montadas como elaboraciones con su propia composición.
--
-- Las elaboraciones se crean en modo AUTO a propósito: no se les marca ningún
-- alérgeno a mano, lo sacan de sus propios ingredientes. Así, el día que cambie
-- un ingrediente, el alérgeno cambia solo hasta el plato.
--
-- ⚠️ Las CANTIDADES de estas elaboraciones quedan a 0: no están en las fichas
-- técnicas. Para los alérgenos da igual (la cascada no mira cantidades), pero el
-- coste de estas elaboraciones saldrá a 0 hasta que cocina las rellene.
--
-- Idempotente: no crea nada que ya exista.
-- ============================================================================
do $$
declare
  v_emp uuid; v_seq int; v_id uuid; r record;
begin
  select id into v_emp from public.empresas where nombre = 'BACANAL';
  if v_emp is null then return; end if;

  for r in select * from (values
      ('Salsa de soja',      'Despensa', ARRAY['Soja','Gluten']::text[]),
      ('Polvo de cacahuete', 'Despensa', ARRAY['Cacahuetes']::text[])
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

  update public.productos
     set alergenos = ARRAY['Gluten']::text[], alergenos_modo = 'manual'
   where empresa_id = v_emp and tipo = 'compra'
     and nombre = 'Pani puri golcappa bls. 200 grs.'
     and coalesce(cardinality(alergenos), 0) = 0;

  for r in select * from (values
      ('Ensaladilla'),('Guacamole'),('Pico de gallo'),
      ('Barbacoa asiatica'),('Mayo de ají'),('Salsa de curry mango')
    ) as t(nombre)
  loop
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
      ('Ensaladilla','Patata lavada'),('Ensaladilla','Zanahoria'),('Ensaladilla','Huevo'),
      ('Ensaladilla','Atún en aceite vegetal'),('Ensaladilla','Mayonesa'),
      ('Guacamole','Aguacate'),('Guacamole','Limas'),
      ('Pico de gallo','Tomate Cherry'),('Pico de gallo','Cebolla roja'),
      ('Pico de gallo','Cilantro'),('Pico de gallo','Limas'),
      ('Barbacoa asiatica','Salsa de soja'),('Barbacoa asiatica','Kimuchi no moto'),
      ('Barbacoa asiatica','Salsa barbacoa'),
      ('Mayo de ají','Mayonesa'),('Mayo de ají','Pasta ají amarillo'),
      ('Salsa de curry mango','Nata para montar 35%'),('Salsa de curry mango','Mango')
    ) as t(elab, ingr)
  loop
    select id into v_id from public.productos
     where empresa_id = v_emp and tipo = 'elaboracion' and nombre = r.elab;
    if v_id is null then continue; end if;
    insert into public.producto_composicion (producto_venta_id, ingrediente_id, cantidad)
    select v_id, i.id, 0 from public.productos i
     where i.empresa_id = v_emp and i.nombre = r.ingr and i.tipo = 'compra' limit 1
    on conflict do nothing;
  end loop;
end $$;
