# PRP-058: Tipos de movimiento, submódulo Mermas y registro de inventarios en el kardex

> **Estado**: EN CURSO (web). **Fase 4 — Mermas en móvil: DIFERIDA** por decisión del dueño (2026-06-17): se va a rediseñar gran parte de la app móvil, así que el botón/pantalla de Mermas en móvil se hará en ese rediseño. Se construyen las fases web (1,2,3,5,6).
> **Fecha**: 2026-06-17
> **Proyecto**: Balles-Hosteleros
> **Construye sobre**: PRP-056 (ingesta ventas Ágora) y PRP-057 (kardex de stock + descuento por escandallo)
> **Decisión móvil pendiente**: dónde colocar Mermas en la barra/Inicio → se decide en el rediseño móvil.
> **Empresa piloto**: BACANAL

---

## Objetivo

Completar el kardex de stock con sus dos orígenes que faltan —**mermas** (descuento manual con motivo) e **inventarios** (ajuste a recuento físico)— y dejar visible en cada producto el **tipo de cada movimiento** (Compra / Venta / Inventario / Merma). Se añade un submódulo nuevo **Mermas** en Cocina (web) y en la app móvil, y se conecta la confirmación de un inventario al kardex de forma que SIEMPRE deje rastro (incluso cuando el recuento no cambie nada).

## Por Qué

| Problema | Solución |
|----------|----------|
| El kardex solo entiende compras (albarán) y ventas (Ágora); las mermas y los recuentos físicos no dejan rastro ni ajustan stock | Dos orígenes nuevos de movimiento (`merma`, `inventario`) que pasan por `registrarMovimiento` (mismo motor, mismo candado `controla_stock`) |
| La tarjeta de movimientos del producto no etiqueta de forma legible de qué viene cada línea | Columna "Tipo de movimiento" con 4 etiquetas claras (Compra / Venta / Inventario / Merma) |
| No hay forma sencilla (ni en cocina ni en el móvil) de descontar una merma con su motivo | Submódulo "Mermas" con modal de alta guiado (tipo → producto → unidad informativa → cantidad → motivo obligatorio) |
| Un inventario que "no cambia nada" hoy no se registra → no hay prueba de que se contó ese producto | Inventario confirmado genera un movimiento por producto contado, incluso con cantidad 0 ("el inventario no movió nada") |

**Valor de negocio**: trazabilidad total del stock (toda variación tiene origen identificable), control de pérdidas por merma con motivo auditable, y cuadre periódico fiable contra recuento físico. Menos descuadres "fantasma" y base sólida para coste de mercancía y rentabilidad.

## Qué

### Criterios de Éxito
- [ ] La tarjeta de movimientos de cada producto muestra una columna **Tipo de movimiento** con: Compra, Venta, Inventario, Merma (sentence case).
- [ ] `DOCUMENTO_TIPO_LABEL` y el `CHECK` de `stock_movimientos.documento_tipo` incluyen `inventario` y `merma` (migración con permiso).
- [ ] Existe submódulo **Mermas** en Cocina (web, ruta `/cocina/mermas`) y en la app móvil (entrada en `/m/*`), ambos con el modal de alta.
- [ ] El modal de merma: elige tipo (compra/elaboración) → producto (solo de ese tipo) → muestra la unidad del producto (no editable) → cantidad → motivo (obligatorio, bloquea guardar si vacío).
- [ ] Al guardar una merma se crea un movimiento de **salida** `documento_tipo='merma'` vía `registrarMovimiento` (descuenta stock, respeta `controla_stock`, guarda el motivo).
- [ ] Confirmar un inventario genera **un movimiento `inventario` por cada línea con producto identificado**, ajustando el saldo a la cantidad contada; si la diferencia es 0 se registra igual un movimiento con cantidad 0.
- [ ] Reconfirmar/reprocesar un inventario no duplica movimientos (guardia anti-doble).
- [ ] La RLS de las tablas nuevas usa `empresas_del_usuario()`; el submódulo Mermas respeta `puedeVer("COCINA")`.
- [ ] No se rompe nada de PRP-056/057 (compras, ventas, descuento por escandallo siguen igual).
- [ ] `npm run typecheck` y `npm run build` pasan.

### Comportamiento Esperado

**Merma (web y móvil)** — happy path:
1. El usuario pulsa "Nueva merma".
2. Elige el **tipo de producto**: Compra o Elaboración (únicos que guardan stock; Venta queda fuera).
3. Elige el **producto** (lista filtrada por ese tipo).
4. La **unidad de medida** del producto aparece como dato informativo (no editable).
5. Introduce la **cantidad** a descontar (> 0).
6. Escribe el **motivo** (obligatorio; sin él no se puede guardar — patrón "datos completos obligatorio").
7. Al guardar: se registra una salida `merma` en el kardex (descuento de stock vía `registrarMovimiento`, con `motivo` y `referencia` tipo "Merma"). La fila aparece en la tarjeta de movimientos del producto con tipo "Merma".

**Inventario → kardex** — happy path:
1. Se confirma un inventario (cambio de `estado` a confirmado).
2. Por cada línea con producto identificable: se calcula el saldo actual del producto y se genera un movimiento `inventario` que lleva el saldo a `cantidad_real`.
   - Si `cantidad_real == saldo actual` → movimiento con cantidad 0 y motivo "El inventario no movió nada".
   - Si difiere → entrada o salida por la diferencia (signo según corresponda) para cuadrar el saldo al recuento.
3. Reconfirmar el mismo inventario no vuelve a aplicar (guardia por `documento_tipo='inventario'` + `documento_id=inventario.id`, idempotente por `origen_linea_id`).

---

## Contexto

### Estado verificado en BD (live, 2026-06-17)
- `stock_movimientos.documento_tipo` es `text` con `CHECK IN ('albaran','pos_ticket','ajuste')` → **ampliar** a `inventario` y `merma`. Ya existe `CHECK (cantidad >= 0)`, así que cantidad **0 es válida** (clave para el inventario que no mueve nada).
- **No existe ninguna tabla `mermas`** en la BD (la migración 028 nunca se aplicó). Slate limpio: no hay trigger antiguo de descuento que pueda colisionar con el kardex. Crear la tabla nueva sin temor a conflicto.
- `inventarios` (0 filas): `id, empresa_id (TEXT!), nombre, fecha, estado (default 'Borrador', sin CHECK), tipo, notas, created_by, created_at`.
- `lineas_inventario` (0 filas): `id, inventario_id, producto_nombre, cantidad_teorica, cantidad_real, diferencia, unidad, orden`. **No tiene `producto_id`** → para postear al kardex (que se indexa por `producto_id`) hay que añadir `producto_id` a las líneas (o resolver por nombre). Decisión del PRP: **añadir `lineas_inventario.producto_id`** (cambio de schema).
- `productos.controla_stock` (boolean, default true) **existe** → el motor ya lo respeta.
- Tipos de producto: enum `producto_tipo` = `compra | venta | elaboracion`. Stock solo en `compra` y `elaboracion`.
- ⚠️ Disparidad de tipos: `inventarios.empresa_id` es `text` y `stock_movimientos.empresa_id` es `uuid`. Castear/normalizar al postear.

### Referencias (patrones a seguir, rutas absolutas)
- **Motor kardex (reusar, NO reescribir)**: `src/features/logistica/services/kardex.ts` → `registrarMovimiento` (idempotente por `origen_linea_id`, candado `controla_stock`), `revertirMovimientosPorDocumento`.
- **Tipos/labels del kardex (ampliar)**: `src/features/logistica/data/kardex.ts` → `DocumentoTipo`, `DOCUMENTO_TIPO_LABEL`.
- **Tarjeta de movimientos (añadir columna)**: `src/features/logistica/components/productos/MovimientosStockSection.tsx` (ya usa `DOCUMENTO_TIPO_LABEL`; hoy muestra Fecha, Tipo, Cantidad, Saldo, Referencia).
- **Migración base del kardex**: `supabase/migrations/20260616120000_stock_movimientos_kardex.sql`.
- **Acciones inventario existentes (vacías/mock)**: `src/features/logistica/actions/inventarios-actions.ts`, `src/features/logistica/data/inventarios.ts`.
- **Patrón submódulo cocina + toolbar**: `src/features/logistica/components/ProductosView.tsx` (BARRA HORIZONTAL 1: `SubmoduleToolbar` + `ResizableColumnsProvider` + `TableColumnHeader`). Referencia de view cocina: `src/features/cocina/components/`.
- **Ruta web**: `src/app/(main)/cocina/<submodulo>/page.tsx` (espejo de escandallos/partidas).
- **Nav web (registrar submódulo)**: `src/features/layout/data/nav-routes.tsx` → array `cocinaSubs`.
- **Visibilidad por rol**: `src/features/auth/contexts/auth-context.tsx` → `puedeVer("COCINA")`; filtrado en `src/features/layout/components/app-sidebar.tsx`.
- **Móvil — barra inferior**: `src/features/mi-panel/mobile/components/MobileBottomNav.tsx` (array `items`); página móvil: `src/app/(mobile)/m/<ruta>/page.tsx` con `MobilePageHeader`; vista móvil de referencia: `src/features/tareas/mobile/TareasMobile.tsx`.
- **Patrón server action**: `src/features/cocina/actions/temperaturas-actions.ts` y `src/features/logistica/actions/kardex-actions.ts` (`"use server"` + `getAppContext()`/`getLogisticaContext()` → `{ supabase, empresaId }` + try/catch + `{ ok, data?, error? }`).

### Arquitectura Propuesta (Feature-First)
```
src/features/cocina/
├── components/
│   └── mermas/
│       ├── MermasView.tsx          # submódulo web (toolbar minimalista + tabla histórico)
│       └── NuevaMermaModal.tsx     # modal de alta (compartible con móvil)
├── mobile/
│   └── MermasMobile.tsx            # pantalla móvil reutilizando el flujo del modal
├── actions/
│   └── mermas-actions.ts           # listMermas, createMerma (+ Zod) → registrarMovimiento('merma')
└── data/
    └── mermas.ts                   # tipos + constantes UI

src/app/(main)/cocina/mermas/page.tsx       # ruta web
src/app/(mobile)/m/mermas/page.tsx          # ruta móvil

src/features/logistica/
├── services/
│   └── inventario-a-kardex.ts      # aplicarInventarioAlKardex(inventarioId) → registrarMovimiento('inventario')
└── actions/
    └── inventarios-actions.ts      # ampliar: confirmarInventario() dispara aplicación al kardex
```

### Modelo de Datos

**1) Ampliar el CHECK de `stock_movimientos` (cambio de schema — pedir permiso):**
```sql
ALTER TABLE stock_movimientos DROP CONSTRAINT IF EXISTS stock_movimientos_documento_tipo_check;
ALTER TABLE stock_movimientos ADD CONSTRAINT stock_movimientos_documento_tipo_check
  CHECK (documento_tipo IN ('albaran','pos_ticket','ajuste','inventario','merma'));
```

**2) Tabla `mermas` (nueva — pedir permiso). Cabecera mínima; el descuento real lo hace el kardex, NO un trigger:**
```sql
CREATE TABLE IF NOT EXISTS mermas (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id  UUID NOT NULL,
  producto_id UUID NOT NULL REFERENCES productos(id) ON DELETE CASCADE,
  producto_tipo TEXT NOT NULL CHECK (producto_tipo IN ('compra','elaboracion')),
  cantidad    NUMERIC NOT NULL CHECK (cantidad > 0),
  unidad      TEXT,                         -- copia informativa de la unidad del producto
  motivo      TEXT NOT NULL,                -- obligatorio
  fecha       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by  UUID,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE mermas ENABLE ROW LEVEL SECURITY;
-- SELECT/INSERT con empresas_del_usuario(); el movimiento de stock se escribe vía service role.
```
> El movimiento de kardex de la merma usa `documento_tipo='merma'`, `documento_id = mermas.id`, `origen_linea_id = mermas.id` (idempotencia 1 merma = 1 movimiento), `referencia = 'Merma'`, `motivo = mermas.motivo`.

**3) `lineas_inventario.producto_id` (cambio de schema — pedir permiso):**
```sql
ALTER TABLE lineas_inventario ADD COLUMN IF NOT EXISTS producto_id UUID REFERENCES productos(id);
```
> Necesario para postear al kardex por `producto_id`. El movimiento de inventario usa `documento_tipo='inventario'`, `documento_id = inventarios.id`, `origen_linea_id = lineas_inventario.id` (idempotencia 1 línea = 1 movimiento), `referencia = 'Inventario'`.

> **Nota tipos**: normalizar `inventarios.empresa_id` (text) al uuid que espera el kardex al construir el input de `registrarMovimiento`.

### Lógica de ajuste de inventario (resumen)
Por cada línea con `producto_id`:
- `saldoActual = stock.cantidad_actual` (0 si no hay fila).
- `objetivo = cantidad_real`.
- `diff = objetivo - saldoActual`.
- Si `diff == 0` → `registrarMovimiento({ tipo:'entrada', cantidad:0, documentoTipo:'inventario', motivo:'El inventario no movió nada', origenLineaId: linea.id })` (deja rastro, no cambia saldo).
- Si `diff > 0` → entrada por `diff`. Si `diff < 0` → salida por `abs(diff)`.
- `registrarMovimiento` ya respeta `controla_stock` (omite si está apagado) y es idempotente por `origen_linea_id` (anti-doble al reconfirmar).

---

## Blueprint (Assembly Line)

> Solo FASES. Las subtareas se generan al entrar a cada fase (bucle agéntico).

### Fase 1: Schema y tipos del kardex (con permiso de BD)
**Objetivo**: Ampliar `documento_tipo` a `inventario`+`merma`, crear tabla `mermas` con RLS, añadir `lineas_inventario.producto_id`. Ampliar `DocumentoTipo`/`DOCUMENTO_TIPO_LABEL` en `data/kardex.ts` (etiquetas: Compra / Venta / Inventario / Merma, sentence case).
**Validación**: migración aplicada; `select` sobre `mermas` ok; `typecheck` pasa con los nuevos labels.

### Fase 2: Columna "Tipo de movimiento" en la tarjeta del producto
**Objetivo**: `MovimientosStockSection.tsx` muestra columna Tipo de movimiento mapeando `documento_tipo` con `DOCUMENTO_TIPO_LABEL` (ya cubre los 4 valores tras Fase 1).
**Validación**: en un producto con movimientos de varios orígenes, cada fila muestra su etiqueta correcta; columna integrada en el set redimensionable existente.

### Fase 3: Submódulo Mermas — backend + web
**Objetivo**: `data/mermas.ts`, `actions/mermas-actions.ts` (`createMerma` con Zod: producto_id, producto_tipo, cantidad>0, motivo no vacío → inserta en `mermas` + `registrarMovimiento('merma')`; `listMermas`), ruta `/cocina/mermas`, `MermasView` (toolbar minimalista + histórico) y `NuevaMermaModal` (flujo tipo→producto→unidad informativa→cantidad→motivo obligatorio). Registrar en `cocinaSubs` y gating `puedeVer("COCINA")`.
**Validación**: crear una merma desde web descuenta stock y deja fila tipo "Merma" en la tarjeta del producto; guardar bloqueado sin motivo.

### Fase 4: Mermas en la app móvil
**Objetivo**: ruta `/m/mermas` + `MermasMobile` reutilizando el flujo del modal; entrada accesible desde la navegación móvil (barra inferior o menú "Más" según encaje, sin saturar la barra de 4 items).
**Validación**: crear merma desde móvil produce el mismo movimiento de kardex que la web.

### Fase 5: Inventario → kardex
**Objetivo**: `services/inventario-a-kardex.ts` (`aplicarInventarioAlKardex`) + ampliar `inventarios-actions.ts` para disparar la aplicación al confirmar el inventario. Implementa la lógica de diff (incluido movimiento 0) y la guardia anti-doble. Normaliza `empresa_id` text→uuid.
**Validación**: confirmar un inventario de prueba genera un movimiento `inventario` por línea (incluida una con diff 0 etiquetada "El inventario no movió nada"); reconfirmar no duplica; saldos cuadran al recuento.

### Fase 6: Validación Final
**Objetivo**: Sistema end-to-end sin regresiones de PRP-056/057.
**Validación**:
- [ ] `npm run typecheck` pasa
- [ ] `npm run build` exitoso
- [ ] Playwright/screenshot: tarjeta de movimientos con 4 tipos, modal de merma (web+móvil), inventario confirmado refleja movimientos
- [ ] Compras/ventas/descuento por escandallo intactos
- [ ] Criterios de éxito cumplidos

---

## 🧠 Aprendizajes (Self-Annealing)

> Crece durante la implementación.

---

## Gotchas

- [ ] **No reintroducir descuento por trigger**: la tabla `mermas` NO debe descontar stock con trigger; el único motor de stock es `registrarMovimiento`. (La vieja migración 028 con trigger nunca se aplicó; no resucitarla.)
- [ ] **Idempotencia obligatoria**: merma → `origen_linea_id = mermas.id`; inventario → `origen_linea_id = lineas_inventario.id`. Sin esto, reprocesar duplica saldo.
- [ ] **Cantidad 0 permitida**: el `CHECK (cantidad >= 0)` lo admite; el movimiento de inventario "sin cambio" debe registrarse igualmente.
- [ ] **Disparidad `empresa_id`**: `inventarios.empresa_id` es TEXT, `stock_movimientos.empresa_id` es UUID → castear al postear.
- [ ] **`lineas_inventario` sin `producto_id`**: imprescindible añadirlo; sin producto identificado no se puede postear esa línea al kardex (decidir qué hacer con líneas legacy sin producto: omitir y avisar).
- [ ] **`controla_stock` apagado**: `registrarMovimiento` devuelve `omitido:true` y no escribe; la UI de merma debería avisar si el producto no controla stock.
- [ ] **Capitalización**: etiquetas sentence case (Compra, Venta, Inventario, Merma). Nada de uppercase salvo siglas reales.
- [ ] **Stock solo compra/elaboración**: el selector de producto en la merma excluye `venta`.
- [ ] **RLS multi-tenant**: `mermas` con `empresas_del_usuario()`; escritura de `stock_movimientos` sigue siendo service role (sin policy de INSERT para usuarios).
- [ ] **Barra móvil de 4 items**: no romper Inicio·Llamar·Tareas·Chat; Mermas probablemente entra por "Más"/Inicio, no como 5º item fijo.

## Anti-Patrones

- NO reescribir el motor del kardex; reusar `registrarMovimiento`.
- NO descontar stock con triggers de BD.
- NO duplicar `Record`s de tipos de documento fuera de `data/kardex.ts` (fuente única).
- NO permitir guardar merma sin motivo (datos completos obligatorio).
- NO ignorar errores de TypeScript ni omitir Zod en los inputs de usuario.
- NO tocar el flujo de compras/ventas existente de PRP-056/057.

---

*PRP pendiente aprobación. No se ha modificado código.*
