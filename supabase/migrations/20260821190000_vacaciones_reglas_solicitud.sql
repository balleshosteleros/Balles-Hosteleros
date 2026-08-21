-- ============================================================
-- 20260821190000_vacaciones_reglas_solicitud.sql
-- Reglas de la empresa para SOLICITAR vacaciones, configurables
-- desde RRHH → Solicitudes → Configuración:
--
--   1. Día de la semana en que deben empezar las vacaciones.
--   2. Mínimo y máximo de días naturales por solicitud.
--
-- Los días se cuentan NATURALES (lunes a domingo = 7), igual que
-- el cupo del calendario de vacaciones.
--
-- Defaults del negocio: empezar en LUNES, y entre 7 y 7 días
-- (es decir, semanas completas). Se aplican a las empresas que
-- ya existen y quedan como default de columna para las nuevas.
-- ============================================================

ALTER TABLE public.empresa_rrhh_config
  -- Día de la semana obligatorio de inicio (ISO: 1=lunes … 7=domingo).
  -- NULL = la empresa no exige ningún día concreto.
  ADD COLUMN IF NOT EXISTS vacaciones_dia_inicio smallint DEFAULT 1,
  -- Mínimo y máximo de días naturales por solicitud. NULL = sin límite.
  ADD COLUMN IF NOT EXISTS vacaciones_dias_min smallint DEFAULT 7,
  ADD COLUMN IF NOT EXISTS vacaciones_dias_max smallint DEFAULT 7;

-- Rangos válidos. Se recrean por si la migración se reejecuta.
ALTER TABLE public.empresa_rrhh_config
  DROP CONSTRAINT IF EXISTS empresa_rrhh_config_vac_dia_inicio_chk;
ALTER TABLE public.empresa_rrhh_config
  ADD CONSTRAINT empresa_rrhh_config_vac_dia_inicio_chk
  CHECK (vacaciones_dia_inicio IS NULL OR vacaciones_dia_inicio BETWEEN 1 AND 7);

ALTER TABLE public.empresa_rrhh_config
  DROP CONSTRAINT IF EXISTS empresa_rrhh_config_vac_dias_min_chk;
ALTER TABLE public.empresa_rrhh_config
  ADD CONSTRAINT empresa_rrhh_config_vac_dias_min_chk
  CHECK (vacaciones_dias_min IS NULL OR vacaciones_dias_min BETWEEN 1 AND 366);

ALTER TABLE public.empresa_rrhh_config
  DROP CONSTRAINT IF EXISTS empresa_rrhh_config_vac_dias_max_chk;
ALTER TABLE public.empresa_rrhh_config
  ADD CONSTRAINT empresa_rrhh_config_vac_dias_max_chk
  CHECK (vacaciones_dias_max IS NULL OR vacaciones_dias_max BETWEEN 1 AND 366);

-- El máximo nunca puede quedar por debajo del mínimo: sería imposible
-- solicitar vacaciones y el empleado no sabría por qué.
ALTER TABLE public.empresa_rrhh_config
  DROP CONSTRAINT IF EXISTS empresa_rrhh_config_vac_dias_orden_chk;
ALTER TABLE public.empresa_rrhh_config
  ADD CONSTRAINT empresa_rrhh_config_vac_dias_orden_chk
  CHECK (
    vacaciones_dias_min IS NULL
    OR vacaciones_dias_max IS NULL
    OR vacaciones_dias_max >= vacaciones_dias_min
  );

COMMENT ON COLUMN public.empresa_rrhh_config.vacaciones_dia_inicio IS
  'Día ISO de la semana (1=lunes … 7=domingo) en que deben empezar las vacaciones. NULL = sin restricción.';
COMMENT ON COLUMN public.empresa_rrhh_config.vacaciones_dias_min IS
  'Mínimo de días naturales por solicitud de vacaciones. NULL = sin mínimo.';
COMMENT ON COLUMN public.empresa_rrhh_config.vacaciones_dias_max IS
  'Máximo de días naturales por solicitud de vacaciones. NULL = sin máximo.';

-- Empresas ya existentes: solo se rellenan las que aún no tienen valor,
-- para no pisar una configuración que el dueño ya hubiera tocado.
UPDATE public.empresa_rrhh_config
   SET vacaciones_dia_inicio = COALESCE(vacaciones_dia_inicio, 1),
       vacaciones_dias_min   = COALESCE(vacaciones_dias_min, 7),
       vacaciones_dias_max   = COALESCE(vacaciones_dias_max, 7)
 WHERE vacaciones_dia_inicio IS NULL
    OR vacaciones_dias_min IS NULL
    OR vacaciones_dias_max IS NULL;

-- Empresas sin fila de config todavía: se crea con los defaults.
INSERT INTO public.empresa_rrhh_config (empresa_id)
SELECT e.id FROM public.empresas e
ON CONFLICT (empresa_id) DO NOTHING;
