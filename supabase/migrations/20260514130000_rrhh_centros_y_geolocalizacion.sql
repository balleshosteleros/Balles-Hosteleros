-- =====================================================================
-- 20260514130000_rrhh_centros_y_geolocalizacion.sql
-- RRHH — Centros (locaciones de trabajo) + Geolocalización de fichajes
--
-- Patrón: por empresa_id, RLS estándar (lectura/escritura por empresa).
--
-- Cambios:
--   1) Nueva tabla public.centros (multi-tenant, geolocalizada con radio)
--   2) empleados: + centro_id (FK), + permite_teletrabajo (bool)
--   3) fichajes:  + centro_id (FK), + lat/lng/precision por entrada y salida,
--                 + modo_teletrabajo (bool de auditoría)
--   4) (Se conserva fichajes.centro text como legacy para no romper datos
--       históricos. La fuente de verdad pasa a ser centro_id.)
-- =====================================================================

-- ──────────────────────────────────────────────────────────────────────
-- CENTROS
-- ──────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.centros (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id      uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  nombre          text NOT NULL,
  direccion       text,
  ciudad          text,
  codigo_postal   text,
  pais            text NOT NULL DEFAULT 'España',
  lat             double precision,
  lng             double precision,
  radio_metros    integer NOT NULL DEFAULT 100 CHECK (radio_metros BETWEEN 20 AND 5000),
  color           text NOT NULL DEFAULT 'bg-violet-500',
  notas           text,
  activo          boolean NOT NULL DEFAULT true,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  created_by      uuid
);

CREATE INDEX IF NOT EXISTS idx_centros_empresa
  ON public.centros (empresa_id, activo);

CREATE UNIQUE INDEX IF NOT EXISTS uniq_centros_empresa_nombre
  ON public.centros (empresa_id, lower(nombre));

ALTER TABLE public.centros ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS centros_read ON public.centros;
CREATE POLICY centros_read ON public.centros FOR SELECT
USING (
  empresa_id IN (SELECT p.empresa_id FROM public.profiles p WHERE p.user_id = auth.uid())
);

DROP POLICY IF EXISTS centros_write ON public.centros;
CREATE POLICY centros_write ON public.centros FOR ALL
USING (
  empresa_id IN (SELECT p.empresa_id FROM public.profiles p WHERE p.user_id = auth.uid())
)
WITH CHECK (
  empresa_id IN (SELECT p.empresa_id FROM public.profiles p WHERE p.user_id = auth.uid())
);

DROP TRIGGER IF EXISTS trg_centros_updated_at ON public.centros;
CREATE TRIGGER trg_centros_updated_at
  BEFORE UPDATE ON public.centros
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ──────────────────────────────────────────────────────────────────────
-- EMPLEADOS: centro_id + permite_teletrabajo
-- ──────────────────────────────────────────────────────────────────────
ALTER TABLE public.empleados
  ADD COLUMN IF NOT EXISTS centro_id uuid
    REFERENCES public.centros(id) ON DELETE SET NULL;

ALTER TABLE public.empleados
  ADD COLUMN IF NOT EXISTS permite_teletrabajo boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_empleados_centro
  ON public.empleados (centro_id);

-- ──────────────────────────────────────────────────────────────────────
-- FICHAJES: geolocalización + centro_id + modo_teletrabajo
-- ──────────────────────────────────────────────────────────────────────
ALTER TABLE public.fichajes
  ADD COLUMN IF NOT EXISTS centro_id uuid
    REFERENCES public.centros(id) ON DELETE SET NULL;

ALTER TABLE public.fichajes
  ADD COLUMN IF NOT EXISTS lat_entrada double precision;

ALTER TABLE public.fichajes
  ADD COLUMN IF NOT EXISTS lng_entrada double precision;

ALTER TABLE public.fichajes
  ADD COLUMN IF NOT EXISTS precision_entrada_metros numeric;

ALTER TABLE public.fichajes
  ADD COLUMN IF NOT EXISTS lat_salida double precision;

ALTER TABLE public.fichajes
  ADD COLUMN IF NOT EXISTS lng_salida double precision;

ALTER TABLE public.fichajes
  ADD COLUMN IF NOT EXISTS precision_salida_metros numeric;

ALTER TABLE public.fichajes
  ADD COLUMN IF NOT EXISTS modo_teletrabajo boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_fichajes_centro
  ON public.fichajes (centro_id);
