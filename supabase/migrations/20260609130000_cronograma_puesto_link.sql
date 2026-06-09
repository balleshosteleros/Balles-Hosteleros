-- ============================================================================
-- Cronograma ↔ Puesto (1:1, inseparable): un cronograma operativo pertenece a
-- un puesto. Al crear un puesto (RRHH) se crea AL MOMENTO su cronograma pendiente
-- (frecuencia "OTRO" = placeholder). ON DELETE CASCADE: si se borra el puesto,
-- desaparece su cronograma.
-- Las filas legacy (712) quedan con puesto_id NULL hasta migrarse.
-- ============================================================================

ALTER TABLE public.cronogramas_operativos
  ADD COLUMN IF NOT EXISTS puesto_id uuid REFERENCES public.puestos(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_cronogramas_puesto ON public.cronogramas_operativos(puesto_id);
