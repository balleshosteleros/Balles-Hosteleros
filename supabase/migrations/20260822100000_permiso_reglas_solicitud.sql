-- ============================================================
-- 20260822100000_permiso_reglas_solicitud.sql
-- Reglas de la empresa para SOLICITAR permisos, configurables
-- desde RRHH → Solicitudes → Configuración:
--
--   1. Mínimo y máximo de días naturales POR SOLICITUD.
--   2. Máximo de días AL AÑO, sumando todas las veces que pida.
--
-- Los días se cuentan NATURALES, igual que en vacaciones.
--
-- A diferencia de vacaciones, el permiso NO exige día de la semana
-- de inicio: puede empezar cualquier día.
--
-- Defaults: sin límite (NULL) en las tres. Un permiso sin configurar
-- se comporta como hasta ahora — de 1 día en adelante, sin tope.
-- Cada empresa decide si quiere acotarlo.
--
-- NOTA: el tope anual de permiso vive en `tipos_ausencia.limite_dias`
-- (por subtipo), que ya existía y ya se aplica al crear la solicitud.
-- Aquí NO se duplica: esta migración solo añade el mín/máx por
-- solicitud, que es lo que faltaba.
-- ============================================================

ALTER TABLE public.empresa_rrhh_config
  -- Mínimo y máximo de días naturales por solicitud. NULL = sin límite.
  ADD COLUMN IF NOT EXISTS permiso_dias_min smallint,
  ADD COLUMN IF NOT EXISTS permiso_dias_max smallint;

-- Rangos válidos. Se recrean por si la migración se reejecuta.
ALTER TABLE public.empresa_rrhh_config
  DROP CONSTRAINT IF EXISTS empresa_rrhh_config_permiso_dias_min_chk;
ALTER TABLE public.empresa_rrhh_config
  ADD CONSTRAINT empresa_rrhh_config_permiso_dias_min_chk
  CHECK (permiso_dias_min IS NULL OR permiso_dias_min BETWEEN 1 AND 366);

ALTER TABLE public.empresa_rrhh_config
  DROP CONSTRAINT IF EXISTS empresa_rrhh_config_permiso_dias_max_chk;
ALTER TABLE public.empresa_rrhh_config
  ADD CONSTRAINT empresa_rrhh_config_permiso_dias_max_chk
  CHECK (permiso_dias_max IS NULL OR permiso_dias_max BETWEEN 1 AND 366);

-- El máximo nunca puede quedar por debajo del mínimo: sería imposible
-- solicitar un permiso y el empleado no sabría por qué.
ALTER TABLE public.empresa_rrhh_config
  DROP CONSTRAINT IF EXISTS empresa_rrhh_config_permiso_dias_orden_chk;
ALTER TABLE public.empresa_rrhh_config
  ADD CONSTRAINT empresa_rrhh_config_permiso_dias_orden_chk
  CHECK (
    permiso_dias_min IS NULL
    OR permiso_dias_max IS NULL
    OR permiso_dias_max >= permiso_dias_min
  );

COMMENT ON COLUMN public.empresa_rrhh_config.permiso_dias_min IS
  'Mínimo de días naturales por solicitud de permiso. NULL = sin mínimo.';
COMMENT ON COLUMN public.empresa_rrhh_config.permiso_dias_max IS
  'Máximo de días naturales por solicitud de permiso. NULL = sin máximo.';

-- Empresas sin fila de config todavía: se crea con los defaults.
INSERT INTO public.empresa_rrhh_config (empresa_id)
SELECT e.id FROM public.empresas e
ON CONFLICT (empresa_id) DO NOTHING;
