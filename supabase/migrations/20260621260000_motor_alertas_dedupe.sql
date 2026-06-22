-- PRP-065 Fase 1: idempotencia de emisores por cron/evento.
-- `dedupe_key` permite que una alerta por entidad+periodo no se reemita: el
-- índice único parcial garantiza una sola fila por (empresa, usuario, dedupe_key).
-- Patrón análogo a fichaje_reavisos_log. Idempotente.

alter table public.notificaciones
  add column if not exists dedupe_key text;

-- Índice único NO parcial: Postgres trata los NULL como distintos, así que las
-- filas con dedupe_key null (avisos manuales, emisiones sin idempotencia) nunca
-- colisionan, mientras que las dedupe_key no-null sí quedan deduplicadas. Debe
-- ser NO parcial para que el upsert (ON CONFLICT) de PostgREST pueda inferirlo.
drop index if exists notificaciones_dedupe_uq;
create unique index if not exists notificaciones_dedupe_uq
  on public.notificaciones (empresa_id, usuario_id, dedupe_key);
