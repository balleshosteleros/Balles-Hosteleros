-- =====================================================================
-- 086_departamento_area_y_cronograma_departamento.sql
-- 1) Añade `area` a public.departamentos (OPERATIVA / ADMINISTRATIVA).
-- 2) Backfill de las filas existentes según mapeo (SALA y COCINA → OPERATIVA).
-- 3) Añade `departamento` (text, nullable) a cronogramas_operativos para
--    permitir el modelo área → departamento → puesto.
-- =====================================================================

-- ──────────────────────────────────────────────────────────────────────
-- 1) departamentos.area
-- ──────────────────────────────────────────────────────────────────────
ALTER TABLE public.departamentos
  ADD COLUMN IF NOT EXISTS area text;

UPDATE public.departamentos
SET area = CASE
  WHEN translate(upper(nombre), 'ÁÉÍÓÚÜÑ', 'AEIOUUN') IN ('SALA', 'COCINA')
    THEN 'OPERATIVA'
  ELSE 'ADMINISTRATIVA'
END
WHERE area IS NULL;

ALTER TABLE public.departamentos
  ALTER COLUMN area SET NOT NULL;

ALTER TABLE public.departamentos
  DROP CONSTRAINT IF EXISTS departamentos_area_check;

ALTER TABLE public.departamentos
  ADD CONSTRAINT departamentos_area_check
  CHECK (area IN ('OPERATIVA', 'ADMINISTRATIVA'));

ALTER TABLE public.departamentos
  ALTER COLUMN area SET DEFAULT 'ADMINISTRATIVA';

CREATE INDEX IF NOT EXISTS idx_departamentos_empresa_area
  ON public.departamentos (empresa_id, area);

-- ──────────────────────────────────────────────────────────────────────
-- 2) cronogramas_operativos.departamento
-- ──────────────────────────────────────────────────────────────────────
ALTER TABLE public.cronogramas_operativos
  ADD COLUMN IF NOT EXISTS departamento text;

CREATE INDEX IF NOT EXISTS idx_cronogramas_operativos_departamento
  ON public.cronogramas_operativos (departamento);
