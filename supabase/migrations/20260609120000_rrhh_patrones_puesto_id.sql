-- ============================================================================
-- Plantilla de horario por puesto: un patrón (rrhh_patrones) puede pertenecer a
-- un puesto. La plantilla del puesto se monta en RRHH → Salarios (editor propio)
-- y luego se asigna a los empleados de ese puesto (rrhh_patron_empleados).
-- ============================================================================

ALTER TABLE public.rrhh_patrones
  ADD COLUMN IF NOT EXISTS puesto_id uuid REFERENCES public.puestos(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_rrhh_patrones_puesto ON public.rrhh_patrones(puesto_id);
