-- ============================================================
-- 052_comunicados_destinatarios.sql
-- Enriquecer comunicados con destinatarios específicos:
--   - empleados_destinatarios: lista de user_id concretos
--   - departamentos_destinatarios: lista de departamentos concretos
--
-- Razón: el módulo "Mis Comunicados" de Mi Portal debe mostrar
-- comunicados que hayan ido dirigidos al usuario por:
--   1. Selección directa del usuario (empleados_destinatarios)
--   2. Selección de su departamento (departamentos_destinatarios)
--   3. Difusión a toda la empresa (toda_empresa = true)
--   4. Selección de su rol (roles_destinatarios — ya existía)
--
-- Idempotente.
-- ============================================================

alter table public.comunicados
  add column if not exists empleados_destinatarios uuid[] not null default '{}',
  add column if not exists departamentos_destinatarios text[] not null default '{}';

create index if not exists idx_comunicados_empleados_dest
  on public.comunicados using gin (empleados_destinatarios);

create index if not exists idx_comunicados_departamentos_dest
  on public.comunicados using gin (departamentos_destinatarios);

create index if not exists idx_comunicados_roles_dest
  on public.comunicados using gin (roles_destinatarios);

comment on column public.comunicados.empleados_destinatarios is
  'IDs (auth.users) de empleados destinatarios específicos. Vacío = no hay selección por usuario.';
comment on column public.comunicados.departamentos_destinatarios is
  'Departamentos destinatarios. Vacío = no hay selección por departamento.';
