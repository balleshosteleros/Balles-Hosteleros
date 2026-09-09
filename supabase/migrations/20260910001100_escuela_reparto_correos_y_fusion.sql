-- ESCUELA — repartir los correos y juntar a quien estaba dos veces.
--
-- Cada correo se coloca donde va: los de dominio propio y los que son del
-- negocio (dirección, contabilidad, el nombre del restaurante) en
-- `email_empresa`; los demás en `email_personal`. Es una CLASIFICACIÓN, no se
-- inventa ni se cambia ningún correo, y se puede corregir a mano desde la ficha.
--
-- Guillem Masot estaba dos veces, una por cada correo con el que entró: se
-- queda UNA ficha, con la fecha de alta más antigua, la suma de las entradas y
-- el último acceso más reciente. La llave de acceso pasa a ser la de empresa,
-- igual que el login de un empleado, pero al portal se entra con las dos.
do $$
declare
  v_empresa uuid;
  v_vive uuid;
  v_muere uuid;
  v_cliente uuid;
begin
  select id into v_empresa from public.empresas where es_matriz = true limit 1;
  if v_empresa is null then return; end if;

  -- 1) Reparto. Solo se rellena lo que esté vacío: lo corregido a mano manda.
  update public.escuela_alumnos
     set email_empresa = email
   where empresa_id = v_empresa
     and email_empresa is null and email_personal is null
     and lower(email) in (
       'admin@elrincondejuan.es','david@eldasl.com','karinarando@creantespais.com',
       'luis@grupobamboo.es','roge@pastamanias.com','ayunegestiones@gmail.com',
       'contabilidad.dorocucina@gmail.com','direccion.dorocucina@gmail.com',
       'direccion.neoparc@gmail.com','dorocucinamadrid@gmail.com',
       'emprendimientoscalona@gmail.com','grupotarila@gmail.com',
       'mesonesasturias@gmail.com','mondonapoli.es@gmail.com',
       'nuevocafesalonperez@gmail.com','recrudoburguer@gmail.com',
       'restaurantsantjaume2024@gmail.com','seleccionrialv@gmail.com',
       'marketingotyedu@gmail.com'
     );

  update public.escuela_alumnos
     set email_personal = email
   where empresa_id = v_empresa
     and email_empresa is null and email_personal is null;

  -- 2) Guillem Masot: dos fichas, una persona.
  select id into v_vive from public.escuela_alumnos
   where empresa_id = v_empresa and lower(email) = 'guillem.masot@hotmail.com';
  select id, cliente_id into v_muere, v_cliente from public.escuela_alumnos
   where empresa_id = v_empresa and lower(email) = 'direccion.neoparc@gmail.com';

  if v_vive is not null and v_muere is not null then
    -- Lo que hubiera hecho en la ficha que se va, a la que se queda.
    update public.escuela_progreso set alumno_id = v_vive where alumno_id = v_muere;
    update public.escuela_matriculas set alumno_id = v_vive where alumno_id = v_muere;

    update public.escuela_alumnos a
       set accesos_num = a.accesos_num + m.accesos_num,
           ultimo_acceso_at = greatest(
             coalesce(a.ultimo_acceso_at, m.ultimo_acceso_at),
             coalesce(m.ultimo_acceso_at, a.ultimo_acceso_at)
           ),
           cliente_id = coalesce(a.cliente_id, v_cliente),
           nombre = 'Guillem Masot Rubio',
           email_personal = 'guillem.masot@hotmail.com',
           email_empresa = 'direccion.neoparc@gmail.com'
      from public.escuela_alumnos m
     where a.id = v_vive and m.id = v_muere;

    -- La de sobra se va ANTES de mover la llave: el correo es único por empresa.
    delete from public.escuela_alumnos where id = v_muere;
    update public.escuela_alumnos set email = 'direccion.neoparc@gmail.com' where id = v_vive;
  end if;
end $$;
