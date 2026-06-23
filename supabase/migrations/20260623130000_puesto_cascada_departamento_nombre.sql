-- Cascada al actualizar un puesto: sincroniza su cronograma (todas las filas/tareas
-- del puesto) y los empleados cuyo puesto PRINCIPAL es este, cuando cambia el nombre
-- o el departamento. Las VACANTES no se tocan (están desacopladas del puesto).
create or replace function public.sync_puesto_cambios()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_depto_nombre text;
begin
  if NEW.nombre is distinct from OLD.nombre
     or NEW.departamento_id is distinct from OLD.departamento_id then

    select nombre into v_depto_nombre
    from public.departamentos
    where id = NEW.departamento_id;

    -- Cronograma del puesto (rol = nombre del puesto, departamento = texto del depto)
    update public.cronogramas_operativos
       set rol = NEW.nombre,
           departamento = coalesce(v_depto_nombre, departamento)
     where puesto_id = NEW.id;

    -- Empleados cuyo puesto PRINCIPAL es este (espejo en `empleados`)
    update public.empleados e
       set puesto = NEW.nombre,
           departamento_id = NEW.departamento_id
      from public.empleado_puestos ep
     where ep.puesto_id = NEW.id
       and ep.es_principal = true
       and e.id = ep.empleado_id;
  end if;
  return NEW;
end;
$$;

drop trigger if exists tg_sync_puesto_cambios on public.puestos;
create trigger tg_sync_puesto_cambios
after update on public.puestos
for each row
execute function public.sync_puesto_cambios();
