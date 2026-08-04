# Backfill `producto_proveedor_aliases` — 2026-08-04 (PRP-073 TASK-221)

`productos.nombre_proveedor` → tabla de alias, SOLO cuando el proveedor del producto se
resuelve sin ambigüedad por su histórico de precios. La columna legacy queda de solo
lectura (fallback del matcher una versión).

- Productos con alias legacy: **150**
- Migrados (inequívocos): **145**
- Sin migrar (abajo, no se adivina): **5**

## Sin migrar — se resolverán solos cuando el asistente los vincule con proveedor conocido

- "Vieira media": varios proveedores en histórico (GARCIMAR, MAKRO)
- "Paleta cebo ibérico 50% loncheada": varios proveedores en histórico (LA BARRICA, MAKRO)
- "Canonigos": varios proveedores en histórico (DITHER, MAKRO)
- "Rucula": varios proveedores en histórico (DITHER, MAKRO)
- "Corona 1/3": proveedor "DISBESA" no está dado de alta con ese nombre
