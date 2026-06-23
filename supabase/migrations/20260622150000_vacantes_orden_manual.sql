-- Orden manual de vacantes (drag & drop en reclutamiento, replicado en el portal público de empleo).
-- La columna ya existía en BD pero no estaba versionada; este fichero la documenta de forma idempotente.
-- Lectura: ORDER BY orden ASC NULLS LAST, created_at DESC (gestión interna y /empleo público).

alter table public.vacantes
  add column if not exists orden integer;

comment on column public.vacantes.orden is
  'Posición manual de la vacante (0..N) fijada por drag & drop en reclutamiento. NULL = sin ordenar (al final, desempate por created_at DESC). Mismo orden en el portal público.';
