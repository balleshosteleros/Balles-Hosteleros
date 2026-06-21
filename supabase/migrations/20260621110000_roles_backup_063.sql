-- PRP-063 Fase 0: red de seguridad antes del saneamiento de roles.
-- Snapshot del estado actual de roles de los 20 usuarios. Reversible.
-- Idempotente: re-ejecutable sin error.

create table if not exists public._roles_backup_063 (
  user_id            uuid primary key,
  empresa_id         uuid,
  usuarios_role      text,
  usuario_roles_role text,
  rol_label          text,
  created_at         timestamptz not null default now()
);

insert into public._roles_backup_063 (user_id, empresa_id, usuarios_role, usuario_roles_role, rol_label)
select u.user_id, u.empresa_id, u.role, ur.role, u.rol_label
from public.usuarios u
left join public.usuario_roles ur on ur.user_id = u.user_id
on conflict (user_id) do nothing;

-- Rollback documentado (NO ejecutar salvo necesidad):
--   update usuarios u set role = b.usuarios_role, rol_label = b.rol_label
--     from _roles_backup_063 b where b.user_id = u.user_id;
--   update usuario_roles ur set role = b.usuario_roles_role
--     from _roles_backup_063 b where b.user_id = ur.user_id;
