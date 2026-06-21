-- PRP-063 Fase 1: esquema nuevo NO destructivo para el saneamiento de roles.
-- 1) usuarios.rol_id (FK a empresa_roles) = enlace por ID, no por texto.
-- 2) empresa_roles.es_admin_plataforma = marca de super-usuario (director) por
--    rol, para derivar el flag sin comparar el string "DIRECCIÓN".
-- Idempotente. No cambia comportamiento (nada lee rol_id todavía).

alter table public.usuarios
  add column if not exists rol_id uuid references public.empresa_roles(id);
create index if not exists idx_usuarios_rol_id on public.usuarios(rol_id);

alter table public.empresa_roles
  add column if not exists es_admin_plataforma boolean not null default false;

-- Seed: el rol DIRECCIÓN de CADA empresa es admin de plataforma.
update public.empresa_roles
set es_admin_plataforma = true
where upper(nombre) = 'DIRECCIÓN' and es_admin_plataforma = false;
