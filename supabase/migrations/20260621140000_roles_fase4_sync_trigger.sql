-- PRP-063 Fase 4: red de seguridad de transición.
-- Mantiene usuarios.rol_id coherente con rol_label dentro de la empresa, en
-- CUALQUIER escritura (alta normal, alta empleado, reasignación). Así los
-- lectores ya reapuntados a rol_id nunca ven un rol_id obsoleto mientras el
-- código aún escribe rol_label. En Fase 6 se invierte (rol_id pasa a ser el
-- driver y rol_label el espejo) y este trigger se retira.
-- Idempotente.

create or replace function public.sync_usuario_rol_id()
returns trigger
language plpgsql
as $$
begin
  if new.rol_label is not null and new.empresa_id is not null then
    if tg_op = 'UPDATE'
       and new.rol_label is not distinct from old.rol_label
       and new.empresa_id is not distinct from old.empresa_id
       and new.rol_id is not null then
      return new; -- nada relevante cambió
    end if;
    select er.id into new.rol_id
    from public.empresa_roles er
    where er.empresa_id = new.empresa_id
      and er.nombre ilike new.rol_label
    limit 1;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_sync_usuario_rol_id on public.usuarios;
create trigger trg_sync_usuario_rol_id
  before insert or update of rol_label, empresa_id on public.usuarios
  for each row execute function public.sync_usuario_rol_id();
