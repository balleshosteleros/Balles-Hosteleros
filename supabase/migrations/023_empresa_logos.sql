-- Tabla para URLs de logos de empresas.
-- PRIMARY KEY en empresa_slug garantiza exactamente un registro por empresa,
-- de modo que los upserts actualizan en vez de insertar filas duplicadas.

CREATE TABLE IF NOT EXISTS empresa_logos (
  empresa_slug TEXT        PRIMARY KEY,
  logo_url     TEXT        NOT NULL DEFAULT '',
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Si la tabla ya existía sin PRIMARY KEY (creada a mano), migrar los datos:
-- 1. Eliminar filas duplicadas conservando la más reciente por empresa_slug.
-- 2. Añadir la restricción de unicidad si faltaba.
DO $$
BEGIN
  -- Limpiar duplicados: quedarse solo con el registro de updated_at más reciente
  DELETE FROM empresa_logos el1
  USING empresa_logos el2
  WHERE el1.empresa_slug = el2.empresa_slug
    AND el1.updated_at < el2.updated_at;

  -- Añadir la clave primaria si todavía no existe
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'empresa_logos'::regclass
      AND contype = 'p'
  ) THEN
    ALTER TABLE empresa_logos ADD PRIMARY KEY (empresa_slug);
  END IF;
END $$;

-- RLS: activar y permitir lectura pública (las URLs son públicas de todas formas)
ALTER TABLE empresa_logos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public read empresa_logos" ON empresa_logos;
CREATE POLICY "Public read empresa_logos" ON empresa_logos
  FOR SELECT USING (true);
