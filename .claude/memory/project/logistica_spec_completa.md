---
name: Especificación Completa — Módulo Logística
description: Plan arquitectónico aprobado con 6 fases para completar el módulo de logística. PENDIENTE: confirmación de Ágora partner para arrancar Fase 4.
type: project
---

# ESPECIFICACIÓN COMPLETA — MÓDULO LOGÍSTICA
> Generada: 2026-04-14 | Estado: APROBADA — pendiente arranque ejecución

---

## REGLA DE ORO
**No escribir código hasta que el usuario confirme que el partner de Ágora activó el módulo HTTP API.**
Las Fases 1, 2, 3 y 6 pueden ejecutarse YA. La Fase 4 requiere Ágora activo. La Fase 5 depende de la Fase 4.

---

## API DE ÁGORA — DATOS CONFIRMADOS

| Campo | Valor |
|-------|-------|
| URL base | `http://habanabacanaliictpv.ddns.me:8984` |
| Auth header | `api-token: 09654955` |
| Endpoint ventas | `GET /api/export/tickets?businessDay=YYYYMMDD` |
| Endpoint import | `POST /api/import` |
| Versión | 8.5.5 (Microsoft-HTTPAPI / Windows) |
| IP servidor | 88.2.231.217 (servidor físico del partner) |
| Estado actual | API conectada ✅ — módulo HTTP activado por partner (2026-04-14) ✅ |

### Cómo activar el módulo (lo hace el partner en su servidor Windows):
1. Abrir **Ágora Monitor** (icono systray del servidor Windows del partner)
2. **Herramientas → Activar Módulos Adicionales**
3. Activar **"Módulo de Servicios de Integración"**
4. Aparece nueva opción: **Herramientas → Configurar Servicios de Integración**
5. Marcar **"Activar integración mediante API HTTP"**
6. En campo "Código" poner: `09654955`
7. Aceptar → Reiniciar servicio Ágora

---

## DIAGNÓSTICO DE DEAD ENDS (confirmados en código)

| # | Área | Severidad | Problema exacto |
|---|------|-----------|-----------------|
| D1 | Albarán → Stock | 🔴 Crítico | `sumarStockDesdeAlbaran()` existe en `stock-actions.ts` pero `PedidosView.handleConfirmarAlbaran` NO la llama |
| D2 | Temporadas stock | 🟡 Alto | `StockView` carga de `data/stock.ts` hardcodeado; tabla `stock_temporada` en BD nunca usada |
| D3 | Sugerencias pedido | 🟡 Alto | SQL `calcular_necesidad_compra(empresa_id)` existe y es completa; nadie la llama |
| D4 | Food Cost | 🟢 Medio | SQL `coste_escandallo(id)` existe; no se muestra en ninguna pantalla |
| D5 | Stock por nombre | 🔴 Crítico | Tabla `stock` usa `producto_nombre` texto como clave — se rompe al renombrar producto |

---

## FASES DE EJECUCIÓN

### FASE 1 — Stock vinculado por UUID (CIMIENTO)
**Estado: Listo para ejecutar ✅**

- Migración `021_stock_producto_id.sql`:
  - Añadir `producto_id UUID FK → productos.id` a tabla `stock`
  - Backfill: `UPDATE stock s SET producto_id = p.id FROM productos p WHERE p.empresa_id = s.empresa_id AND LOWER(p.nombre) = LOWER(s.producto_nombre)`
  - Añadir índice en `producto_id`
- Actualizar `stock-actions.ts`:
  - `sumarStockDesdeAlbaran()`: usar `producto_id` en lookup (fallback a nombre)
  - `updateStock()`: sin cambios
  - `listStock()`: añadir join con productos para mostrar nombre actualizado

**Archivos:** `supabase/migrations/021_stock_producto_id.sql`, `src/features/logistica/actions/stock-actions.ts`

---

### FASE 2 — Albarán confirma → sube stock (BUG CRÍTICO D1)
**Estado: Listo para ejecutar ✅ (requiere Fase 1 primero)**

- En `PedidosView.tsx`, función `handleConfirmarAlbaran`:
  - Después de `serverUpdateAlbaranEstado(id, 'Confirmado')`
  - Llamar `sumarStockDesdeAlbaran(lineas.map(l => ({productoId: l.productoId, productoNombre: l.nombre, cantidad: l.cantidad, unidad: l.unidad})))`
  - Toast: "Stock actualizado: +X unidades en N productos"
  - Si falla → Regla Seguridad Ágora: mostrar error exacto, no swallow
- Verificar que `PedidoModal` guarda `productoId` en cada línea del albarán JSONB

**Archivos:** `src/features/logistica/components/PedidosView.tsx`, `src/features/logistica/components/pedidos/PedidoModal.tsx`

---

### FASE 3 — Temporadas de stock reales (D2)
**Estado: Listo para ejecutar ✅ (independiente)**

- Crear `src/features/logistica/actions/temporadas-actions.ts`:
  ```
  listTemporadas() → SELECT FROM stock_temporada WHERE empresa_id
  createTemporada(input) → INSERT
  updateTemporada(id, input) → UPDATE
  deleteTemporada(id) → DELETE
  listReglasTemporada(temporadaId) → SELECT FROM stock_temporada_reglas
  upsertReglaTemporada(input) → UPSERT
  ```
- Actualizar `StockView.tsx`:
  - Reemplazar `getTemporadasPorEmpresa()` (mock) por `await listTemporadas()`
  - useEffect para cargar al montar
- Actualizar `TemporadasConfig.tsx`:
  - On guardar → `createTemporada()` o `updateTemporada()`
  - On eliminar → `deleteTemporada()`
  - Cargar reglas desde BD

**Archivos:** nuevo `temporadas-actions.ts`, `StockView.tsx`, `stock/TemporadasConfig.tsx`

---

### FASE 4 — Ágora → descuenta stock por ventas (NUEVA FEATURE)
**Estado: ✅ IMPLEMENTADA (2026-04-14)**

**Lógica de negocio:**
```
Ágora vende "Risotto de setas" × 3
  → buscar producto por agora_id en tabla productos
  → tiene escandallo: 0.30kg arroz + 0.15kg setas + 0.05L nata
  → consumo = 3 × cantidad × (1 + merma_pct/100)
  → restar de stock.cantidad_actual de cada ingrediente
  → Si sin escandallo y es tipo='compra' → restar directamente del stock
```

**Archivos nuevos/modificados:**
- `.env.local`: añadir `AGORA_API_URL=http://habanabacanaliictpv.ddns.me:8984` y `AGORA_API_TOKEN=09654955`
- Nuevo: `src/features/logistica/services/agora-ventas-sync.ts`
  - Función `descontarStockPorVentasAgora(businessDay, empresaId)`
  - Fetch tickets → parse líneas → match agora_id → escandallo → restar stock
- Modificar: `src/features/logistica/actions/agora-actions.ts`
  - Nueva action `syncVentasYDescontarStockAction(fecha?)`
- Nuevo: `src/app/api/cron/agora-sync/route.ts` (endpoint para Vercel Cron)
- Modificar: `vercel.ts` → añadir cron `0 8 * * *` → `/api/cron/agora-sync`

**Schedule:** Automático cada día a las 08:00 + botón manual en panel logística

---

### FASE 5 — Sugerencias de pedido automáticas (D3)
**Estado: ⏳ Espera Fase 4**

- Llamar `supabase.rpc('calcular_necesidad_compra', { p_empresa_id })` tras cada actualización de stock
- En `PedidosView.tsx`: nueva pestaña "Sugerencias"
  - Tabla: Producto | Stock actual | Stock objetivo | Necesidad | Proveedor preferido | Coste estimado
  - Botón "Generar pedido desde sugerencia" → rellena `PedidoModal` automáticamente

**Archivos:** `PedidosView.tsx`, `pedidos-actions.ts`

---

### FASE 6 — Food Cost visible en productos (D4)
**Estado: Listo para ejecutar ✅ (independiente)**

- `ProductosView.tsx`:
  - Columna "Coste €" para productos tipo='venta'
  - Llamar `supabase.rpc('coste_escandallo', { p_producto_venta_id: id })` en batch al cargar
  - Mostrar como "X.XX €"
- Modal/ficha de producto (tipo='venta'):
  - Sección Escandallo con tabla: Ingrediente | Cantidad | Unidad | Precio/u | Merma% | Subtotal
  - Fila resumen: Coste total | Precio venta | Margen %

**Archivos:** `ProductosView.tsx`, modal detalle producto

---

## ORDEN DE EJECUCIÓN

```
Fase 1 (migración UUID)     → PRIMERO, imprescindible
  ↓
Fase 2 (albarán→stock)      → depende de Fase 1
  ↓
Fase 3 (temporadas)         → puede ir en paralelo con Fase 1
Fase 6 (food cost)          → puede ir en paralelo con cualquier fase

  [Esperar confirmación partner Ágora]
  ↓
Fase 4 (Ágora ventas→stock) → depende de Fase 1 y partner
  ↓
Fase 5 (sugerencias pedido) → depende de Fases 2 y 4
```

---

## QUÉ NO SE TOCA
- Diseño visual → intacto
- Proveedores CRUD → intacto
- Pedidos CRUD (crear, enviar, editar, borrar) → intacto
- Inventarios CRUD → intacto
- Escandallos CRUD → intacto

---

## RECORDATORIO PROGRAMADO
Preguntar al usuario el 2026-04-17 si el partner de Ágora ha activado el módulo HTTP API.
