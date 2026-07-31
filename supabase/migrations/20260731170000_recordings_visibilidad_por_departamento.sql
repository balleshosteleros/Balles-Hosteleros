-- ════════════════════════════════════════════════════════════════════════
-- Grabaciones: visibilidad por DEPARTAMENTO (mismo patrón que Chat/Tareas).
--
-- Cada grabación se etiqueta con el departamento (canónico) de quien la crea.
-- Quién la ve:
--   • admin/director  → todas las de su empresa
--   • el dueño        → siempre las suyas
--   • el resto        → las de los departamentos a los que su ROL da acceso
--                       (reutiliza bh_departamentos_usuario, igual que el chat:
--                        p. ej. RRHH con acceso a Cocina ve las de Cocina).
--
-- Idempotente: se puede reaplicar sin efectos secundarios.
-- ════════════════════════════════════════════════════════════════════════

-- 1) Columna departamento (canónico: COCINA, SALA, RRHH, ...). NULL = legacy.
ALTER TABLE public.recordings
  ADD COLUMN IF NOT EXISTS departamento text;

CREATE INDEX IF NOT EXISTS idx_recordings_departamento
  ON public.recordings(departamento);

-- 2) Backfill: asignar a cada grabación existente el departamento (canónico)
--    del usuario que la creó. Solo toca grabaciones 'grabacion' sin departamento.
UPDATE public.recordings r
SET departamento = public.bh_canon(u.departamento)
FROM public.usuarios u
WHERE r.departamento IS NULL
  AND r.type = 'grabacion'
  AND u.user_id = r.owner_user_id
  AND coalesce(trim(u.departamento), '') <> '';

-- 3) ¿Puede el usuario actual ver esta grabación?
CREATE OR REPLACE FUNCTION public.bh_recording_visible(
  p_type text,
  p_empresa uuid,
  p_owner uuid,
  p_departamento text
)
RETURNS boolean
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_user_deps text[];
BEGIN
  IF v_uid IS NULL THEN RETURN false; END IF;

  -- Onboarding (videos nuestros compartidos): visible para cualquier autenticado.
  IF p_type = 'onboarding' THEN RETURN true; END IF;

  -- Debe pertenecer a la empresa de la grabación.
  IF p_empresa IS NULL
     OR p_empresa NOT IN (
       SELECT u.empresa_id FROM public.usuarios u WHERE u.user_id = v_uid
     ) THEN
    RETURN false;
  END IF;

  -- Admin/director: acceso total dentro de su empresa.
  IF public.bh_es_admin() THEN RETURN true; END IF;

  -- El dueño siempre ve las suyas.
  IF p_owner = v_uid THEN RETURN true; END IF;

  -- Legacy sin departamento (no se pudo backfillar): solo admin/dueño (arriba).
  IF coalesce(trim(p_departamento), '') = '' THEN RETURN false; END IF;

  -- Resto: intersección con los departamentos accesibles por su rol.
  v_user_deps := public.bh_departamentos_usuario(p_empresa);
  RETURN public.bh_canon(p_departamento) = ANY (coalesce(v_user_deps, '{}'));
END;
$$;

-- 4) RLS: reemplazar el SELECT por-empresa por SELECT por-departamento.
DROP POLICY IF EXISTS recordings_select ON public.recordings;
CREATE POLICY recordings_select ON public.recordings
  FOR SELECT
  USING (
    public.bh_recording_visible(type, empresa_id, owner_user_id, departamento)
  );

-- Insert de grabaciones: solo en la propia empresa (se mantiene).
DROP POLICY IF EXISTS recordings_insert_grabacion ON public.recordings;
CREATE POLICY recordings_insert_grabacion ON public.recordings
  FOR INSERT
  WITH CHECK (
    type = 'grabacion'
    AND empresa_id IN (
      SELECT u.empresa_id FROM public.usuarios u WHERE u.user_id = auth.uid()
    )
  );
