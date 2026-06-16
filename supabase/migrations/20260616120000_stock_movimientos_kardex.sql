-- PRP-057: Libro mayor (kardex) de movimientos de stock. SIN columna de almacén.
CREATE TABLE IF NOT EXISTS stock_movimientos (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id       UUID NOT NULL,
  producto_id      UUID NOT NULL REFERENCES productos(id) ON DELETE CASCADE,
  fecha            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  tipo             TEXT NOT NULL CHECK (tipo IN ('entrada','salida')),
  cantidad         NUMERIC NOT NULL CHECK (cantidad >= 0),   -- valor absoluto
  signo            SMALLINT NOT NULL CHECK (signo IN (1,-1)),
  saldo_resultante NUMERIC NOT NULL,                         -- saldo del producto tras el movimiento
  referencia       TEXT,                                     -- nº albarán (entrada) / nº factura Ágora (salida)
  documento_tipo   TEXT NOT NULL CHECK (documento_tipo IN ('albaran','pos_ticket','ajuste')),
  documento_id     UUID,                                     -- albaranes.id / pos_tickets.id
  origen_linea_id  UUID,                                     -- albaranes_lineas.id / pos_ticket_lineas.id
  motivo           TEXT,                                     -- nota libre (ajustes/saneamiento)
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by       UUID
);

-- Idempotencia: una entrada = (línea de albarán × producto); una salida = (línea Ágora × ingrediente).
CREATE UNIQUE INDEX IF NOT EXISTS uq_stock_mov_origen
  ON stock_movimientos (origen_linea_id, producto_id)
  WHERE origen_linea_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_stock_mov_producto_fecha
  ON stock_movimientos (empresa_id, producto_id, fecha DESC);

ALTER TABLE stock_movimientos ENABLE ROW LEVEL SECURITY;
-- Multi-tenant con el helper canónico (memoria project_rls_helper_empresas_del_usuario).
DROP POLICY IF EXISTS stock_mov_sel ON stock_movimientos;
CREATE POLICY stock_mov_sel ON stock_movimientos
  FOR SELECT TO authenticated
  USING (empresa_id IN (SELECT empresas_del_usuario()));
-- Escritura solo vía service role / acciones server (sin policy de INSERT/UPDATE/DELETE para usuarios).
