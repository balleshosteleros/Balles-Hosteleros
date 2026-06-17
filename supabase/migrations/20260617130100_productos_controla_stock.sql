-- PRP-057: interruptor por producto "Controlar stock" (Sí/No). Si false, el producto
-- NO suma por albaranes ni descuenta por ventas (no genera movimientos de kardex).
-- Default true. (Aplicada en remoto vía MCP; este fichero la versiona en el repo.)
ALTER TABLE productos
  ADD COLUMN IF NOT EXISTS controla_stock BOOLEAN NOT NULL DEFAULT true;

COMMENT ON COLUMN productos.controla_stock IS
  'PRP-057: si false, el producto no participa en el kardex (ni entradas por albarán ni salidas por venta). El histórico previo se conserva, solo se congela.';
