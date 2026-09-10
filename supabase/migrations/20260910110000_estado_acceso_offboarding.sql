-- Acceso en modo OFFBOARDING: el trabajador que ya ha pasado su ultimo dia pero
-- cuya salida no esta cerrada.
--
-- Antes, al llegar su ultimo dia se le cortaba el acceso entero. Pero justo
-- entonces es cuando tiene que firmar la devolucion del material y su finiquito:
-- cerrandole la puerta no puede hacerlo, y RRHH se queda con dos documentos sin
-- firmar y sin manera de conseguirlos.
--
-- 'Offboarding' = entra, pero solo a sus documentos y a sus avisos. El proxy es
-- quien restringe por ruta. El corte total llega al pasarlo a «Ex-empleados».
--
-- Idempotente.
alter table public.usuarios drop constraint if exists profiles_estado_acceso_check;
alter table public.usuarios add constraint profiles_estado_acceso_check
  check (estado_acceso = any (array['Activo'::text, 'Inactivo'::text, 'Offboarding'::text]));

-- El trigger que deriva el acceso de las fichas de empleado NO puede pisar
-- 'Offboarding': cualquier UPDATE posterior sobre su ficha (o sobre la de otra
-- empresa del grupo) lo devolveria a 'Inactivo' y le dejaria fuera otra vez.
-- Sigue siendo cierto que quien esta activo en alguna empresa tiene acceso
-- completo: eso manda sobre todo lo demas.
create or replace function public.sync_profile_estado_from_empleado()
 returns trigger
 language plpgsql
 set search_path to 'public', 'pg_temp'
as $function$
declare
  pid uuid;
  activo_en_alguna boolean;
begin
  pid := coalesce(NEW.user_id, OLD.user_id);
  if pid is null then
    return coalesce(NEW, OLD);
  end if;

  select exists (
    select 1 from public.empleados e
    where e.user_id = pid
      and (TG_OP <> 'DELETE' or e.id <> OLD.id)
      and public.empleado_esta_activo(e.estado, e.fecha_baja)
  ) into activo_en_alguna;

  if activo_en_alguna then
    update public.usuarios set estado_acceso = 'Activo'
     where user_id = pid and estado_acceso is distinct from 'Activo';
  else
    -- 'Offboarding' se respeta: lo puso el cierre de la baja y solo lo quita el
    -- paso a «Ex-empleados».
    update public.usuarios set estado_acceso = 'Inactivo'
     where user_id = pid
       and estado_acceso is distinct from 'Inactivo'
       and estado_acceso is distinct from 'Offboarding';
  end if;

  return coalesce(NEW, OLD);
end;
$function$;
