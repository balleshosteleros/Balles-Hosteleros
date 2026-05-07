-- Renombrar valor de conservación: "Frío" → "Frigorífico"
-- La columna `productos.conservacion` usa el enum `producto_conservacion`.
-- ALTER TYPE ... RENAME VALUE preserva todas las filas existentes (PG 10+).
ALTER TYPE producto_conservacion RENAME VALUE 'Frío' TO 'Frigorífico';
