-- PRP-063 Fase 2: backfill de usuarios.rol_id + limpieza de basura.
-- Mapea rol_label -> empresa_roles.id por empresa, normaliza casos sucios
-- (director -> DIRECCIÓN) y deja rol_label/role/usuario_roles.role DERIVADOS de
-- rol_id para que las fuentes viejas y la nueva coexistan COHERENTES.
-- Idempotente: re-ejecutable; cada UPDATE filtra por estado actual.

-- 1) Enlace directo por nombre (case-insensitive) dentro de la misma empresa.
update public.usuarios u
set rol_id = er.id
from public.empresa_roles er
where er.empresa_id = u.empresa_id
  and er.nombre ilike u.rol_label
  and u.rol_id is null;

-- 2) Normalización de basura: rol_label que NO casa con el catálogo.
--    Diccionario de equivalencias (p. ej. "director" minúscula -> DIRECCIÓN).
update public.usuarios u
set rol_id = er.id
from public.empresa_roles er
where u.rol_id is null
  and er.empresa_id = u.empresa_id
  and upper(er.nombre) = (
    case
      when lower(trim(u.rol_label)) in ('director', 'direccion', 'dirección') then 'DIRECCIÓN'
      else upper(trim(u.rol_label))
    end
  );

-- 3a) rol_label canónico = nombre del rol enlazado (arregla "director" sucio).
update public.usuarios u
set rol_label = er.nombre
from public.empresa_roles er
where er.id = u.rol_id
  and u.rol_label is distinct from er.nombre;

-- 3b) usuarios.role derivado del flag de plataforma (admin/empleado).
update public.usuarios u
set role = case when er.es_admin_plataforma then 'admin' else 'empleado' end
from public.empresa_roles er
where er.id = u.rol_id
  and u.role is distinct from (case when er.es_admin_plataforma then 'admin' else 'empleado' end);

-- 3c) usuario_roles.role derivado del mismo flag (director/empleado).
--     usuario_roles.role es enum app_role -> cast explícito.
update public.usuario_roles ur
set role = (case when er.es_admin_plataforma then 'director' else 'empleado' end)::app_role
from public.usuarios u
join public.empresa_roles er on er.id = u.rol_id
where ur.user_id = u.user_id
  and ur.role::text is distinct from (case when er.es_admin_plataforma then 'director' else 'empleado' end);
