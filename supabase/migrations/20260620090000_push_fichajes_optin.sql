-- ============================================================================
-- PRP-060 — Opt-in de push para recordatorios de fichaje.
-- Mismo patrón que push_solicitudes/comunicados/cronograma/llamadas.
-- Default true: por defecto el empleado recibe los reavisos de fichar.
-- ============================================================================

alter table public.usuarios
  add column if not exists push_fichajes boolean not null default true;
