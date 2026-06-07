-- ============================================================
-- rrhh_patrones.departamento
-- Igual que rrhh_turnos.departamento: cada patrón se asocia a UN
-- departamento (texto = nombre del departamento). Aunque el patrón
-- contenga turnos de varios departamentos, lo que cuenta para
-- agruparlo/filtrarlo es este departamento asignado.
-- ============================================================

alter table public.rrhh_patrones
  add column if not exists departamento text;

comment on column public.rrhh_patrones.departamento is
  'Departamento al que pertenece el patrón (nombre, igual que rrhh_turnos.departamento). '
  'Independiente de los turnos que contenga; gobierna su agrupación/filtro.';

-- ─── Backfill por intuición sobre los patrones ya existentes ──────────────
-- Solo rellena los que aún no tienen departamento (idempotente, multi-tenant).
update public.rrhh_patrones
  set departamento = 'ARTISTAS'
  where departamento is null and nombre ilike 'ARTISTA%';

update public.rrhh_patrones
  set departamento = 'CALIDAD'
  where departamento is null and nombre ilike 'CALIDAD%';

-- Cocina: cocineros, jefes de cocina y limpieza/office (cuelga de cocina).
update public.rrhh_patrones
  set departamento = 'COCINA'
  where departamento is null
    and (nombre ilike '%COCIN%' or nombre ilike 'LIMPIEZA/OFFICE%' or nombre ilike 'OFFICE%');

-- Sala: camareros y jefes de sala.
update public.rrhh_patrones
  set departamento = 'SALA'
  where departamento is null
    and (nombre ilike 'CAMARERO%' or nombre ilike '%SALA%');

update public.rrhh_patrones
  set departamento = 'MANTENIMIENTO'
  where departamento is null and nombre ilike 'MANTENIMIENTO%';
-- "Plantilla sin nombre" y similares quedan sin departamento (NULL = sin asignar).
