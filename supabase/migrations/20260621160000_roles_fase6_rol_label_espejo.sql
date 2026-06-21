-- PRP-063 Fase 6: rol_label como ESPEJO puro derivado de rol_id.
-- El trigger ya resuelve rol_id desde rol_label (input de la UI); ahora además
-- CANONIZA rol_label al nombre exacto del rol (p. ej. "direccion" -> "DIRECCIÓN")
-- y mantiene usuarios.role derivado. Si rol_label no casa con ningún rol, NO se
-- toca rol_label (se conserva el input; rol_id queda null y el middleware tira
-- de su fallback). Idempotente.

create or replace function public.sync_usuario_rol_id()
returns trigger language plpgsql as $$
declare
  v_id uuid;
  v_nombre text;
  v_es_admin boolean;
begin
  if new.rol_label is not null and new.empresa_id is not null then
    if tg_op = 'UPDATE'
       and new.rol_label is not distinct from old.rol_label
       and new.empresa_id is not distinct from old.empresa_id
       and new.rol_id is not null then
      return new;
    end if;
    select er.id, er.nombre, er.es_admin_plataforma
      into v_id, v_nombre, v_es_admin
    from public.empresa_roles er
    where er.empresa_id = new.empresa_id and er.nombre ilike new.rol_label
    limit 1;
    new.rol_id := v_id;                               -- fuente única (null si no casa)
    new.role := case when v_es_admin then 'admin' else 'empleado' end;
    if v_nombre is not null then
      new.rol_label := v_nombre;                      -- espejo canónico del rol
    end if;
  end if;
  return new;
end;
$$;
