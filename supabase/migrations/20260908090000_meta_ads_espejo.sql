-- ═══════════════════════════════════════════════════════════════════
-- PRP-087 · Fase 2 — Espejo de la cuenta publicitaria de Meta
--
-- LA VERDAD ESTÁ EN META, NO AQUÍ. Estas tablas son una copia para que la
-- pantalla abra al instante y para poder filtrar y ordenar sin castigar la
-- API (que tiene cupo de llamadas). Ante cualquier discrepancia manda lo que
-- devuelva Meta: por eso todo se refresca por `upsert` sobre el id real de
-- Meta y nada se inventa aquí.
--
-- Los tres niveles del Administrador de anuncios, una tabla cada uno:
--   meta_campanas  → qué se quiere conseguir y con cuánto dinero
--   meta_conjuntos → a quién se le enseña, dónde y cuándo (aquí vive Instagram)
--   meta_anuncios  → qué se le enseña (imagen, vídeo o carrusel)
--
-- Idempotente: se puede aplicar varias veces.
-- ═══════════════════════════════════════════════════════════════════

-- ─── Nivel 1: campañas ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.meta_campanas (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id      UUID NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  meta_id         TEXT NOT NULL,
  nombre          TEXT NOT NULL,
  objetivo        TEXT,
  -- `estado` es lo que se ha pedido; `estado_efectivo` es lo que Meta aplica
  -- de verdad (una campaña activa puede estar frenada por la cuenta, por
  -- revisión o por presupuesto). Enseñar solo el primero engaña.
  estado          TEXT,
  estado_efectivo TEXT,
  presupuesto_diario_cent BIGINT,
  presupuesto_total_cent  BIGINT,
  -- Para distinguir lo lanzado desde el software de lo hecho en Meta.
  creada_en_software BOOLEAN NOT NULL DEFAULT FALSE,
  creada_en_meta_at  TIMESTAMPTZ,
  raw             JSONB NOT NULL DEFAULT '{}'::JSONB,
  sincronizado_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (empresa_id, meta_id)
);

-- ─── Nivel 2: conjuntos de anuncios ─────────────────────────────────
CREATE TABLE IF NOT EXISTS public.meta_conjuntos (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id      UUID NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  meta_id         TEXT NOT NULL,
  campana_meta_id TEXT NOT NULL,
  nombre          TEXT NOT NULL,
  estado          TEXT,
  estado_efectivo TEXT,
  presupuesto_diario_cent BIGINT,
  presupuesto_total_cent  BIGINT,
  -- Público, ubicaciones y dónde sale el anuncio (Facebook, Instagram, y en
  -- qué sitio de cada uno: feed, stories, reels…). Tal cual lo da Meta.
  publico         JSONB NOT NULL DEFAULT '{}'::JSONB,
  optimization_goal TEXT,
  billing_event   TEXT,
  inicio_at       TIMESTAMPTZ,
  fin_at          TIMESTAMPTZ,
  raw             JSONB NOT NULL DEFAULT '{}'::JSONB,
  sincronizado_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (empresa_id, meta_id)
);

-- ─── Nivel 3: anuncios ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.meta_anuncios (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id       UUID NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  meta_id          TEXT NOT NULL,
  conjunto_meta_id TEXT NOT NULL,
  campana_meta_id  TEXT,
  nombre           TEXT NOT NULL,
  estado           TEXT,
  estado_efectivo  TEXT,
  -- imagen | video | carrusel | otro
  formato          TEXT,
  creatividad      JSONB NOT NULL DEFAULT '{}'::JSONB,
  vista_previa_url TEXT,
  raw              JSONB NOT NULL DEFAULT '{}'::JSONB,
  sincronizado_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (empresa_id, meta_id)
);

-- ─── Resultados, por día y por nivel ────────────────────────────────
-- Por día (y no un único total) porque el tope de gasto es MENSUAL y hay que
-- poder sumar justo el mes en curso del reloj de la empresa.
CREATE TABLE IF NOT EXISTS public.meta_insights (
  empresa_id   UUID NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  nivel        TEXT NOT NULL CHECK (nivel IN ('campana','conjunto','anuncio')),
  meta_id      TEXT NOT NULL,
  dia          DATE NOT NULL,
  gasto_cent   BIGINT NOT NULL DEFAULT 0,
  impresiones  BIGINT NOT NULL DEFAULT 0,
  alcance      BIGINT NOT NULL DEFAULT 0,
  clics        BIGINT NOT NULL DEFAULT 0,
  resultados   BIGINT NOT NULL DEFAULT 0,
  coste_resultado_cent BIGINT,
  raw          JSONB NOT NULL DEFAULT '{}'::JSONB,
  sincronizado_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (empresa_id, nivel, meta_id, dia)
);

-- ─── Medios subidos desde el software ───────────────────────────────
CREATE TABLE IF NOT EXISTS public.meta_medios (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id  UUID NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  tipo        TEXT NOT NULL CHECK (tipo IN ('imagen','video')),
  nombre      TEXT,
  url_origen  TEXT NOT NULL,
  -- Lo que devuelve Meta y es lo que de verdad se usa al crear el anuncio.
  image_hash  TEXT,
  video_id    TEXT,
  miniatura_url TEXT,
  -- Un vídeo tarda en procesarse en Meta: hasta que no está 'listo' no se
  -- puede publicar un anuncio con él.
  estado      TEXT NOT NULL DEFAULT 'subiendo' CHECK (estado IN ('subiendo','procesando','listo','error')),
  error       TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── Índices de lo que de verdad se consulta ────────────────────────
CREATE INDEX IF NOT EXISTS meta_campanas_empresa_idx   ON public.meta_campanas (empresa_id, estado);
CREATE INDEX IF NOT EXISTS meta_conjuntos_campana_idx  ON public.meta_conjuntos (empresa_id, campana_meta_id);
CREATE INDEX IF NOT EXISTS meta_anuncios_conjunto_idx  ON public.meta_anuncios (empresa_id, conjunto_meta_id);
CREATE INDEX IF NOT EXISTS meta_insights_mes_idx       ON public.meta_insights (empresa_id, dia);
CREATE INDEX IF NOT EXISTS meta_medios_empresa_idx     ON public.meta_medios (empresa_id, estado);

DROP TRIGGER IF EXISTS meta_medios_set_updated_at ON public.meta_medios;
CREATE TRIGGER meta_medios_set_updated_at
  BEFORE UPDATE ON public.meta_medios
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ─── RLS: cada empresa ve lo suyo y nada más ────────────────────────
-- Escritura solo por service_role (el cron y las acciones de servidor).
ALTER TABLE public.meta_campanas  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meta_conjuntos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meta_anuncios  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meta_insights  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meta_medios    ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS meta_campanas_select ON public.meta_campanas;
CREATE POLICY meta_campanas_select ON public.meta_campanas FOR SELECT TO authenticated
  USING (empresa_id IN (SELECT public.empresas_del_usuario()));

DROP POLICY IF EXISTS meta_conjuntos_select ON public.meta_conjuntos;
CREATE POLICY meta_conjuntos_select ON public.meta_conjuntos FOR SELECT TO authenticated
  USING (empresa_id IN (SELECT public.empresas_del_usuario()));

DROP POLICY IF EXISTS meta_anuncios_select ON public.meta_anuncios;
CREATE POLICY meta_anuncios_select ON public.meta_anuncios FOR SELECT TO authenticated
  USING (empresa_id IN (SELECT public.empresas_del_usuario()));

DROP POLICY IF EXISTS meta_insights_select ON public.meta_insights;
CREATE POLICY meta_insights_select ON public.meta_insights FOR SELECT TO authenticated
  USING (empresa_id IN (SELECT public.empresas_del_usuario()));

DROP POLICY IF EXISTS meta_medios_select ON public.meta_medios;
CREATE POLICY meta_medios_select ON public.meta_medios FOR SELECT TO authenticated
  USING (empresa_id IN (SELECT public.empresas_del_usuario()));

COMMENT ON TABLE public.meta_campanas IS
  'Espejo de las campañas de Meta (PRP-087). La verdad está en Meta; esto es caché refrescada por cron.';
COMMENT ON TABLE public.meta_insights IS
  'Resultados por día y nivel. Por día para poder sumar el mes en curso del reloj de la empresa (tope de gasto).';

-- ─── Suma del gasto en un período ───────────────────────────────────
-- Se suma EN LA BASE DE DATOS a propósito. Leyendo las filas y sumando en el
-- servidor, Supabase corta a 1.000 filas y el resultado saldría más BAJO que
-- el real: un mes con muchas campañas dejaría pasar el tope de gasto sin
-- que nadie se entere. Aquí no hay tope de filas que valga.
CREATE OR REPLACE FUNCTION public.meta_gasto_periodo(
  p_empresa UUID,
  p_desde   DATE,
  p_hasta   DATE
) RETURNS BIGINT
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT COALESCE(SUM(gasto_cent), 0)::BIGINT
  FROM public.meta_insights
  WHERE empresa_id = p_empresa
    AND nivel = 'campana'
    AND dia BETWEEN p_desde AND p_hasta;
$$;

COMMENT ON FUNCTION public.meta_gasto_periodo IS
  'Gasto en céntimos de la cuenta publicitaria en un período. Suma en BD para no toparse con el límite de 1000 filas.';
