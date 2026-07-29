-- Casilla "nombre del proveedor" en la ficha de producto de compra.
-- Guarda cómo llama el proveedor a este producto en su albarán/factura, para que el
-- asistente de albaranes por foto empareje la línea leída con nuestro producto.
-- Decisión de negocio (Iván, 2026-07-29): UN solo nombre de proveedor por producto.
-- Ver docs/TAREA_FERNANDO_precios_compra_bacanal.md → "FLUJO DEFINITIVO DEL ASISTENTE".
-- Idempotente.

ALTER TABLE productos
  ADD COLUMN IF NOT EXISTS nombre_proveedor text;

COMMENT ON COLUMN productos.nombre_proveedor IS
  'Cómo nombra el proveedor a este producto en sus albaranes/facturas (alias para el OCR de albaranes). Un solo nombre por producto.';
