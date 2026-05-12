-- ============================================================
-- 095_carpetas_documentos.sql
--
-- Carpetas lógicas del módulo Dirección → Documentación.
-- Estructura plana (sin parent) por empresa. Permite agrupar los
-- documentos en la UI tipo Google Drive antes de existir filas
-- en la tabla `documentos`.
--
-- Reglas:
--  · `empresa_id` UUID → aislamiento multiempresa.
--  · UNIQUE (empresa_id, lower(nombre)) → no duplicados case-insensitive.
--  · RLS estricto patrón 091 (user_empresas OR profiles).
--  · Trigger AFTER INSERT en `empresas` siembra las 3 carpetas
--    obligatorias: CONTRATOS, FISCALIDAD, ANTIGUOS.
--  · Backfill idempotente para empresas existentes.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.carpetas_documentos (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id   uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  nombre       text NOT NULL,
  created_at   timestamptz NOT NULL DEFAULT now(),
  created_by   uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  CONSTRAINT carpetas_documentos_nombre_chk CHECK (char_length(trim(nombre)) > 0)
);

CREATE UNIQUE INDEX IF NOT EXISTS carpetas_documentos_empresa_nombre_uq
  ON public.carpetas_documentos (empresa_id, lower(nombre));

CREATE INDEX IF NOT EXISTS carpetas_documentos_empresa_idx
  ON public.carpetas_documentos (empresa_id);

ALTER TABLE public.carpetas_documentos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "carp_doc_read"   ON public.carpetas_documentos;
DROP POLICY IF EXISTS "carp_doc_manage" ON public.carpetas_documentos;

CREATE POLICY "carp_doc_read" ON public.carpetas_documentos FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.user_empresas ue WHERE ue.user_id = auth.uid() AND ue.empresa_id = carpetas_documentos.empresa_id)
    OR EXISTS (SELECT 1 FROM public.profiles p   WHERE p.user_id  = auth.uid() AND p.empresa_id  = carpetas_documentos.empresa_id)
  );

CREATE POLICY "carp_doc_manage" ON public.carpetas_documentos FOR ALL TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.user_empresas ue WHERE ue.user_id = auth.uid() AND ue.empresa_id = carpetas_documentos.empresa_id)
    OR EXISTS (SELECT 1 FROM public.profiles p   WHERE p.user_id  = auth.uid() AND p.empresa_id  = carpetas_documentos.empresa_id)
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.user_empresas ue WHERE ue.user_id = auth.uid() AND ue.empresa_id = carpetas_documentos.empresa_id)
    OR EXISTS (SELECT 1 FROM public.profiles p   WHERE p.user_id  = auth.uid() AND p.empresa_id  = carpetas_documentos.empresa_id)
  );

-- ── Función seed (idempotente) ──────────────────────────────
CREATE OR REPLACE FUNCTION public.seed_carpetas_documentos_default(p_empresa_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.carpetas_documentos (empresa_id, nombre)
  VALUES
    (p_empresa_id, 'CONTRATOS'),
    (p_empresa_id, 'FISCALIDAD'),
    (p_empresa_id, 'ANTIGUOS')
  ON CONFLICT (empresa_id, lower(nombre)) DO NOTHING;
END;
$$;

REVOKE ALL ON FUNCTION public.seed_carpetas_documentos_default(uuid) FROM PUBLIC;

-- ── Trigger: al crear empresa, sembrar carpetas por defecto ─
CREATE OR REPLACE FUNCTION public.tg_seed_carpetas_documentos()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.seed_carpetas_documentos_default(NEW.id);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS empresas_seed_carpetas_documentos ON public.empresas;
CREATE TRIGGER empresas_seed_carpetas_documentos
AFTER INSERT ON public.empresas
FOR EACH ROW
EXECUTE FUNCTION public.tg_seed_carpetas_documentos();

-- ── Backfill: empresas ya existentes ────────────────────────
DO $$
DECLARE
  e_id uuid;
BEGIN
  FOR e_id IN SELECT id FROM public.empresas LOOP
    PERFORM public.seed_carpetas_documentos_default(e_id);
  END LOOP;
END $$;
