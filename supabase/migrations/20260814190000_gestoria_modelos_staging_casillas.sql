-- ============================================================
-- 20260814190000_gestoria_modelos_staging_casillas.sql
-- Al adjuntar un modelo por el enlace de la gestoría se leen sus CASILLAS del
-- justificante AEAT en ese mismo momento (feedback inmediato). Como la subida
-- es todo-o-nada, esas casillas tienen que sobrevivir en el staging hasta que
-- se confirme el envío; al confirmar se trasladan a `modelos_aeat` con
-- `casillas_origen='gestoria'`.
-- Idempotente.
-- ============================================================

alter table public.gestoria_modelos_staging
  add column if not exists casillas jsonb not null default '{}'::jsonb,
  add column if not exists casillas_confianza numeric,
  add column if not exists csv_aeat text,
  add column if not exists numero_justificante text;

comment on column public.gestoria_modelos_staging.casillas is
  'Casillas leídas del justificante al adjuntarlo; se trasladan a modelos_aeat al confirmar.';
