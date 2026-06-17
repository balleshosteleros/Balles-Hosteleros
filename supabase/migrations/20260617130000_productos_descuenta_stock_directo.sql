-- PRP-057 Fase 5: marca productos que descuentan 1:1 su PROPIO stock al venderse,
-- sin escandallo (bebidas que se compran y venden tal cual).
-- (Aplicada en remoto vía MCP; este fichero la versiona en el repo.)
ALTER TABLE productos
  ADD COLUMN IF NOT EXISTS descuenta_stock_directo BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN productos.descuenta_stock_directo IS
  'PRP-057: si true, al venderse descuenta 1:1 de su propio stock sin escandallo (bebidas compra+venta tal cual).';
