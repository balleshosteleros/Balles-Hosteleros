-- PRP-055: Asistente de soporte RAG filtrado por rol.
-- Extensión pgvector + base de conocimiento global + log de consultas + RPC de búsqueda.

CREATE EXTENSION IF NOT EXISTS vector;

-- ============================================================
-- Tabla GLOBAL del software (no por empresa, estilo seeds canónicos).
-- Indexa el contenido de Formación + artículos de soporte a mano.
-- Solo el service role escribe (no hay policy de INSERT/UPDATE/DELETE).
-- Embeddings de 384 dims (motor propio de Supabase: gte-small).
-- ============================================================
CREATE TABLE IF NOT EXISTS soporte_conocimiento (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fuente TEXT NOT NULL CHECK (fuente IN ('formacion', 'manual')),
  origen_ref TEXT,                -- 'leccion:<id>','curso:<id>','novedad:<id>','manual:<id>'
  modulo TEXT NOT NULL,           -- nombre canónico ('COCINA','SALA','RECURSOS HUMANOS'...): casa con puedeVer()
  departamento TEXT,
  puesto TEXT,
  titulo TEXT NOT NULL,
  contenido TEXT NOT NULL,
  enlaces JSONB NOT NULL DEFAULT '[]'::jsonb,   -- [{titulo,url}]
  videos JSONB NOT NULL DEFAULT '[]'::jsonb,    -- [{titulo,url,duracion_min}]
  embedding VECTOR(384),
  activo BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Único normal (no parcial) para poder usarlo como ON CONFLICT en upserts.
-- Postgres trata cada NULL como distinto → los artículos a mano sin origen_ref coexisten.
ALTER TABLE soporte_conocimiento
  ADD CONSTRAINT soporte_conocimiento_origen_ref_uniq UNIQUE (origen_ref);
CREATE INDEX IF NOT EXISTS soporte_conocimiento_embedding_hnsw
  ON soporte_conocimiento USING hnsw (embedding vector_cosine_ops);
CREATE INDEX IF NOT EXISTS soporte_conocimiento_modulo_idx
  ON soporte_conocimiento (modulo) WHERE activo;

ALTER TABLE soporte_conocimiento ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "soporte_conocimiento lectura autenticados" ON soporte_conocimiento;
CREATE POLICY "soporte_conocimiento lectura autenticados" ON soporte_conocimiento
  FOR SELECT TO authenticated USING (activo);

-- ============================================================
-- Log de consultas para analítica (por empresa, RLS multi-tenant).
-- ============================================================
CREATE TABLE IF NOT EXISTS soporte_consultas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id UUID NOT NULL,
  user_id UUID REFERENCES auth.users(id),
  pregunta TEXT NOT NULL,
  modulos_permitidos TEXT[] NOT NULL DEFAULT '{}',
  chunks_usados UUID[] NOT NULL DEFAULT '{}',
  escalo BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS soporte_consultas_empresa_idx
  ON soporte_consultas (empresa_id, created_at DESC);

ALTER TABLE soporte_consultas ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "soporte_consultas por empresa" ON soporte_consultas;
CREATE POLICY "soporte_consultas por empresa" ON soporte_consultas
  FOR SELECT TO authenticated
  USING (empresa_id IN (SELECT empresas_del_usuario()));
-- El INSERT lo hace el route handler con service role tras resolver empresa_id.

-- ============================================================
-- RPC de búsqueda con DOBLE filtro: activo + módulos permitidos.
-- El filtro de módulos va DENTRO de la query (candado 1).
-- ============================================================
CREATE OR REPLACE FUNCTION buscar_soporte_conocimiento(
  query_embedding VECTOR(384),
  modulos_permitidos TEXT[],
  top_k INT DEFAULT 6
) RETURNS TABLE (
  id UUID,
  modulo TEXT,
  titulo TEXT,
  contenido TEXT,
  enlaces JSONB,
  videos JSONB,
  distancia FLOAT
) LANGUAGE sql STABLE
SET search_path = public, pg_temp
AS $$
  SELECT sc.id, sc.modulo, sc.titulo, sc.contenido, sc.enlaces, sc.videos,
         (sc.embedding <=> query_embedding) AS distancia
  FROM public.soporte_conocimiento sc
  WHERE sc.activo
    AND sc.embedding IS NOT NULL
    AND sc.modulo = ANY(modulos_permitidos)   -- CANDADO 1: filtro de módulos en la propia query
  ORDER BY sc.embedding <=> query_embedding
  LIMIT GREATEST(top_k, 1);
$$;
