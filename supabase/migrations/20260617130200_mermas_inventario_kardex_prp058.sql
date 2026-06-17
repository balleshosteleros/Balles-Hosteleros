-- PRP-058: ampliar tipos de movimiento del kardex + tabla de mermas + producto_id en líneas de inventario.
-- (Aplicada en remoto vía MCP; este fichero la versiona en el repo.)

-- 1) Ampliar el CHECK de documento_tipo a 'inventario' y 'merma'.
ALTER TABLE stock_movimientos DROP CONSTRAINT IF EXISTS stock_movimientos_documento_tipo_check;
ALTER TABLE stock_movimientos
  ADD CONSTRAINT stock_movimientos_documento_tipo_check
  CHECK (documento_tipo IN ('albaran','pos_ticket','inventario','merma','ajuste'));

-- 2) Tabla de mermas (cabecera mínima; el descuento de stock lo hace el kardex).
CREATE TABLE IF NOT EXISTS mermas (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id   UUID NOT NULL,
  producto_id  UUID NOT NULL REFERENCES productos(id) ON DELETE CASCADE,
  cantidad     NUMERIC NOT NULL CHECK (cantidad > 0),
  unidad       TEXT,
  motivo       TEXT NOT NULL,                 -- obligatorio (patrón datos completos)
  created_by   UUID,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_mermas_empresa_fecha ON mermas (empresa_id, created_at DESC);

ALTER TABLE mermas ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS mermas_sel ON mermas;
CREATE POLICY mermas_sel ON mermas
  FOR SELECT TO authenticated
  USING (empresa_id IN (SELECT empresas_del_usuario()));
-- Escritura vía service role / acciones server.

-- 3) producto_id en líneas de inventario (para indexar el kardex por producto).
ALTER TABLE lineas_inventario
  ADD COLUMN IF NOT EXISTS producto_id UUID REFERENCES productos(id);
