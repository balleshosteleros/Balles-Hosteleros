-- ============================================================================
-- Formación: texto libre por tema/lección + portada, preguntas y me gusta.
-- ----------------------------------------------------------------------------
-- 1) Texto libre del tema (sección) y de la lección (contenido extra),
--    y tipo de documento para incrustarlo (pdf/imagen).
-- 2) Tabla de preguntas privadas (empleado pregunta → RRHH responde).
-- 3) Tabla de "me gusta" por lección (1 por usuario y lección).
-- Idempotente.
-- ============================================================================

-- 1) Texto libre y tipo de documento ----------------------------------------
ALTER TABLE public.formacion_secciones
  ADD COLUMN IF NOT EXISTS descripcion text;

ALTER TABLE public.formacion_lecciones
  ADD COLUMN IF NOT EXISTS contenido text,
  ADD COLUMN IF NOT EXISTS documento_tipo text,       -- 'pdf' | 'imagen' | null
  ADD COLUMN IF NOT EXISTS cuestionario_obligatorio boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS cuestionario_aprobado_pct integer NOT NULL DEFAULT 80; -- % para aprobar

-- 2) Preguntas privadas (bandeja de dudas hacia RRHH/admin) ------------------
CREATE TABLE IF NOT EXISTS public.formacion_preguntas (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id   uuid NOT NULL,
  curso_id     uuid NOT NULL REFERENCES public.formacion_cursos(id) ON DELETE CASCADE,
  leccion_id   uuid NOT NULL REFERENCES public.formacion_lecciones(id) ON DELETE CASCADE,
  user_id      uuid NOT NULL,           -- quien pregunta
  pregunta     text NOT NULL,
  respuesta    text,                    -- la rellena RRHH/admin
  respondida_por uuid,
  respondida_at  timestamptz,
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_formacion_preguntas_leccion ON public.formacion_preguntas(leccion_id);
CREATE INDEX IF NOT EXISTS idx_formacion_preguntas_empresa ON public.formacion_preguntas(empresa_id);

ALTER TABLE public.formacion_preguntas ENABLE ROW LEVEL SECURITY;

-- El empleado ve/crea SUS preguntas; admin de la empresa ve todas las de su empresa.
DROP POLICY IF EXISTS formacion_preguntas_select ON public.formacion_preguntas;
CREATE POLICY formacion_preguntas_select ON public.formacion_preguntas
  FOR SELECT TO authenticated
  USING (
    empresa_id IN (SELECT empresas_del_usuario())
    AND (user_id = auth.uid() OR public.bh_es_admin())
  );

DROP POLICY IF EXISTS formacion_preguntas_insert ON public.formacion_preguntas;
CREATE POLICY formacion_preguntas_insert ON public.formacion_preguntas
  FOR INSERT TO authenticated
  WITH CHECK (
    empresa_id IN (SELECT empresas_del_usuario())
    AND user_id = auth.uid()
  );

-- Solo admin responde (UPDATE).
DROP POLICY IF EXISTS formacion_preguntas_update ON public.formacion_preguntas;
CREATE POLICY formacion_preguntas_update ON public.formacion_preguntas
  FOR UPDATE TO authenticated
  USING (empresa_id IN (SELECT empresas_del_usuario()) AND public.bh_es_admin());

-- 3) Me gusta por lección (1 por usuario) ------------------------------------
CREATE TABLE IF NOT EXISTS public.formacion_likes (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id  uuid NOT NULL,
  leccion_id  uuid NOT NULL REFERENCES public.formacion_lecciones(id) ON DELETE CASCADE,
  user_id     uuid NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (leccion_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_formacion_likes_leccion ON public.formacion_likes(leccion_id);

ALTER TABLE public.formacion_likes ENABLE ROW LEVEL SECURITY;

-- Cualquiera de la empresa ve los likes; cada uno gestiona el suyo.
DROP POLICY IF EXISTS formacion_likes_select ON public.formacion_likes;
CREATE POLICY formacion_likes_select ON public.formacion_likes
  FOR SELECT TO authenticated
  USING (empresa_id IN (SELECT empresas_del_usuario()));

DROP POLICY IF EXISTS formacion_likes_insert ON public.formacion_likes;
CREATE POLICY formacion_likes_insert ON public.formacion_likes
  FOR INSERT TO authenticated
  WITH CHECK (empresa_id IN (SELECT empresas_del_usuario()) AND user_id = auth.uid());

DROP POLICY IF EXISTS formacion_likes_delete ON public.formacion_likes;
CREATE POLICY formacion_likes_delete ON public.formacion_likes
  FOR DELETE TO authenticated
  USING (user_id = auth.uid());

-- 4) Cuestionario tipo test por lección --------------------------------------
-- Preguntas del test. `opciones` es jsonb: [{ "texto": "...", "correcta": true }, ...]
CREATE TABLE IF NOT EXISTS public.formacion_cuestionario_preguntas (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id  uuid NOT NULL,
  leccion_id  uuid NOT NULL REFERENCES public.formacion_lecciones(id) ON DELETE CASCADE,
  enunciado   text NOT NULL,
  opciones    jsonb NOT NULL DEFAULT '[]'::jsonb,
  orden       integer NOT NULL DEFAULT 0,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_form_cuest_preg_leccion ON public.formacion_cuestionario_preguntas(leccion_id);

ALTER TABLE public.formacion_cuestionario_preguntas ENABLE ROW LEVEL SECURITY;

-- Todos los de la empresa leen las preguntas (para hacer el test); solo admin las edita.
DROP POLICY IF EXISTS form_cuest_preg_select ON public.formacion_cuestionario_preguntas;
CREATE POLICY form_cuest_preg_select ON public.formacion_cuestionario_preguntas
  FOR SELECT TO authenticated
  USING (empresa_id IN (SELECT empresas_del_usuario()));

DROP POLICY IF EXISTS form_cuest_preg_write ON public.formacion_cuestionario_preguntas;
CREATE POLICY form_cuest_preg_write ON public.formacion_cuestionario_preguntas
  FOR ALL TO authenticated
  USING (empresa_id IN (SELECT empresas_del_usuario()) AND public.bh_es_admin())
  WITH CHECK (empresa_id IN (SELECT empresas_del_usuario()) AND public.bh_es_admin());

-- Intentos del empleado: nota obtenida y si aprobó.
CREATE TABLE IF NOT EXISTS public.formacion_cuestionario_intentos (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id  uuid NOT NULL,
  leccion_id  uuid NOT NULL REFERENCES public.formacion_lecciones(id) ON DELETE CASCADE,
  user_id     uuid NOT NULL,
  nota_pct    integer NOT NULL,        -- 0-100
  aprobado    boolean NOT NULL,
  respuestas  jsonb,                   -- { pregunta_id: indice_opcion_elegida }
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_form_cuest_int_leccion_user
  ON public.formacion_cuestionario_intentos(leccion_id, user_id);

ALTER TABLE public.formacion_cuestionario_intentos ENABLE ROW LEVEL SECURITY;

-- Cada uno ve sus intentos; admin ve todos los de su empresa.
DROP POLICY IF EXISTS form_cuest_int_select ON public.formacion_cuestionario_intentos;
CREATE POLICY form_cuest_int_select ON public.formacion_cuestionario_intentos
  FOR SELECT TO authenticated
  USING (
    empresa_id IN (SELECT empresas_del_usuario())
    AND (user_id = auth.uid() OR public.bh_es_admin())
  );

DROP POLICY IF EXISTS form_cuest_int_insert ON public.formacion_cuestionario_intentos;
CREATE POLICY form_cuest_int_insert ON public.formacion_cuestionario_intentos
  FOR INSERT TO authenticated
  WITH CHECK (empresa_id IN (SELECT empresas_del_usuario()) AND user_id = auth.uid());
