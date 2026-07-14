# PRP — Asistente de resolución de líneas no reconocidas en el OCR de facturas

> **De:** Iván (vía Claude) · **Fecha:** 2026-07-14 · **Prioridad:** media-alta
> **Para:** Fernando (retomar desde aquí; Iván aprobó el planteamiento y cerró sesión).
> Verificado contra el código real el 14-jul (no es teoría).

## Objetivo (en negocio)

Cuando el usuario sube una **factura/albarán de proveedor por OCR** y el sistema encuentra
una línea cuyo producto **no reconoce** (no está en el catálogo o no cuadra), hoy la marca
como "extra" y **bloquea la validación**. Iván quiere que en ese momento el software ofrezca,
por cada línea huérfana, **tres opciones**:

1. **Vincular a un producto existente** — con sugerencias de los más parecidos por nombre.
2. **Crear producto nuevo** ahí mismo (nombre, tipo compra, IVA, proveedor, formato) y que
   quede **vinculado automáticamente** a esa línea, con su precio grabado en el histórico.
3. **Ignorar** esa línea (no es un producto a inventariar).

Solo se puede **guardar/validar** la factura cuando todas las líneas estén resueltas. Así el
catálogo se completa solo a medida que se suben facturas, sin trabajo manual aparte.

## Estado actual del código (verificado)

- El OCR de factura existe y funciona: `analizarFacturaVsAlbaran` en
  `src/features/logistica/actions/facturas-actions.ts` (~L407) usa Gemini + `OCR_RESPONSE_SCHEMA`
  (~L369-405). Cada línea OCR trae `{ nombre, cantidad, unidad, formato, precioUnitario, ivaPorcentaje, importeLinea }`.
- El emparejado está en `src/features/logistica/lib/facturas/comparar-lineas.ts`:
  `compararLineas()` empareja por `similitudNombre` (umbral 0.7). **Líneas sin match → tipo
  `"extra"` con `productoId: null`** (L156-174). Ese es exactamente el estado "no reconocido".
- La UI `src/features/logistica/components/facturas/FacturaComparativa.tsx` pinta la línea
  extra en naranja pero **NO tiene selector de producto ni botón de crear**. `FacturaDialog.tsx`
  orquesta (`handleResolver` → `resolverDiscrepancia`, L127-150).
- `validarFactura` (facturas-actions ~L576) **bloquea** si hay discrepancias sin resolver →
  hoy las líneas extra impiden confirmar.
- Regla de diseño del proyecto: `createAlbaran` (albaranes-actions L142-159) **rechaza**
  cualquier línea sin `productoId`. El asistente debe respetar esa filosofía.

## Piezas REUTILIZABLES (no reinventar)

- **Patrón de selector**: `src/features/cocina/components/import-fichas/CorregirMatchDialog.tsx`
  (shadcn `Command` DENTRO de `Dialog` — cumple la regla de UI del proyecto). Clonar cambiando
  `Candidato` por producto de compra. Fuente de datos: `listProductos("compra")`.
- **Alta de producto**: `createProducto` (`producto-actions.ts` ~L247) con `tipo:"compra"`.
  ⚠️ Inserta el primer precio SIN `proveedor` ni `formato` (L310-331). Para el asistente,
  completar con `addPrecioCompra`.
- **Precio en histórico**: `addPrecioCompra` (`precios-compra-actions.ts` L148-225) — sí guarda
  `proveedor` (obligatorio), `formato`, `iva`, `fechaInicio`, y hace `recomputeFechaFin` +
  `syncPrecioVigente`. Es la vía correcta para grabar el precio de la línea OCR.
- **Sugerencia del mejor candidato**: `normalizarNombre` / `similitudNombre` (comparar-lineas.ts
  L26-61) para pre-ordenar productos al abrir el asistente.

## Fases

**Fase 1 — Backend: acciones de resolución.**
- Nueva action `vincularLineaProducto(facturaId, lineaId, productoId)` en `facturas-actions.ts`
  (o extender `resolverDiscrepancia`, L508-572, que HOY no toca `productoId`): asigna el
  `productoId` a la línea extra, la reclasifica a resuelta y recalcula totales (`calcularTotales`).
- Nueva action `crearProductoDesdeLinea(facturaId, lineaId, datos)`: llama `createProducto`
  (tipo compra, sin precio) + `addPrecioCompra` (precio/iva/formato de la línea OCR, proveedor =
  `factura.proveedorNombre`, fechaInicio = fecha de la factura) y luego vincula el `productoId`
  resultante a la línea. Todo en una transacción lógica.
- Acción "ignorar": reutilizar `resolverDiscrepancia` marcando resolución que desbloquee
  `validarFactura`.

**Fase 2 — UI: asistente por línea.**
- En `FacturaComparativa.tsx` (`FilaComparativa`, para `tipo === "extra"` y opcionalmente
  `"nombre"`): añadir columna/botón "Resolver producto" que abra el asistente.
- Nuevo componente `ResolverLineaDialog.tsx` (clon de `CorregirMatchDialog`) con 3 pestañas/modos:
  **Vincular** (Command con productos de compra, pre-ordenados por similitud), **Crear nuevo**
  (form: nombre prellenado del OCR, IVA prellenado, proveedor = de la factura, formato), **Ignorar**.
- `FacturaDialog.tsx`: orquestar estado del dialog y refrescar la comparativa tras resolver.

**Fase 3 — Guardas y cierre.**
- `validarFactura`: mantener el bloqueo, pero ahora resoluble desde el asistente. Mensaje claro
  "N líneas sin producto — resuélvelas para validar".
- QA: subir una factura con 1 línea nueva → crear producto → verificar que aparece en catálogo,
  con precio en `producto_precios_compra` (proveedor/formato correctos) y `productos.precio_compra`
  sincronizado.

## Archivos a tocar (resumen)

1. `src/features/logistica/actions/facturas-actions.ts` — acciones nuevas de resolución.
2. `src/features/logistica/components/facturas/FacturaComparativa.tsx` — botón/columna resolver.
3. `src/features/logistica/components/facturas/FacturaDialog.tsx` — orquestación.
4. Nuevo `src/features/logistica/components/facturas/ResolverLineaDialog.tsx`.
5. Sin cambios de esquema BD: `createProducto` + `addPrecioCompra` ya cubren el alta.

## Notas de negocio (contexto Iván)

- No inventar precios: si un dato no se lee en el OCR, preguntar/dejar vacío (regla del proyecto
  "0 € calculado ≠ sin dato").
- Producto de compra: el IVA vive en `producto_precios_compra`, NO en `productos.iva`.
- Esto es de PRECIOS/COMPRAS. Los escandallos/recetas van por separado (Iván fue explícito:
  "una cosa es el listado de productos de compra y otra los escandallos").
