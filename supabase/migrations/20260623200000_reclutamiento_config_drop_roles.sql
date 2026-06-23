-- Se retiran los 4 interruptores de "Usuarios autorizados y roles" de la config
-- de Reclutamiento: no aportaban (los permisos reales se gestionan por rol en
-- Ajustes → Roles). Idempotente.
alter table public.reclutamiento_config drop column if exists directores_mueven_fases;
alter table public.reclutamiento_config drop column if exists reclutadores_mueven_fases;
alter table public.reclutamiento_config drop column if exists rrhh_edita_vacantes;
alter table public.reclutamiento_config drop column if exists otros_roles_ven_vacantes;
