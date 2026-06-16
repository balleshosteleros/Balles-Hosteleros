# PRP-057: Unir ventas y stock — escandallo 100%, descuento automático y kardex con trazabilidad a factura de Ágora

> **Estado**: PROPUESTO (2026-06-16) · Pendiente de aprobación del dueño.
> **Proyecto**: Balles-Hosteleros
> **Depende de**: PRP-056 (ventas Ágora ya en `pos_tickets`/`pos_ticket_lineas`).

---

## Objetivo

Cerrar el círculo **venta → receta → producto de compra → stock**: que cada venta consuma stock de forma automática y trazable. Tres pilares:

1. **Cobertura total de escandallos**: TODO producto de venta tiene escandallo, aunque sea **1:1** (vender 1 Coca-Cola consume 1 Coca-Cola de compra). Sin excepciones.
2. **Descuento automático de stock** desde las ventas de Ágora (a partir de una fecha de corte, NO sobre el histórico de 12 meses) y desde el POS propio.
3. **Kardex (libro de movimientos de stock)**: cada movimiento registra producto, cantidad con signo (`-1 Coca-Cola`), tipo (venta/compra/merma/ajuste/inventario), y **de qué factura de Ágora / ticket viene** (`AG-{serie}-{número}`). Cada `-1` es rastreable hasta su factura.

## Por Qué

| Problema (auditoría 2026-06-16) | Solución |
|---|---|
| La venta de Ágora NO descuenta stock: el cron solo marca `stock_descontado=true` sin tocar el stock (los 18.304 tickets están "marcados" pero el stock nunca se movió). | Enchufar el motor `descontarStockPorVentas` al cron, desde fecha de corte. |
| 120 de 286 productos vendidos (42%) NO tienen escandallo → de esos no se puede descontar nada. | Auto-generar escandallos 1:1 donde exista el producto de compra equivalente; completar a mano el resto. Cobertura objetivo = 100%. |
| El stock es un número que se sobrescribe: no hay rastro de por qué bajó/subió. Imposible auditar o cuadrar inventario. | Tabla `stock_movimientos` (kardex) con origen y referencia a la factura. |
| Las compras (albaranes) no SUMAN stock (`sumarStockDesdeAlbaran` está huérfana). Si solo se resta, el stock llega a 0 y se queda. | Enchufar la entrada por albarán al recibir + registrar el movimiento `+N` en el kardex. |
| Tres modelos de receta conviven (`producto_composicion` 203 filas = el bueno; `escandallos` 8 vacío; "nuevas recetas" en localStorage). El coste lee la tabla vieja vacía. | Declarar `producto_composicion` fuente única; reconectar coste y la pantalla de Escandallos. |

**Valor de negocio**: el restaurante ve el stock real bajar con cada servicio, sabe qué factura consumió qué, detecta mermas/diferencias contra inventario, y obtiene el coste real por plato.

## Qué

### Criterios de Éxito
- [ ] **100% de los productos de venta tienen escandallo** (≥1 ingrediente). Los 1:1 (bebida = su propia compra) generados automáticamente; los compuestos, completados a mano con apoyo de listados.
- [ ] `producto_composicion` es la **única** fuente de receta. El cálculo de coste y la pantalla de Escandallos leen de ahí (no de `escandallos`/localStorage).
- [ ] Vender por Ágora (cron diario, **desde la fecha de corte**) descuenta stock: por cada línea, por cada ingrediente, `stock.cantidad_actual -= cantidad_vendida × cantidad_receta × (1+merma)`.
- [ ] El **histórico de 12 meses NO descuenta stock** (quedaría negativo absurdo). El stock actual es la foto de partida; los tickets históricos se marcan como "no aplicables a stock".
- [ ] Cada descuento crea una fila en `stock_movimientos` con: `producto_id`, `cantidad` (con signo), `tipo='venta'`, `origen_tipo='pos_ticket'`, `origen_id=ticket.id`, `referencia='AG-{serie}-{num}'`, `producto_venta_id` (qué se vendió), `cantidad_antes`/`cantidad_despues`, `fecha`.
- [ ] Desde un producto del kardex se puede ver **qué factura de Ágora provocó cada `-1`** y, al revés, desde una factura ver qué movimientos generó.
- [ ] Anular/reprocesar un ticket revierte sus movimientos (signo opuesto) sin doble conteo (guardia `stock_descontado` + idempotencia en el kardex por `(origen_id, producto_id, tipo)`).
- [ ] Recibir un albarán SUMA stock y registra movimiento `tipo='compra'` con referencia al albarán.
- [ ] Pantalla de stock muestra cantidad actual, mínimo/alerta y acceso al kardex por producto.

### Comportamiento Esperado

**Ejemplo Coca-Cola (1:1):**
1. Ágora factura `AG-A-1043` con 1 línea: "Coca-Cola ×1" (producto de venta).
2. El cron ingiere el ticket (ya hoy) y, **si la fecha ≥ corte**, llama al descuento.
3. Escandallo 1:1: Coca-Cola venta → 1× Coca-Cola compra.
4. Stock Coca-Cola compra: 48 → **47**.
5. Kardex: `{producto: Coca-Cola compra, cantidad: -1, tipo: venta, referencia: 'AG-A-1043', producto_venta: Coca-Cola, antes:48, despues:47}`.

**Plato compuesto:** "Arroz con bogavante" → escandallo (arroz 90g, bogavante 1ud, …) → cada ingrediente genera su `-cantidad` en el kardex con la misma referencia de factura.

**Fecha de corte:** valor de configuración (p.ej. `empresas.stock_descuento_desde`). Tickets con `business-day` anterior NO descuentan. Por defecto = fecha de activación.

---

## Fases (BLUEPRINT — subtareas se generan al entrar en cada fase)

### Fase 1 — Fuente única de receta + coste reconectado
Declarar `producto_composicion` como única fuente. Reapuntar el cálculo de coste (hoy `coste_escandallo()` lee la tabla `escandallos` vacía) y la pantalla de Escandallos a `producto_composicion`. Aparcar/migrar el modelo viejo y las "nuevas recetas" de localStorage (decidir al mapear contexto: migrar datos o solo desconectar). No romper UI existente de cocina.

### Fase 2 — Kardex (libro de movimientos) + motor de descuento con trazabilidad
Crear `stock_movimientos` (esquema en Notas). Modificar `descontarStockPorVentas` para que, además de actualizar `stock.cantidad_actual`, escriba **una fila de movimiento por ingrediente y por línea** con la referencia a la factura/ticket (`AG-{serie}-{num}`) y el `producto_venta_id` que lo causó. Idempotencia: no duplicar movimientos al reprocesar; revertir al anular.

### Fase 3 — Enchufar el descuento al cron de Ágora (desde fecha de corte)
Añadir `empresas.stock_descuento_desde`. En `/api/cron/agora-sync` y en la ingesta TS: tras ingerir el día, si `business-day ≥ corte`, llamar al descuento. Marcar correctamente `stock_descontado`. Los 18.304 históricos: marcar como fuera de alcance de stock (no descontar). Definir y sellar la foto de partida del stock.

### Fase 4 — Cobertura 100% de escandallos
Auto-generar escandallos **1:1** para productos de venta que tengan un producto de compra equivalente (mismo `agora_id` de origen / mismo nombre / pareja "ambos"). Para los compuestos sin receta: generar un **listado de trabajo** (productos vendidos sin escandallo, priorizados por unidades vendidas) y completarlos con el dueño. Meta: 0 productos de venta sin escandallo. Crear filas de `stock` faltantes para los 4 ingredientes sin ficha.

### Fase 5 — Entrada de stock por compras (albaranes) + mermas
Enchufar `sumarStockDesdeAlbaran` al pasar un albarán a "Recibido" (registrando movimiento `tipo='compra'`). Revisar mermas: su tabla no existe en la BD real pese a la migración 028 → crear/aplicar y que la merma descuente stock con su movimiento `tipo='merma'`.

### Fase 6 — UI de stock + kardex y validación final
Pantalla de stock con cantidad actual, alerta de mínimo y acceso al **kardex por producto** (con la factura origen de cada movimiento). Validación E2E: vender un día de prueba → ver `-N` en stock y en kardex con su factura; anular → revertir. `npm run build` limpio.

---

## Notas técnicas

**Tabla `stock_movimientos` (kardex) — propuesta:**
```
id              uuid pk
empresa_id      uuid
producto_id     uuid        -- el producto de COMPRA afectado (ingrediente)
producto_nombre text
cantidad        numeric     -- con signo: negativo = salida, positivo = entrada
unidad          text
tipo            text        -- 'venta' | 'compra' | 'merma' | 'ajuste' | 'inventario' | 'produccion'
cantidad_antes  numeric
cantidad_despues numeric
origen_tipo     text        -- 'pos_ticket' | 'albaran' | 'merma' | 'manual' | 'inventario'
origen_id       uuid        -- id del ticket / albarán / etc.
referencia      text        -- legible: 'AG-{serie}-{num}' o nº de albarán
producto_venta_id uuid null -- qué producto de venta lo provocó (para la trazabilidad de la venta)
pos_ticket_linea_id uuid null
usuario_id      uuid null
fecha           timestamptz -- business-day del ticket (no el momento de proceso)
created_at      timestamptz default now()
```
Índices: `(empresa_id, producto_id, fecha)`, `(origen_tipo, origen_id)`. Único anti-duplicado: `(origen_tipo, origen_id, producto_id, tipo)`. RLS por `empresas_del_usuario()`.

**Decisiones cerradas (del dueño):**
- Todo producto de venta DEBE tener escandallo, aunque sea 1:1.
- El kardex registra cada `-1` con la factura de Ágora que lo causó.
- El histórico de 12 meses NO descuenta stock; el descuento arranca desde la fecha de corte.

**Restricciones de proyecto:** stock lo gobierna Balles (Ágora solo aporta ventas) — ver memoria `project_agora_modelo_stock_balles`. No reescribir `getVentasDashboard`. `producto_composicion` ya es el modelo activo. Multi-tenant: BACANAL / HABANA.

## Aprendizajes
_(se rellena durante la implementación — auto-blindaje del bucle agéntico)_
