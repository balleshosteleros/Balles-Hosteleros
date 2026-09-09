-- ESCUELA — los alumnos que faltaban, los de la última página de GoHighLevel.
--
-- La migración anterior trajo los que se leían en el listado largo. A diez por
-- página, GoHighLevel tenía seis páginas: en la última quedaban estos ocho.
-- Con ellos son 57 alumnos, que en GoHighLevel eran 59 filas: Ion Paredes Polo
-- estaba dos veces con el mismo correo, e IVÁN NO CUENTA COMO ALUMNO aunque
-- salga en la lista con 52 entradas — es el mentor, no un matriculado.
--
-- Reejecutable: no duplica a nadie.
do $$
declare
  v_empresa uuid;
begin
  select id into v_empresa from public.empresas where es_matriz = true limit 1;
  if v_empresa is null then
    raise notice 'Sin empresa matriz: la escuela no se siembra.';
    return;
  end if;

  insert into public.escuela_alumnos (empresa_id, nombre, email, created_at, ultimo_acceso_at, accesos_num, acceso_total, estado, origen)
  select v_empresa, v.nombre, v.email,
         (v.alta::date + time '12:00') at time zone 'Europe/Madrid',
         case when v.ultimo = '' then null else (v.ultimo::date + time '12:00') at time zone 'Europe/Madrid' end,
         v.accesos, true, 'ACTIVO', 'GOHIGHLEVEL'
  from (values
    ('David Villanueva Luque','restaurantsantjaume2024@gmail.com','2025-03-29','2026-02-05',3),
    ('Jalil Akhezzan','akhezzan27@gmail.com','2026-01-14','2026-01-30',2),
    ('Marina Florencia Kolesnik','emprendimientoscalona@gmail.com','2025-10-17','2025-11-17',4),
    ('Eduardo Muñoz','eduardomunozcabrera33@gmail.com','2025-03-29','',0),
    ('Luis Martinez Mataix','luis@grupobamboo.es','2025-03-29','2025-09-30',4),
    ('doro','contabilidad.dorocucina@gmail.com','2026-05-26','2026-05-22',1),
    ('Angel Barbero','angelbarbero22@gmail.com','2025-03-29','2025-05-06',2),
    ('Ana Casas','ana.casas.til@gmail.com','2025-03-29','2025-05-23',2)
  ) as v(nombre, email, alta, ultimo, accesos)
  on conflict (empresa_id, lower(email)) do nothing;

  -- Y el enganche con su ficha de cliente, por correo. Se vuelve a pasar por
  -- todos: las fichas de cliente de la matriz siguen llegando, y un alumno que
  -- ayer no tenía ninguna hoy puede tenerla.
  update public.escuela_alumnos a
     set cliente_id = c.id
    from public.clientes_sala c
   where a.empresa_id = v_empresa
     and a.cliente_id is null
     and c.empresa_id = v_empresa
     and lower(c.email) = lower(a.email);
end $$;
