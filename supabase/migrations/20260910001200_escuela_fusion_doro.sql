-- ESCUELA — Doro, que estaba tres veces, es una sola ficha.
--
-- Tres correos de la misma casa y de la misma persona. En la ficha caben dos, y
-- Iván eligió cuáles: el del restaurante como correo de empresa y el de
-- dirección como el suyo. `contabilidad.dorocucina@gmail.com` se retira, y con
-- él ya no se puede entrar al portal.
--
-- Se queda la ficha con el alta más antigua, la suma de las entradas de las
-- tres y el último acceso más reciente: es la misma persona, así que lo que
-- hizo con cualquiera de sus correos es suyo.
do $$
declare
  v_empresa uuid;
  v_vive uuid;
  v_accesos integer;
  v_ultimo timestamptz;
  v_alta timestamptz;
  v_cliente uuid;
begin
  select id into v_empresa from public.empresas where es_matriz = true limit 1;
  if v_empresa is null then return; end if;

  select id into v_vive from public.escuela_alumnos
   where empresa_id = v_empresa and lower(email) = 'dorocucinamadrid@gmail.com';
  if v_vive is null then return; end if;

  select sum(accesos_num), max(ultimo_acceso_at), min(created_at), min(cliente_id::text)::uuid
    into v_accesos, v_ultimo, v_alta, v_cliente
    from public.escuela_alumnos
   where empresa_id = v_empresa
     and lower(email) in ('dorocucinamadrid@gmail.com','direccion.dorocucina@gmail.com','contabilidad.dorocucina@gmail.com');

  update public.escuela_progreso set alumno_id = v_vive
   where alumno_id in (select id from public.escuela_alumnos where empresa_id = v_empresa
     and lower(email) in ('direccion.dorocucina@gmail.com','contabilidad.dorocucina@gmail.com'));
  update public.escuela_matriculas set alumno_id = v_vive
   where alumno_id in (select id from public.escuela_alumnos where empresa_id = v_empresa
     and lower(email) in ('direccion.dorocucina@gmail.com','contabilidad.dorocucina@gmail.com'));

  delete from public.escuela_alumnos
   where empresa_id = v_empresa
     and lower(email) in ('direccion.dorocucina@gmail.com','contabilidad.dorocucina@gmail.com');

  update public.escuela_alumnos
     set nombre = 'Doro',
         email = 'dorocucinamadrid@gmail.com',
         email_empresa = 'dorocucinamadrid@gmail.com',
         email_personal = 'direccion.dorocucina@gmail.com',
         accesos_num = coalesce(v_accesos, accesos_num),
         ultimo_acceso_at = coalesce(v_ultimo, ultimo_acceso_at),
         created_at = coalesce(v_alta, created_at),
         cliente_id = coalesce(cliente_id, v_cliente)
   where id = v_vive;
end $$;
