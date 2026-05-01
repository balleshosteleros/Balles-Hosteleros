-- Migration 047: profiles.rol_label
-- Razón: el dropdown de "rol" en UsuariosTab debe mostrar el nombre del rol custom
-- de la pestaña Roles (tabla empresa_roles), no solo el enum app_role hardcoded.
-- user_roles.role (enum app_role) sigue siendo la fuente de autorización RBAC,
-- pero la etiqueta visible al usuario se almacena en profiles.rol_label.
-- Idempotente.

alter table public.profiles
  add column if not exists rol_label text;

create index if not exists idx_profiles_rol_label on public.profiles(rol_label);
