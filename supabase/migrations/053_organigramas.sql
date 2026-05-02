-- Persistencia del organigrama por empresa.
-- Mismo patrón que empresa_logos: PK por slug (independiente de UUIDs),
-- lectura pública vía RLS, escritura solo via service-role (Server Actions).

CREATE TABLE IF NOT EXISTS organigramas (
  empresa_slug TEXT        PRIMARY KEY,
  nodes        JSONB       NOT NULL DEFAULT '[]'::jsonb,
  edges        JSONB       NOT NULL DEFAULT '[]'::jsonb,
  zones        JSONB       NOT NULL DEFAULT '[]'::jsonb,
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE organigramas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public read organigramas" ON organigramas;
CREATE POLICY "Public read organigramas" ON organigramas
  FOR SELECT USING (true);
