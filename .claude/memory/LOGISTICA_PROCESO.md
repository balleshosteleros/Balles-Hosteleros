---
name: Flujo Lógico del Módulo de Logística
description: Mapa del flujo de negocio completo, dead ends identificados y plan de ruta crítica
type: project
---

# FLUJO LÓGICO — MÓDULO DE LOGÍSTICA

> Última actualización: 2026-04-14 (post-correcciones de persistencia)

---

## REGLAS DE NEGOCIO CONFIRMADAS

- **Confirmar albarán** → SUMA automáticamente las cantidades del albarán a `stock.cantidad_actual`
- **Confirmar inventario** → AJUSTA `stock.cantidad_actual` al conteo físico real (sobreescribe)
- Ambas operaciones son la única fuente de verdad del stock

---

## ESTADO ACTUAL POR VISTA

| Vista | Carga | Crear | Editar | Eliminar | Estado |
|-------|-------|-------|--------|---------|--------|
| Proveedores | ✅ | ✅ | ✅ | ✅ | Completo |
| Productos | ✅ | ✅ | ✅ | ✅ | Completo |
| Pedidos | ✅ | ✅ | ✅ | ✅ | Completo |
| Albaranes | ✅ BD | ✅ BD | ✅ BD | — | Completo |
| Stock edición individual | ✅ | — | ✅ BD | — | Completo |
| Stock edición masiva | ✅ | — | ✅ BD | — | Completo |
| Inventarios | ✅ | ✅ | ✅ | — | Completo |
| Stock Temporadas | ❌ Mock | ❌ | ❌ | ❌ | Roto |

---

## FLUJO 1: CICLO DE COMPRA COMPLETO

```
[1] ALTA PROVEEDOR
    ProveedoresView → ProveedorModal → createProveedor() → BD ✅

[2] ALTA PRODUCTO (tipo='compra')
    ProductosView → ProductoModal → createProducto() → BD ✅

[3] CREAR PEDIDO
    PedidosView → PedidoModal → createPedido() → BD ✅
    (Líneas guardadas en tabla lineas_pedido)

[4] ENVIAR A PROVEEDOR
    PedidosView → handleEnviarProveedor() → estado "Enviado" ✅
    (Solo marca estado — sin email real integrado)

[5] CONFIRMAR PEDIDO → GENERA ALBARÁN
    PedidosView → handleConfirmarPedido() → createAlbaran() → BD ✅
    (Albarán persiste en tabla albaranes con líneas en JSONB)

[6] CONFIRMAR ALBARÁN → SUMA AL STOCK ← ❌ DEAD END ACTIVO
    REGLA: Al confirmar albarán → sumar cantidades a stock.cantidad_actual
    ACTUAL: Solo actualiza estado en BD, NO actualiza stock
    PENDIENTE: Implementar updateStockBatch() tras confirmar albarán

[7] AJUSTE DE STOCK VÍA INVENTARIO
    InventariosView → Conteo físico → Confirmar
    → updateInventarioEstadoAction() → actualiza stock.cantidad_actual ✅
    (REGLA: sobreescribe con el conteo real)
```

---

## FLUJO 2: SINCRONIZACIÓN ÁGORA

```
[1] SYNC MANUAL
    Dashboard → AgoraSyncStatus → syncVentasAgoraAction() ✅

[2] FETCH + VALIDAR DATOS ÁGORA
    agora-sync.ts → fetchConTimeout(10s) ✅
    Si timeout → pide aprobación manual ✅

[3] UPSERT PRODUCTOS VENTA
    upsertProductosAgora() → tabla productos ✅

[4] CALCULAR NECESIDAD DE COMPRA ← ❌ DEAD END
    Función SQL calcular_necesidad_compra(empresa_id) EXISTE en BD
    PERO nadie la llama después del sync

[5] GENERAR SUGERENCIA DE PEDIDO ← ❌ NO EXISTE
```

---

## FLUJO 3: STOCK

```
[1] VER STOCK (cantidad_actual + minima + maxima)
    StockView → listStock() → BD ✅

[2] EDICIÓN INDIVIDUAL por fila
    saveEdit() → updateStock() → guarda minima + maxima en BD ✅

[3] EDICIÓN MASIVA
    applyMassEdit() → updateStockBatch() → BD ✅

[4] TEMPORADAS DE STOCK ← ❌ DEAD END
    getTemporadasPorEmpresa() devuelve mock hardcodeado
    Tabla stock_temporada EXISTE en BD pero nunca se usa
    TemporadasConfig solo guarda en estado React local
```

---

## FLUJO 4: ESCANDALLOS (Food Cost)

```
[1] ASIGNAR INGREDIENTES A PRODUCTO VENTA
    ProductosView → Composicion → addEscandallo() → BD ✅

[2] VER COSTE FOOD COST ← ❌ DEAD END
    Función SQL coste_escandallo(id) EXISTE en BD
    PERO no se llama ni se muestra en ninguna pantalla
```

---

## DEAD ENDS PENDIENTES (priorizado)

| # | Área | Severidad | Descripción | Acción necesaria |
|---|------|-----------|-------------|-----------------|
| D1 | Albarán → Stock | 🔴 Crítico | Confirmar albarán no suma a stock | `handleConfirmarAlbaran` → `updateStockBatch()` con líneas del albarán |
| D2 | Temporadas | 🟡 Alto | `stock_temporada` table existe, datos son mock | Actions CRUD + cargar desde BD |
| D3 | Ágora → Reorden | 🟡 Alto | `calcular_necesidad_compra()` SQL huérfana | Llamar post-sync + mostrar sugerencias |
| D4 | Food Cost | 🟢 Medio | `coste_escandallo()` SQL existe, no visible | Mostrar en ProductoDetalle |

---

## RUTA CRÍTICA SIGUIENTE

### FASE A — Albarán actualiza stock (D1) ← PRIORITARIO
1. En `PedidosView.handleConfirmarAlbaran`:
   - Leer líneas del albarán confirmado
   - Para cada línea: buscar stock por nombre de producto
   - Llamar `updateStockBatch()` sumando cantidad recibida a `cantidad_actual`
2. Si el producto no tiene fila en stock → crearla con la cantidad recibida

### FASE B — Temporadas reales (D2)
1. Crear `src/features/logistica/actions/temporadas-actions.ts`
   con `listTemporadas`, `createTemporada`, `updateTemporada`, `deleteTemporada`
2. Actualizar `StockView`: cargar desde BD con `listTemporadas()`
3. Actualizar `TemporadasConfig`: llamar actions al guardar/eliminar

### FASE C — Inteligencia de compra (D3)
1. Post-sync Ágora → llamar `calcular_necesidad_compra(empresa_id)` vía RPC
2. Mostrar sugerencias en dashboard logística
3. Botón "Crear pedido desde sugerencia"

### FASE D — Food Cost visible (D4)
1. En `ProductoDetalle` → llamar `coste_escandallo(id)` vía RPC
2. Mostrar coste calculado + precio venta + margen %
