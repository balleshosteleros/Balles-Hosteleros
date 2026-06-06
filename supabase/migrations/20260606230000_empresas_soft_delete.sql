-- Soft-delete de empresas con retención de 30 días.
-- Al "borrar" una empresa se marca `eliminacion_programada_at = now()`. La empresa
-- sigue accesible internamente durante 30 días (periodo de gracia / restauración).
-- Un cron diario (/api/cron/empresas-purga) hace el hard-delete definitivo pasado
-- ese plazo. NULL = empresa activa (no marcada para eliminación).

alter table public.empresas
  add column if not exists eliminacion_programada_at timestamptz;

comment on column public.empresas.eliminacion_programada_at is
  'Fecha en que se marcó la empresa para eliminación. Acceso interno 30 días; un cron purga (hard-delete) pasado el plazo. NULL = activa.';

-- Índice parcial: el cron solo escanea las marcadas.
create index if not exists idx_empresas_eliminacion_programada
  on public.empresas (eliminacion_programada_at)
  where eliminacion_programada_at is not null;
