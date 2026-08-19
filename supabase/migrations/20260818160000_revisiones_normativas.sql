-- ═══════════════════════════════════════════════════════════════════════════
-- REVISIONES NORMATIVAS
--
-- La vista de Revisiones deja de ser una maqueta. Cada obligación legal que una
-- inspección puede exigir (extintores, SGAE, PRL, legionela, licencia de terraza…)
-- pasa a ser un registro con fecha de vencimiento y un historial de lo que se
-- ha hecho de verdad, para tener control real de ellas.
--
-- Dos tablas:
--   revisiones           — una fila por obligación y empresa (el estado actual)
--   revisiones_historial — cada vez que se realiza una revisión (la prueba)
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.revisiones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id text NOT NULL,

  -- Clave del catálogo normativo (extintores, sgae, prl…). Null si la empresa
  -- crea una revisión propia que no está en el catálogo.
  clave text,

  nombre text NOT NULL,
  ambito text NOT NULL DEFAULT 'SEGURIDAD',
  periodicidad text NOT NULL DEFAULT 'ANUAL',

  fecha_ultima date,
  fecha_vencimiento date,

  responsable text,
  proveedor text,
  coste numeric(12,2),
  notas text,

  -- Una revisión que no aplica al local (sin ascensor, sin gas) se marca
  -- inactiva en vez de borrarse: así queda constancia de la decisión.
  activo boolean NOT NULL DEFAULT true,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS revisiones_empresa_clave_uq
  ON public.revisiones (empresa_id, clave)
  WHERE clave IS NOT NULL;

CREATE INDEX IF NOT EXISTS revisiones_empresa_idx
  ON public.revisiones (empresa_id, fecha_vencimiento);

CREATE TABLE IF NOT EXISTS public.revisiones_historial (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  revision_id uuid NOT NULL REFERENCES public.revisiones(id) ON DELETE CASCADE,
  empresa_id text NOT NULL,

  fecha date NOT NULL,
  resultado text NOT NULL DEFAULT 'CORRECTO',
  realizado_por text,
  observaciones text,
  documento_url text,

  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid
);

CREATE INDEX IF NOT EXISTS revisiones_historial_revision_idx
  ON public.revisiones_historial (revision_id, fecha DESC);

-- Resultados posibles de una revisión realizada.
DO $$
BEGIN
  ALTER TABLE public.revisiones_historial
    ADD CONSTRAINT revisiones_historial_resultado_chk
    CHECK (resultado IN ('CORRECTO', 'CON_DEFICIENCIAS', 'DESFAVORABLE', 'PENDIENTE'));
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- ─── RLS: cada empresa ve solo lo suyo ─────────────────────────────────────

ALTER TABLE public.revisiones ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS revisiones_read ON public.revisiones;
CREATE POLICY revisiones_read
  ON public.revisiones FOR SELECT
  USING (empresa_id IN (SELECT empresas_del_usuario_text()));
DROP POLICY IF EXISTS revisiones_write ON public.revisiones;
CREATE POLICY revisiones_write
  ON public.revisiones FOR ALL
  USING (empresa_id IN (SELECT empresas_del_usuario_text()))
  WITH CHECK (empresa_id IN (SELECT empresas_del_usuario_text()));

ALTER TABLE public.revisiones_historial ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS revisiones_historial_read ON public.revisiones_historial;
CREATE POLICY revisiones_historial_read
  ON public.revisiones_historial FOR SELECT
  USING (empresa_id IN (SELECT empresas_del_usuario_text()));
DROP POLICY IF EXISTS revisiones_historial_write ON public.revisiones_historial;
CREATE POLICY revisiones_historial_write
  ON public.revisiones_historial FOR ALL
  USING (empresa_id IN (SELECT empresas_del_usuario_text()))
  WITH CHECK (empresa_id IN (SELECT empresas_del_usuario_text()));
