-- ============================================================
-- Seed de 14 patrones para BACANAL (idempotente).
-- creado_por_user_id queda NULL (snapshot histórico).
-- creado_por_nombre persiste "Ivan Ballesteros" / "Alejandro Mojica".
-- ============================================================

do $$
declare
  v_empresa_id uuid;
  rec record;
begin
  select id into v_empresa_id
  from public.empresas
  where upper(nombre) = 'BACANAL'
  limit 1;

  if v_empresa_id is null then
    raise notice 'Empresa BACANAL no encontrada — saltando seed';
    return;
  end if;

  for rec in (
    select * from (values
      ('a0000000-0000-0000-0000-000000000001'::uuid, 'ARTISTA 1',           'Ivan Ballesteros',   '[null,null,null,null,null,"bt-art-cenas",null]'::jsonb),
      ('a0000000-0000-0000-0000-000000000002'::uuid, 'ARTISTA 2',           'Ivan Ballesteros',   '[null,null,null,null,null,null,"bt-art-cenas"]'::jsonb),
      ('a0000000-0000-0000-0000-000000000003'::uuid, 'CALIDAD',             'Ivan Ballesteros',   '[null,null,null,"bt-cal",null,null,null]'::jsonb),
      ('a0000000-0000-0000-0000-000000000004'::uuid, 'CAMARERO 1',          'Ivan Ballesteros',   '[null,null,null,null,"bt-cam-vie","bt-cam-sab",null]'::jsonb),
      ('a0000000-0000-0000-0000-000000000005'::uuid, 'CAMARERO FINDES',     'Alejandro Mojica',   '[null,null,null,null,null,"bt-cam-sab","bt-cam-dom"]'::jsonb),
      ('a0000000-0000-0000-0000-000000000006'::uuid, 'COCINERO',            'Ivan Ballesteros',   '["bt-coc-lun","bt-coc-mar",null,"bt-coc-jue","bt-coc-vie","bt-coc-sab","bt-coc-dom"]'::jsonb),
      ('a0000000-0000-0000-0000-000000000007'::uuid, 'JEFE COCINA 3',       'Alejandro Mojica',   '[null,null,null,null,"bt-jc3-vie","bt-jc3-sab","bt-jc3-dom"]'::jsonb),
      ('a0000000-0000-0000-0000-000000000008'::uuid, 'JEFE DE COCINA 3..',  'Alejandro Mojica',   '[null,null,null,null,"bt-coc-vie","bt-coc-sab","bt-coc-dom"]'::jsonb),
      ('a0000000-0000-0000-0000-000000000009'::uuid, 'JEFE DE SALA 1',      'Ivan Ballesteros',   '[null,null,null,"bt-emd-diario","bt-enc-vie","bt-en1-sab",null]'::jsonb),
      ('a0000000-0000-0000-0000-00000000000a'::uuid, 'JEFE DE SALA 2',      'Ivan Ballesteros',   '[null,null,null,"bt-etd-diario","bt-en2-vie","bt-en2-sab","bt-enc-dom"]'::jsonb),
      ('a0000000-0000-0000-0000-00000000000b'::uuid, 'JEFE DE SALA 3',      'Ivan Ballesteros',   '[null,null,null,null,"bt-jef-vie","bt-jef-sab","bt-edm-dom"]'::jsonb),
      ('a0000000-0000-0000-0000-00000000000c'::uuid, 'LIMPIEZA/OFFICE',     'Ivan Ballesteros',   '["bt-lim-diario",null,null,null,"bt-lpo-vie","bt-lpo-sab","bt-lpo-dom"]'::jsonb),
      ('a0000000-0000-0000-0000-00000000000d'::uuid, 'MANTENIMIENTO',       'Ivan Ballesteros',   '[null,null,"bt-man-diario",null,null,null,null]'::jsonb),
      ('a0000000-0000-0000-0000-00000000000e'::uuid, 'Plantilla sin nombre','Ivan Ballesteros',   '[null,"bt-con",null,null,null,null,null]'::jsonb)
    ) as t(id, nombre, creador, dias)
  ) loop
    insert into public.rrhh_patrones (id, empresa_id, nombre, tipo, creado_por_nombre)
    values (rec.id, v_empresa_id, rec.nombre, 'semanal', rec.creador)
    on conflict (id) do nothing;

    insert into public.rrhh_patron_semanas (patron_id, orden, dias)
    values (rec.id, 0, rec.dias)
    on conflict (patron_id, orden) do nothing;
  end loop;
end $$;
