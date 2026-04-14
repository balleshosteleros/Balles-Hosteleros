# PRP-ARCH-001 — Logística (versión limpia)

> Tipo: Arquitectura Feature-First
> Feature: `src/features/logistica/`
> Estado actual: ✅ CRUD completo + Ágora activo. Dead ends D1–D4 pendientes.
> Objetivo: Definir la versión "limpia" de target para refactor/completar.

---

## Problema actual

- `handleConfirmarAlbaran` en PedidosView no llama `sumarStockDesdeAlbaran()` (D1 crítico)
- Temporadas de stock leen mock hardcodeado en lugar de BD (D2)
- `calcular_necesidad_compra()` SQL huérfana — nadie la llama (D3)
- `coste_escandallo()` SQL existe pero no se muestra en UI (D4)
- `stock` usaba `producto_nombre` texto como clave (D5 — resuelto parcialmente con migración UUID)

---

## Estructura target (Feature-First limpia)

```
src/features/logistica/
├── actions/
│   ├── agora-actions.ts          — sync Ágora, descuento stock por ventas
│   ├── albaranes-actions.ts      — CRUD albaranes + confirmar → actualiza stock
│   ├── escandallos-actions.ts    — CRUD escandallos
│   ├── inventarios-actions.ts    — CRUD inventarios + confirmar → sobreescribe stock
│   ├── pedidos-actions.ts        — CRUD pedidos + sugerencias desde calcular_necesidad_compra
│   ├── producto-actions.ts       — CRUD productos (compra + venta) + food cost
│   ├── proveedores-actions.ts    — CRUD proveedores
│   ├── stock-actions.ts          — listStock, updateStock, sumarStockDesdeAlbaran, updateStockBatch
│   └── temporadas-actions.ts     — CRUD stock_temporada desde BD (no mock)
│
├── components/
│   ├── LogisticaDashboard.tsx    — resumen: alertas stock, sugerencias pedido, sync Ágora
│   ├── PedidosView.tsx           — tabla pedidos + botón confirmar albarán (con D1 resuelto)
│   ├── ProductosView.tsx         — tabla productos + columna Coste € (D4 resuelto)
│   ├── ProveedoresView.tsx       — CRUD proveedores
│   ├── StockView.tsx             — tabla stock + temporadas desde BD (D2 resuelto)
│   ├── inventarios/
│   │   └── InventariosView.tsx
│   ├── pedidos/
│   │   ├── DetallePedido.tsx
│   │   └── PedidoModal.tsx       — Combobox Popover, IVA desde ficha, proveedor obligatorio
│   ├── productos/
│   │   └── ProductoDetalle.tsx   — escandallo + coste_escandallo() visible (D4)
│   └── stock/
│       └── TemporadasConfig.tsx  — guarda/carga desde BD (no React state local)
│
├── hooks/
│   └── useLogisticaDashboard.ts  — agrega datos de stock bajo mínimos + sugerencias
│
├── services/
│   ├── agora-ventas-sync.ts      — descontarStockPorVentasAgora()
│   └── ingest-from-pdfs/         — parsers Excel/PDF para importación masiva
│
├── types/
│   └── index.ts                  — Pedido, Albaran, Producto, Stock, Escandallo, Temporada
│
└── data/
    └── (solo constantes estáticas — sin mocks de BD)
```

---

## Reglas de negocio a preservar

1. Stock tiene dos fuentes: albarán confirmado (SUMA) e inventario confirmado (SOBREESCRIBE).
2. IVA viene de la ficha del producto — no editable en modal de pedido.
3. Proveedor es obligatorio en todo pedido.
4. Búsqueda de producto por Combobox (lista cerrada), nunca input libre.
5. `notas` en líneas de pedido es NOT NULL (string vacío si vacío).
6. `stock.producto_id` (UUID) es la clave — nunca buscar por nombre de texto.
7. Ágora: ante error → detener y mostrar error exacto, pedir aprobación.
8. El escandallo es la composición interna del producto de venta, no lista separada.

---

## Deuda técnica a liquidar en versión limpia

| ID | Acción |
|----|--------|
| D1 | `PedidosView.handleConfirmarAlbaran` → llamar `sumarStockDesdeAlbaran()` |
| D2 | `StockView` + `TemporadasConfig` → conectar tabla `stock_temporada` en BD |
| D3 | Post-sync Ágora → llamar `calcular_necesidad_compra()` → pestaña Sugerencias en PedidosView |
| D4 | `ProductosView` → columna Coste con `coste_escandallo()` RPC |

---

## APIs externas dependientes

- Ágora POS: `http://habanabacanaliictpv.ddns.me:8984` / `api-token: 09654955`
- Supabase RPC: `coste_escandallo()`, `calcular_necesidad_compra()`
- Supabase Edge Function: `analizar-albaran` (OCR de albaranes PDF)

---

## Tests mínimos requeridos

- [ ] Confirmar albarán → stock se incrementa correctamente
- [ ] Confirmar inventario → stock sobreescribe con conteo
- [ ] Sync Ágora → stock se descuenta por ventas del día
- [ ] Crear pedido con producto sin proveedor → error de validación
- [ ] Escandallo calcula coste correcto con merma
