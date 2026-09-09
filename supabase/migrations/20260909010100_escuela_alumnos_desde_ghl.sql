-- ESCUELA — los alumnos que estaban en GoHighLevel, con su ficha de cliente.
--
-- Son los 49 miembros del listado de GoHighLevel a 09-09-2026. De cada uno
-- se trae lo que allí se guardaba: nombre, correo, el día que entró («miembro
-- desde»), la última vez que abrió la escuela y cuántas veces ha entrado. Ion
-- Paredes Polo tenía DOS fichas con el mismo correo: aquí es un solo alumno,
-- con el alta más antigua y el último acceso más reciente. Las horas del último
-- acceso no se traen: en GoHighLevel se leen a nivel de día.
--
-- El correo manda: quien ya esté dado de alta no se toca, y quien tenga ficha
-- de cliente en BALLES queda enganchado a ella por el correo. A quien no la
-- tenga no se le inventa una: se queda sin enlace.
--
-- Reejecutable: no duplica alumnos ni cursos.

do $$
declare
  v_empresa uuid;
begin
  select id into v_empresa from public.empresas where es_matriz = true limit 1;
  if v_empresa is null then
    raise notice 'Sin empresa matriz: la escuela no se siembra.';
    return;
  end if;

  -- Los dos cursos que faltaban. El de aperturas está anunciado y todavía sin
  -- contenido: sale con el distintivo «Próximamente».
  insert into public.formacion_cursos (empresa_id, ambito, titulo, descripcion, categoria, orden, publicado, proximamente, autor, fecha_publicacion)
  select v_empresa, 'escuela', v.titulo, v.descripcion, 'otros', v.orden, true, v.proximamente, 'Iván Ballesteros', date '2026-09-09'
  from (values
    ('Sistemas operativos para hostelería', 'Los sistemas que sostienen un restaurante que funciona sin ti delante.', 1, false),
    ('Expansión para aperturas hosteleras', 'Abrir el siguiente local sin repetir los errores del primero.', 2, true)
  ) as v(titulo, descripcion, orden, proximamente)
  where not exists (
    select 1 from public.formacion_cursos c
    where c.empresa_id = v_empresa and c.ambito = 'escuela' and lower(c.titulo) = lower(v.titulo)
  );

  -- Los alumnos.
  insert into public.escuela_alumnos (empresa_id, nombre, email, created_at, ultimo_acceso_at, accesos_num, acceso_total, estado, origen)
  select v_empresa, v.nombre, v.email,
         (v.alta::date + time '12:00') at time zone 'Europe/Madrid',
         case when v.ultimo = '' then null else (v.ultimo::date + time '12:00') at time zone 'Europe/Madrid' end,
         v.accesos, true, 'ACTIVO', 'GOHIGHLEVEL'
  from (values
    ('Santiago Jimenez Cespedes','mondonapoli.es@gmail.com','2026-01-12','2026-03-10',17),
    ('David Aragon','david@eldasl.com','2025-03-29','',0),
    ('Osmani','osmanigp@hotmail.com','2025-03-29','',0),
    ('Luis Roberto Flores Basaldua','roo.basaldua@gmail.com','2025-11-30','2026-05-12',11),
    ('Stela Gero Reol','sol33luna33@gmail.com','2026-04-16','2026-06-10',7),
    ('Prueba Edu Prueba','marketingotyedu@gmail.com','2026-05-04','2026-06-19',3),
    ('Samuel Pérez','sperezmartinez53@gmail.com','2025-04-10','2025-04-10',1),
    ('Roberto Vicedo Valor','rvicval@gmail.com','2026-01-28','2026-01-29',3),
    ('Maria Sáez Peris','msaezperis@hotmail.com','2025-05-30','2025-06-06',6),
    ('Maria Teresa Pons Guardia Pons','teiaponsguar@gmail.com','2026-02-24','',0),
    ('Doro','dorocucinamadrid@gmail.com','2026-04-07','2026-06-08',10),
    ('Jose Iván','mesonesasturias@gmail.com','2025-03-29','2025-05-28',6),
    ('Doro','direccion.dorocucina@gmail.com','2026-04-29','2026-04-29',1),
    ('Miguel Faidella','miguelfaidella@gmail.com','2025-03-29','2025-04-08',2),
    ('Mireia','nuevocafesalonperez@gmail.com','2025-03-29','2026-06-03',5),
    ('Carlos Ruiz','carliruizdolera@gmail.com','2025-04-02','2025-04-29',11),
    ('Yaritza Rey Moncada','yrey@gmx.es','2025-08-22','2026-03-06',5),
    ('Juan Jose','crespocuatrojotas@gmail.com','2025-05-14','2025-05-19',2),
    ('Adria Ramirez Via','aramirezvia@outlook.com','2026-03-13','2026-08-19',3),
    ('Andrea Ribes Ivars','ribesivarsandrea@gmail.com','2025-03-29','2026-05-04',3),
    ('Ariel Vázquez','arielvazquez1990@gmail.com','2025-09-11','2026-02-19',22),
    ('Javi','kaisserjav@hotmail.com','2025-03-29','2025-10-28',4),
    ('Elena Garnik','alenagarnik@gmail.com','2026-03-23','2026-09-02',7),
    ('Jesus González Morillo','gonzalezmorillo15@gmail.com','2025-05-21','2025-11-03',5),
    ('Juan Jose','admin@elrincondejuan.es','2025-03-12','2025-05-29',4),
    ('Karina Liliana','karinarando@creantespais.com','2025-03-29','',0),
    ('Ruth Sarabia Mendez','calaruth89@gmail.com','2025-09-26','2025-09-28',5),
    ('Jose Portolés','joseportoleshu@gmail.com','2026-02-11','2026-08-26',7),
    ('javier','recrudoburguer@gmail.com','2025-04-02','',0),
    ('Pepe','pepevb_75@hotmail.com','2026-04-14','',0),
    ('Jose','jafccinka@gmail.com','2025-03-29','',0),
    ('Guillem Masot','direccion.neoparc@gmail.com','2026-02-27','2026-05-06',6),
    ('Gloria Monzon','camiyjaz@hotmail.com','2025-03-29','',0),
    ('Kevin','seleccionrialv@gmail.com','2025-03-29','',0),
    ('Guillem Masot Rubio','guillem.masot@hotmail.com','2026-02-11','2026-02-16',2),
    ('Jose ivan','joseivanfernandezguijarro@gmail.com','2026-03-20','',0),
    ('Oscar Tabares','oscartabares74@gmail.com','2026-06-19','2026-08-19',6),
    ('Miguel','lalobaestudia@gmail.com','2025-03-29','2025-10-03',2),
    ('Rogelio Giner','roge@pastamanias.com','2025-10-01','2026-01-12',21),
    ('Francisco de Diego Pulgar','frndediego@gmail.com','2025-09-17','2025-11-25',8),
    ('María José Fernández Calatrava','mariajosefercal@gmail.com','2025-10-13','2026-01-21',6),
    ('Stella Gero','almetro75@gmail.com','2026-03-28','',0),
    ('Sandra Rodriguez','sandrarodriguezcosta@gmail.com','2025-03-29','2026-02-02',1),
    ('Daniel Perez','danielperezhernandezrd@gmail.com','2025-03-29','',0),
    ('Francisco Javier Mora Díaz','fjmd158@gmail.com','2026-08-13','2026-08-13',1),
    ('Sindy Bradford','sindybradford@gmail.com','2026-02-05','2026-03-27',7),
    ('Mohamed Regragui Sebai','grupotarila@gmail.com','2025-12-04','2026-02-02',1),
    ('Hassan Nassereddine Mamlouk','ayunegestiones@gmail.com','2025-04-17','2025-05-15',5),
    ('Ion Paredes Polo','ionpa11@gmail.com','2026-02-05','2026-03-20',5)
  ) as v(nombre, email, alta, ultimo, accesos)
  on conflict (empresa_id, lower(email)) do nothing;

  -- Y el enganche con su ficha de cliente, por correo. Solo se rellena lo que
  -- esté vacío: un enlace puesto a mano manda sobre el automático.
  update public.escuela_alumnos a
     set cliente_id = c.id
    from public.clientes_sala c
   where a.empresa_id = v_empresa
     and a.cliente_id is null
     and c.empresa_id = v_empresa
     and lower(c.email) = lower(a.email);
end $$;
