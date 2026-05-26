-- ============================================================
-- PRP-042 — Cuestionarios → Campañas Semestrales
-- Aplicada vía Supabase MCP el 2026-05-26.
-- 4 tablas (plantillas, campanas, envios, puntos) + RLS canónico
-- (UNION user_empresas + profiles).
-- ============================================================

-- ─── 1. PLANTILLAS ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.cuestionario_plantillas (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id            UUID NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  nombre                TEXT NOT NULL,
  descripcion           TEXT,
  categoria             TEXT NOT NULL DEFAULT 'evaluacion',
  duracion_minutos      INTEGER NOT NULL DEFAULT 15,
  intentos_max          INTEGER NOT NULL DEFAULT 1,
  nota_corte            INTEGER NOT NULL DEFAULT 0,
  mostrar_resultados    BOOLEAN NOT NULL DEFAULT TRUE,
  aleatorizar_preguntas BOOLEAN NOT NULL DEFAULT FALSE,
  mensaje_inicial       TEXT NOT NULL DEFAULT '',
  mensaje_aprobado      TEXT NOT NULL DEFAULT '',
  mensaje_no_aprobado   TEXT NOT NULL DEFAULT '',
  bloques               JSONB NOT NULL DEFAULT '[]'::jsonb,
  archivada             BOOLEAN NOT NULL DEFAULT FALSE,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by            UUID REFERENCES auth.users(id),

  CONSTRAINT cuestionario_plantillas_categoria_chk
    CHECK (categoria IN ('evaluacion','formacion','conocimiento','induccion'))
);

CREATE INDEX IF NOT EXISTS cuestionario_plantillas_empresa_idx
  ON public.cuestionario_plantillas (empresa_id);

-- ─── 2. CAMPAÑAS (1 por semestre × empresa) ──────────────────
CREATE TABLE IF NOT EXISTS public.cuestionario_campanas (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id      UUID NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  plantilla_id    UUID NOT NULL REFERENCES public.cuestionario_plantillas(id) ON DELETE RESTRICT,
  periodo         TEXT NOT NULL,
  periodo_inicio  DATE NOT NULL,
  periodo_fin     DATE NOT NULL,
  estado          TEXT NOT NULL DEFAULT 'activa',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by      UUID REFERENCES auth.users(id),

  CONSTRAINT cuestionario_campanas_periodo_chk
    CHECK (periodo ~ '^\d{4}-S[12]$'),
  CONSTRAINT cuestionario_campanas_estado_chk
    CHECK (estado IN ('activa','cerrada','archivada')),
  CONSTRAINT cuestionario_campanas_uniq_periodo
    UNIQUE (empresa_id, periodo)
);

CREATE INDEX IF NOT EXISTS cuestionario_campanas_empresa_idx
  ON public.cuestionario_campanas (empresa_id);
CREATE INDEX IF NOT EXISTS cuestionario_campanas_estado_idx
  ON public.cuestionario_campanas (estado);

-- ─── 3. ENVÍOS (1 por empleado × campaña) ────────────────────
CREATE TABLE IF NOT EXISTS public.cuestionario_envios (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campana_id       UUID NOT NULL REFERENCES public.cuestionario_campanas(id) ON DELETE CASCADE,
  empresa_id       UUID NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  empleado_id      UUID NOT NULL REFERENCES public.empleados(id) ON DELETE CASCADE,

  respuestas       JSONB,
  respondido_at    TIMESTAMPTZ,
  puntuacion       INTEGER,
  nota_sobre       INTEGER,
  aprobado         BOOLEAN,

  reunion_fecha    DATE,
  reunion_estado   TEXT NOT NULL DEFAULT 'pendiente',
  reunion_notas    TEXT,
  reunion_at       TIMESTAMPTZ,

  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT cuestionario_envios_reunion_estado_chk
    CHECK (reunion_estado IN ('pendiente','realizada','cancelada','no_aplica')),
  CONSTRAINT cuestionario_envios_uniq_empleado
    UNIQUE (campana_id, empleado_id)
);

CREATE INDEX IF NOT EXISTS cuestionario_envios_campana_idx
  ON public.cuestionario_envios (campana_id);
CREATE INDEX IF NOT EXISTS cuestionario_envios_empleado_idx
  ON public.cuestionario_envios (empleado_id);
CREATE INDEX IF NOT EXISTS cuestionario_envios_empresa_idx
  ON public.cuestionario_envios (empresa_id);

-- ─── 4. PUNTOS CLAVE (timeline de seguimiento) ──────────────
CREATE TABLE IF NOT EXISTS public.cuestionario_puntos (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  envio_id            UUID NOT NULL REFERENCES public.cuestionario_envios(id) ON DELETE CASCADE,
  empresa_id          UUID NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  texto               TEXT NOT NULL,
  estado_seguimiento  TEXT NOT NULL DEFAULT 'pendiente',
  cerrado_at          TIMESTAMPTZ,
  orden               INTEGER NOT NULL DEFAULT 0,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by          UUID REFERENCES auth.users(id),

  CONSTRAINT cuestionario_puntos_estado_chk
    CHECK (estado_seguimiento IN ('pendiente','en_curso','cerrado'))
);

CREATE INDEX IF NOT EXISTS cuestionario_puntos_envio_idx
  ON public.cuestionario_puntos (envio_id);
CREATE INDEX IF NOT EXISTS cuestionario_puntos_empresa_idx
  ON public.cuestionario_puntos (empresa_id);

-- ─── Triggers de updated_at ─────────────────────────────────
CREATE OR REPLACE FUNCTION public.cuestionario_envios_touch_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS cuestionario_envios_touch_updated_at ON public.cuestionario_envios;
CREATE TRIGGER cuestionario_envios_touch_updated_at
  BEFORE UPDATE ON public.cuestionario_envios
  FOR EACH ROW EXECUTE FUNCTION public.cuestionario_envios_touch_updated_at();

CREATE OR REPLACE FUNCTION public.cuestionario_plantillas_touch_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS cuestionario_plantillas_touch_updated_at ON public.cuestionario_plantillas;
CREATE TRIGGER cuestionario_plantillas_touch_updated_at
  BEFORE UPDATE ON public.cuestionario_plantillas
  FOR EACH ROW EXECUTE FUNCTION public.cuestionario_plantillas_touch_updated_at();

-- ============================================================
-- RLS canónico (UNION user_empresas + profiles)
-- ============================================================

ALTER TABLE public.cuestionario_plantillas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cuestionario_campanas   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cuestionario_envios     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cuestionario_puntos     ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "cuestionario_plantillas_read"  ON public.cuestionario_plantillas;
DROP POLICY IF EXISTS "cuestionario_plantillas_write" ON public.cuestionario_plantillas;
CREATE POLICY "cuestionario_plantillas_read" ON public.cuestionario_plantillas
  FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM user_empresas ue WHERE ue.user_id = auth.uid() AND ue.empresa_id = cuestionario_plantillas.empresa_id)
    OR EXISTS (SELECT 1 FROM profiles p   WHERE p.user_id  = auth.uid() AND p.empresa_id  = cuestionario_plantillas.empresa_id)
  );
CREATE POLICY "cuestionario_plantillas_write" ON public.cuestionario_plantillas
  FOR ALL TO authenticated
  USING (
    EXISTS (SELECT 1 FROM user_empresas ue WHERE ue.user_id = auth.uid() AND ue.empresa_id = cuestionario_plantillas.empresa_id)
    OR EXISTS (SELECT 1 FROM profiles p   WHERE p.user_id  = auth.uid() AND p.empresa_id  = cuestionario_plantillas.empresa_id)
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM user_empresas ue WHERE ue.user_id = auth.uid() AND ue.empresa_id = cuestionario_plantillas.empresa_id)
    OR EXISTS (SELECT 1 FROM profiles p   WHERE p.user_id  = auth.uid() AND p.empresa_id  = cuestionario_plantillas.empresa_id)
  );

DROP POLICY IF EXISTS "cuestionario_campanas_read"  ON public.cuestionario_campanas;
DROP POLICY IF EXISTS "cuestionario_campanas_write" ON public.cuestionario_campanas;
CREATE POLICY "cuestionario_campanas_read" ON public.cuestionario_campanas
  FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM user_empresas ue WHERE ue.user_id = auth.uid() AND ue.empresa_id = cuestionario_campanas.empresa_id)
    OR EXISTS (SELECT 1 FROM profiles p   WHERE p.user_id  = auth.uid() AND p.empresa_id  = cuestionario_campanas.empresa_id)
  );
CREATE POLICY "cuestionario_campanas_write" ON public.cuestionario_campanas
  FOR ALL TO authenticated
  USING (
    EXISTS (SELECT 1 FROM user_empresas ue WHERE ue.user_id = auth.uid() AND ue.empresa_id = cuestionario_campanas.empresa_id)
    OR EXISTS (SELECT 1 FROM profiles p   WHERE p.user_id  = auth.uid() AND p.empresa_id  = cuestionario_campanas.empresa_id)
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM user_empresas ue WHERE ue.user_id = auth.uid() AND ue.empresa_id = cuestionario_campanas.empresa_id)
    OR EXISTS (SELECT 1 FROM profiles p   WHERE p.user_id  = auth.uid() AND p.empresa_id  = cuestionario_campanas.empresa_id)
  );

DROP POLICY IF EXISTS "cuestionario_envios_read"  ON public.cuestionario_envios;
DROP POLICY IF EXISTS "cuestionario_envios_write" ON public.cuestionario_envios;
CREATE POLICY "cuestionario_envios_read" ON public.cuestionario_envios
  FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM user_empresas ue WHERE ue.user_id = auth.uid() AND ue.empresa_id = cuestionario_envios.empresa_id)
    OR EXISTS (SELECT 1 FROM profiles p   WHERE p.user_id  = auth.uid() AND p.empresa_id  = cuestionario_envios.empresa_id)
  );
CREATE POLICY "cuestionario_envios_write" ON public.cuestionario_envios
  FOR ALL TO authenticated
  USING (
    EXISTS (SELECT 1 FROM user_empresas ue WHERE ue.user_id = auth.uid() AND ue.empresa_id = cuestionario_envios.empresa_id)
    OR EXISTS (SELECT 1 FROM profiles p   WHERE p.user_id  = auth.uid() AND p.empresa_id  = cuestionario_envios.empresa_id)
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM user_empresas ue WHERE ue.user_id = auth.uid() AND ue.empresa_id = cuestionario_envios.empresa_id)
    OR EXISTS (SELECT 1 FROM profiles p   WHERE p.user_id  = auth.uid() AND p.empresa_id  = cuestionario_envios.empresa_id)
  );

DROP POLICY IF EXISTS "cuestionario_puntos_read"  ON public.cuestionario_puntos;
DROP POLICY IF EXISTS "cuestionario_puntos_write" ON public.cuestionario_puntos;
CREATE POLICY "cuestionario_puntos_read" ON public.cuestionario_puntos
  FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM user_empresas ue WHERE ue.user_id = auth.uid() AND ue.empresa_id = cuestionario_puntos.empresa_id)
    OR EXISTS (SELECT 1 FROM profiles p   WHERE p.user_id  = auth.uid() AND p.empresa_id  = cuestionario_puntos.empresa_id)
  );
CREATE POLICY "cuestionario_puntos_write" ON public.cuestionario_puntos
  FOR ALL TO authenticated
  USING (
    EXISTS (SELECT 1 FROM user_empresas ue WHERE ue.user_id = auth.uid() AND ue.empresa_id = cuestionario_puntos.empresa_id)
    OR EXISTS (SELECT 1 FROM profiles p   WHERE p.user_id  = auth.uid() AND p.empresa_id  = cuestionario_puntos.empresa_id)
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM user_empresas ue WHERE ue.user_id = auth.uid() AND ue.empresa_id = cuestionario_puntos.empresa_id)
    OR EXISTS (SELECT 1 FROM profiles p   WHERE p.user_id  = auth.uid() AND p.empresa_id  = cuestionario_puntos.empresa_id)
  );
