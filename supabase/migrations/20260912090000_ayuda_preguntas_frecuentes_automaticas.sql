-- AYUDA INTELIGENTE — las preguntas frecuentes se escriben solas.
--
-- Qué añade:
--   1. `soporte_consultas` guarda TAMBIÉN la respuesta que se dio y el embedding
--      de la pregunta. El embedding se calcula igual para responder, así que
--      guardarlo sale gratis y evita recalcularlo cada semana al agrupar.
--   2. `soporte_faq`: las preguntas frecuentes publicadas. Por EMPRESA (nacen de
--      lo que pregunta la gente de esa empresa) y etiquetadas con el mismo
--      nombre de módulo que usa el candado de rol: la pregunta de nóminas nace
--      como RECURSOS HUMANOS y un camarero no la recupera nunca.
--   3. `soporte_huecos`: lo que la gente pregunta y el software NO sabe
--      responder. Es la lista de trabajo de Dirección y el motivo por el que
--      esto se alimenta solo: se escribe el artículo una vez y a partir de ahí
--      la pregunta se publica sola.
--
-- La base de conocimiento (`soporte_conocimiento`) sigue siendo GLOBAL: el
-- manual del software es el mismo para las tres sociedades. Lo que no se cruza
-- jamás entre empresas es lo de arriba: consultas, preguntas frecuentes y huecos.
--
-- Idempotente.

-- ============================================================
-- 1. El manual del propio software como fuente de conocimiento
-- ============================================================
ALTER TABLE soporte_conocimiento DROP CONSTRAINT IF EXISTS soporte_conocimiento_fuente_check;
ALTER TABLE soporte_conocimiento
  ADD CONSTRAINT soporte_conocimiento_fuente_check
  CHECK (fuente IN ('formacion', 'manual', 'software'));

-- ============================================================
-- 2. El log de consultas guarda la respuesta y el embedding
-- ============================================================
ALTER TABLE soporte_consultas ADD COLUMN IF NOT EXISTS respuesta TEXT;
ALTER TABLE soporte_consultas ADD COLUMN IF NOT EXISTS embedding VECTOR(384);
-- 'resuelta'  → el asistente contestó con conocimiento real
-- 'escalada'  → se avisó a una persona
-- 'sin_datos' → no hay nada escrito sobre eso (alimenta soporte_huecos)
-- 'ajena'     → no es información de la empresa
ALTER TABLE soporte_consultas ADD COLUMN IF NOT EXISTS desenlace TEXT;
ALTER TABLE soporte_consultas DROP CONSTRAINT IF EXISTS soporte_consultas_desenlace_check;
ALTER TABLE soporte_consultas
  ADD CONSTRAINT soporte_consultas_desenlace_check
  CHECK (desenlace IS NULL OR desenlace IN ('resuelta', 'escalada', 'sin_datos', 'ajena'));

CREATE INDEX IF NOT EXISTS soporte_consultas_empresa_fecha_idx
  ON soporte_consultas (empresa_id, created_at DESC);

-- ============================================================
-- 3. Preguntas frecuentes — POR EMPRESA
-- ============================================================
CREATE TABLE IF NOT EXISTS soporte_faq (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id UUID NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  -- Nombre canónico de módulo ('COCINA', 'RECURSOS HUMANOS', 'GENERAL'...).
  -- De aquí sale el candado de rol al leerlas.
  modulo TEXT NOT NULL,
  pregunta TEXT NOT NULL,
  respuesta TEXT NOT NULL,
  -- Cuántas veces se preguntó lo mismo. Es el ORDEN de la lista.
  veces_preguntada INT NOT NULL DEFAULT 1,
  -- Trazabilidad: de qué consultas salió y con qué conocimiento se redactó.
  consultas_ids UUID[] NOT NULL DEFAULT '{}',
  chunks_usados UUID[] NOT NULL DEFAULT '{}',
  -- (La columna `embedding` que había aquí se retira en la migración
  --  20260912120000: agrupar por parecido de texto no separaba los temas.)
  embedding VECTOR(384),
  origen TEXT NOT NULL DEFAULT 'ia' CHECK (origen IN ('ia', 'manual')),
  estado TEXT NOT NULL DEFAULT 'publicada' CHECK (estado IN ('publicada', 'borrador', 'archivada')),
  revisada_por UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  revisada_en TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS soporte_faq_empresa_modulo_idx
  ON soporte_faq (empresa_id, modulo) WHERE estado = 'publicada';
CREATE INDEX IF NOT EXISTS soporte_faq_orden_idx
  ON soporte_faq (empresa_id, veces_preguntada DESC);
CREATE INDEX IF NOT EXISTS soporte_faq_embedding_hnsw
  ON soporte_faq USING hnsw (embedding vector_cosine_ops);

ALTER TABLE soporte_faq ENABLE ROW LEVEL SECURITY;
-- Candado de empresa. El candado de MÓDULO no va aquí: lo aplica el servidor
-- con el mismo `getModulosVisibles()` que usa el chat, para que exista una
-- sola fuente de verdad del permiso y no dos que puedan separarse.
DROP POLICY IF EXISTS "soporte_faq por empresa" ON soporte_faq;
CREATE POLICY "soporte_faq por empresa" ON soporte_faq
  FOR SELECT TO authenticated
  USING (empresa_id IN (SELECT empresas_del_usuario()));

-- ============================================================
-- 4. Huecos de conocimiento — lo que no sabemos responder
-- ============================================================
CREATE TABLE IF NOT EXISTS soporte_huecos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id UUID NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  pregunta TEXT NOT NULL,
  veces_preguntada INT NOT NULL DEFAULT 1,
  consultas_ids UUID[] NOT NULL DEFAULT '{}',
  embedding VECTOR(384),
  -- Módulo probable (el del conocimiento más cercano, aunque no diera la talla).
  modulo_probable TEXT,
  estado TEXT NOT NULL DEFAULT 'abierto' CHECK (estado IN ('abierto', 'resuelto', 'descartado')),
  -- Artículo que se escribió para taparlo.
  conocimiento_id UUID REFERENCES soporte_conocimiento(id) ON DELETE SET NULL,
  resuelto_por UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  resuelto_en TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS soporte_huecos_empresa_estado_idx
  ON soporte_huecos (empresa_id, estado, veces_preguntada DESC);
CREATE INDEX IF NOT EXISTS soporte_huecos_embedding_hnsw
  ON soporte_huecos USING hnsw (embedding vector_cosine_ops);

ALTER TABLE soporte_huecos ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "soporte_huecos por empresa" ON soporte_huecos;
CREATE POLICY "soporte_huecos por empresa" ON soporte_huecos
  FOR SELECT TO authenticated
  USING (empresa_id IN (SELECT empresas_del_usuario()));

-- ============================================================
-- 5. updated_at automático
-- ============================================================
CREATE OR REPLACE FUNCTION public.set_soporte_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS soporte_faq_updated_at ON soporte_faq;
CREATE TRIGGER soporte_faq_updated_at
  BEFORE UPDATE ON soporte_faq
  FOR EACH ROW EXECUTE FUNCTION public.set_soporte_updated_at();

DROP TRIGGER IF EXISTS soporte_huecos_updated_at ON soporte_huecos;
CREATE TRIGGER soporte_huecos_updated_at
  BEFORE UPDATE ON soporte_huecos
  FOR EACH ROW EXECUTE FUNCTION public.set_soporte_updated_at();

-- ============================================================
-- 6. Buscar el grupo al que pertenece una pregunta
-- ============================================================
-- Devuelve la FAQ/hueco más parecido de ESA empresa. Se usa para sumar a un
-- grupo existente en vez de duplicar la misma pregunta con otras palabras.
CREATE OR REPLACE FUNCTION buscar_faq_parecida(
  query_embedding VECTOR(384),
  p_empresa_id UUID,
  max_distancia FLOAT DEFAULT 0.15
) RETURNS TABLE (id UUID, pregunta TEXT, distancia FLOAT)
LANGUAGE sql STABLE AS $$
  SELECT f.id, f.pregunta, (f.embedding <=> query_embedding) AS distancia
  FROM soporte_faq f
  WHERE f.empresa_id = p_empresa_id
    AND f.embedding IS NOT NULL
    AND (f.embedding <=> query_embedding) <= max_distancia
  ORDER BY f.embedding <=> query_embedding
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION buscar_hueco_parecido(
  query_embedding VECTOR(384),
  p_empresa_id UUID,
  max_distancia FLOAT DEFAULT 0.15
) RETURNS TABLE (id UUID, pregunta TEXT, distancia FLOAT)
LANGUAGE sql STABLE AS $$
  SELECT h.id, h.pregunta, (h.embedding <=> query_embedding) AS distancia
  FROM soporte_huecos h
  WHERE h.empresa_id = p_empresa_id
    AND h.estado = 'abierto'
    AND h.embedding IS NOT NULL
    AND (h.embedding <=> query_embedding) <= max_distancia
  ORDER BY h.embedding <=> query_embedding
  LIMIT 1;
$$;

-- ============================================================
-- 7. Conocimiento más cercano SIN candado de módulo
-- ============================================================
-- Solo para decidir el MENSAJE cuando el asistente no puede responder:
--   - si no se parece a nada del software → "eso no es información de la empresa"
--   - si se parece pero no lo suficiente  → "lo revisaremos y se añadirá"
-- Devuelve únicamente el módulo y la distancia: NUNCA contenido. Un empleado no
-- puede sacar información de un módulo que no ve ni por este camino.
CREATE OR REPLACE FUNCTION distancia_conocimiento_global(
  query_embedding VECTOR(384)
) RETURNS TABLE (modulo TEXT, distancia FLOAT)
LANGUAGE sql STABLE AS $$
  SELECT k.modulo, (k.embedding <=> query_embedding) AS distancia
  FROM soporte_conocimiento k
  WHERE k.activo AND k.embedding IS NOT NULL
  ORDER BY k.embedding <=> query_embedding
  LIMIT 1;
$$;
