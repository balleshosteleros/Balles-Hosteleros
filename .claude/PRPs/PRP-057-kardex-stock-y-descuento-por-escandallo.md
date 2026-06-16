# PRP-057: Kardex de stock + descuento por escandallo desde ventas de Ágora + saneamiento de catálogo

> **Estado**: PENDIENTE (plan aprobado; coordinar con sesión paralela antes de tocar archivos de Ágora)
> **Fecha**: 2026-06-16
> **Proyecto**: Balles-Hosteleros
> **Empresa piloto**: BACANAL (`fe2ea3c4-aa28-41ce-a135-bf196ab5dc47`). HABANA (`00000000-0000-0000-0000-000000000001`) es greenfield.
> **DECISIÓN DEL DUEÑO (2026-06-16)**: el descuento de stock aplica **desde hoy en adelante** (parte del inventario actual; las ventas de los 12 meses quedan solo como histórico de ventas de PRP-056 y NO descuentan stock). El kardex arranca con saldo conocido.

---

## Objetivo

Dar a cada producto con stock un **libro mayor de movimientos (kardex)** — entradas por compra (albarán) y salidas por venta (factura Ágora explotada por escandallo) — con saldo resultante por fila, idempotente y reversible, más una vista de histórico filtrable por fechas dentro de cada producto. Cierra el lazo de PRP-056: las ventas ya ingeridas pasan a **descontar stock real** vía escandallo, con guardia anti-doble-descuento.

## Por Qué

| Problema | Solución |
|----------|----------|
| `stock` solo guarda el saldo actual; no hay forma de auditar de dónde sale ni por qué cambió | Tabla kardex (libro mayor) con un movimiento por cada entrada/salida, ligado a su documento origen |
| Ágora ingiere ventas (PRP-056) pero NO descuenta stock — `stock_descontado` se marca `true` sin descontar nada | Explotar cada venta por su escandallo y descontar ingredientes, generando movimientos |
| Las compras (albaranes) no mueven stock hoy; la mercancía que entra no se registra | Recepción de albarán genera movimientos de entrada con su nº de albarán |
| 108 productos de venta en Bacanal sin escandallo (de los cuales se venden en Ágora ~146 productos); las bebidas no descuentan nada | Saneamiento auditado: 9 bebidas 1:1 sin receta, tarta de queso receta manual, repaso del resto |
| Reprocesar un día (PRP-056 reemplaza líneas) duplicaría stock si no hay idempotencia | Movimiento ligado a su línea/documento origen → reproceso recalcula (borra+rehace) los movimientos del día |

**Valor de negocio**: trazabilidad real de inventario (cuánto entra, cuánto se consume por venta, saldo en cada momento), base para cálculo de coste/merma y para detección de descuadres. Sin esto el stock es un número sin historia ni confianza.

## Qué

### Criterios de Éxito
- [ ] Existe tabla de movimientos de stock (kardex) con: `empresa_id`, `producto_id`, `fecha`, `tipo` (entrada/salida), `cantidad`, `signo`, `saldo_resultante`, `referencia` (nº albarán / nº factura Ágora), enlace al documento origen y a la línea origen.
- [ ] Cada venta de Ágora (`pos_ticket_lineas` `origen='agora'`) explota por su escandallo y descuenta ingredientes en `stock`, generando un movimiento de salida por ingrediente afectado.
- [ ] Reprocesar un business-day (reingesta PRP-056) NO duplica stock ni movimientos: los movimientos de ese ticket/día se recalculan (revertir saldo + borrar + rehacer).
- [ ] Recibir/recepcionar un albarán genera movimientos de entrada con `referencia = nº albarán` y suma al `stock`.
- [ ] Dentro de la ficha de cada producto con stock hay una sección "Movimientos" con histórico filtrable por rango de fechas, SIN columna de almacén, que muestra referencia y, en ventas, permite desplegar inline la factura original de Ágora (datos de PRP-056, sin salir a Ágora).
- [ ] Saneamiento Bacanal aplicado: 9 bebidas descuentan 1:1 su propio stock (sin receta), tarta de queso con receta manual, y queda inventariado el repaso de los productos de venta sin escandallo restantes.
- [ ] `npm run typecheck` y `npm run build` pasan; el camino Ágora deja de marcar `stock_descontado=true` en falso.

### Comportamiento Esperado (Happy Path)

**Salida (venta Ágora):** El cron diario `/api/cron/agora-sync` ingiere las facturas del día (PRP-056) → para cada ticket `origen='agora'`, si aún no tiene stock descontado, se explotan sus líneas por escandallo (`producto_composicion`): por cada ingrediente, `consumo = cantidadVendida × cantidadEscandallo × (1 + merma/100)`. Se descuenta `stock.cantidad_actual` y se inserta un movimiento de salida por ingrediente con `referencia` = nº factura Ágora, `documento_tipo='pos_ticket'`, `origen_linea_id` = línea Ágora, y `saldo_resultante`. Producto de venta sin escandallo que sí descuenta 1:1 (bebidas saneadas) descuenta su propio producto. Se marca el ticket como descontado (guardia anti-doble).

**Reproceso:** Al reingerir un día, antes de borrar/recrear líneas, se **revierten** los movimientos de esos tickets (suma de vuelta al stock + borra movimientos), se resetea `stock_descontado=false`, y se vuelve a descontar tras reinsertar líneas. Saldo final idéntico a una sola pasada.

**Entrada (compra):** Al pasar un albarán a estado "recibido", cada línea (`albaranes_lineas`) genera un movimiento de entrada `referencia = albaranes.numero`, `documento_tipo='albaran'`, suma a `stock.cantidad_actual`. Guardia para no recepcionar dos veces.

**UI:** En la ficha del producto (`ProductosView`, sección nueva tipo Card "Movimientos") el responsable filtra por fechas y ve la foto kardex (fecha · tipo · cantidad · saldo · referencia). En filas de venta, un disclosure abre inline el detalle de la factura Ágora.

---

## Contexto

### Referencias
- `src/features/sala/pos/services/descontar-stock-por-ventas.ts` — servicio compartido de descuento (POS propio + Ágora). **Evolucionar**: que además de mutar `stock`, emita movimientos de kardex y devuelva el detalle por ingrediente.
- `src/features/logistica/services/agora-ventas-ingesta.ts` — ingesta PRP-056. Hoy pone `stock_descontado: true` sin descontar (BUG latente). El reproceso borra+reinserta líneas (líneas 89-139).
- `src/features/logistica/services/agora-ventas-sync.ts` — sync legacy por agora_id agregado (usa `descontarStockPorVentas`).
- `src/features/logistica/actions/albaranes-actions.ts` — `updateAlbaranEstado` (línea 121). Hoy NO toca stock.
- `src/features/logistica/components/ProductosView.tsx` — ficha de producto = Cards apiladas (Escandallo línea 834, Tarifas, Carta). Aquí va la Card "Movimientos".
- `src/features/logistica/components/StockView.tsx` — vista de stock actual.
- Tablas existentes: `stock` (saldo + `ultimo_movimiento`), `pos_tickets` (`origen`, `agora_serie`, `agora_numero`, `stock_descontado`), `pos_ticket_lineas` (`producto_id`, `nombre`, `cantidad`, `precio_unitario`...), `albaranes` (`numero`, `fecha`, `estado`), `albaranes_lineas` (`producto_id`, `cantidad`), `producto_composicion` (`producto_venta_id`, `ingrediente_id`, `cantidad`, `merma_pct`).

### Datos auditados (Bacanal, 2026-06-16)
- 205 productos de venta; **108 sin escandallo**; ~146 productos vendidos en Ágora; 151 filas de stock.
- 9 bebidas vendidas sin escandallo seguras para 1:1 (Alhambra, Coronita, San Miguel 0,0 / 0,0 tostada / sin gluten, Alma rosado, Árabe, Delizia, Marqués de Vargas): 0 en carta, 0 usadas como ingrediente, 0 receta propia, 9 con stock.
- Tarta de queso (postre): necesita receta a mano.
- El espejo de stock de Fernando (185 productos + 201 líneas) se conserva como **inventario inicial**; NO se mantiene espejo recurrente. El stock lo gobierna Balles (memoria `project_agora_modelo_stock_balles`).

### Arquitectura Propuesta
```
src/features/logistica/
├── services/
│   ├── descontar-stock-por-ventas.ts   # evolucionar: emite movimientos de kardex
│   ├── kardex.ts                        # NUEVO: registrar/revertir movimientos + recalcular saldo
│   └── entradas-stock-por-albaran.ts    # NUEVO: recepción albarán → entradas
├── components/
│   ├── productos/MovimientosStockSection.tsx   # NUEVO: Card histórico + filtro fechas + factura inline
│   └── productos/FacturaAgoraInline.tsx        # NUEVO: detalle factura desplegable
├── actions/
│   └── kardex-actions.ts                # NUEVO: listar movimientos por producto/fechas (server action)
└── data/kardex.ts                       # NUEVO: tipos + labels de tipo de movimiento (fuente única)
```

### Modelo de Datos (propuesto — requiere aprobación de schema)
```sql
-- Libro mayor de movimientos de stock. SIN columna de almacén (decisión de producto).
CREATE TABLE stock_movimientos (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id      UUID NOT NULL,
  producto_id     UUID NOT NULL REFERENCES productos(id) ON DELETE CASCADE,
  fecha           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  tipo            TEXT NOT NULL CHECK (tipo IN ('entrada','salida')),
  cantidad        NUMERIC NOT NULL CHECK (cantidad >= 0),  -- valor absoluto
  signo           SMALLINT NOT NULL CHECK (signo IN (1,-1)),
  saldo_resultante NUMERIC NOT NULL,                       -- saldo del producto tras aplicar el movimiento
  referencia      TEXT,                                    -- nº albarán (entrada) / nº factura Ágora (salida)
  documento_tipo  TEXT NOT NULL CHECK (documento_tipo IN ('albaran','pos_ticket','ajuste')),
  documento_id    UUID,                                    -- albaranes.id / pos_tickets.id
  origen_linea_id UUID,                                    -- albaranes_lineas.id / pos_ticket_lineas.id (idempotencia)
  motivo          TEXT,                                    -- nota libre (ajustes/saneamiento)
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by      UUID
);

-- Idempotencia: una salida de venta = (línea Ágora × ingrediente). Una entrada = (línea albarán).
CREATE UNIQUE INDEX uq_stock_mov_origen
  ON stock_movimientos (origen_linea_id, producto_id)
  WHERE origen_linea_id IS NOT NULL;

CREATE INDEX idx_stock_mov_producto_fecha
  ON stock_movimientos (empresa_id, producto_id, fecha DESC);

ALTER TABLE stock_movimientos ENABLE ROW LEVEL SECURITY;
-- Política multi-tenant con helper canónico (memoria project_rls_helper_empresas_del_usuario):
CREATE POLICY stock_mov_sel ON stock_movimientos FOR SELECT
  USING (empresa_id IN (SELECT empresas_del_usuario()));
-- escritura solo service-role / acciones server (sin policy de INSERT para usuarios anon).
```
> **Decisión a confirmar**: `stock` se mantiene como saldo materializado (rápido para listados) y el kardex es la fuente de verdad del histórico; `saldo_resultante` se calcula al insertar. Alternativa (más simple, menos perf): derivar saldo siempre del kardex y deprecar `stock.cantidad_actual`. Propuesta: mantener `stock` materializado.

---

## Blueprint (Assembly Line)

### Fase 0: Coordinación y solo-lectura
**Objetivo**: Confirmar con Fernando (sesión paralela admin) que nadie más toca stock/ingesta; congelar el espejo recurrente; auditar en solo-lectura el estado real de Bacanal y Habana. Aprobar el schema de `stock_movimientos`.
**Validación**: Working tree limpio; schema aprobado por el dueño; query de auditoría guardada (no se escribe nada todavía).

### Fase 1: Tabla kardex + servicio de movimientos
**Objetivo**: Crear `stock_movimientos` (migración versionada) + `services/kardex.ts` con `registrarMovimiento`, `revertirMovimientosPorDocumento`, y cálculo de `saldo_resultante` consistente. `data/kardex.ts` con tipos/labels (sentence case).
**Validación**: Insertar y revertir un movimiento de prueba deja `stock` y kardex coherentes; reinsertar el mismo `origen_linea_id` no duplica (índice único).

### Fase 2: Descuento por escandallo desde Ágora (cerrar PRP-056)
**Objetivo**: Evolucionar `descontar-stock-por-ventas.ts` para emitir movimientos vía kardex y devolver detalle por ingrediente con su `origen_linea_id`. Conectar la ingesta Ágora: descontar realmente, con guardia anti-doble-descuento por ticket; el reproceso revierte antes de rehacer. Quitar el `stock_descontado: true` falso de la ingesta.
**Validación**: Ingerir un día de Bacanal en entorno controlado descuenta stock y crea movimientos de salida con nº factura; reingerir el mismo día deja saldo idéntico (idempotente). Regla de seguridad Ágora: ante error, parar y mostrar error exacto.

### Fase 3: Entradas por compra (albarán)
**Objetivo**: `services/entradas-stock-por-albaran.ts` + cablear `updateAlbaranEstado` (estado "recibido") para generar movimientos de entrada con nº albarán, sumar a `stock`, con guardia anti-doble-recepción y reversión si se anula la recepción.
**Validación**: Recepcionar un albarán suma stock y crea entradas; recepcionar dos veces no duplica; anular revierte.

### Fase 4: UI — histórico de movimientos en la ficha de producto
**Objetivo**: `MovimientosStockSection` (Card en `ProductosView`, solo productos con stock) con filtro por rango de fechas, foto kardex sin columna de almacén, y `FacturaAgoraInline` desplegable en filas de venta usando los datos PRP-056. `kardex-actions.ts` server action de listado.
**Validación**: Playwright: abrir ficha de un producto con movimientos, filtrar por fechas, desplegar una factura Ágora inline. Capitalización sentence case.

### Fase 5: Saneamiento de catálogo Bacanal
**Objetivo**: Marcar las 9 bebidas auditadas para descuento 1:1 (mecanismo: producto de venta que descuenta su propio producto; definir el flag/criterio sin romper el resto), cargar la receta manual de la tarta de queso, e inventariar el repaso de los productos de venta sin escandallo restantes (reporte de qué falta).
**Validación**: Vender las 9 bebidas en Ágora descuenta su propio stock 1:1; tarta de queso descuenta sus ingredientes; reporte de pendientes generado. Sin afectar a Habana (greenfield) salvo lo que el dueño decida.

### Fase 6: Validación Final
**Objetivo**: Sistema end-to-end en Bacanal; decidir alcance Habana.
**Validación**:
- [ ] `npm run typecheck` pasa
- [ ] `npm run build` exitoso
- [ ] Playwright confirma vista de movimientos + factura inline
- [ ] Reproceso de un día = saldo idéntico (idempotencia probada)
- [ ] Criterios de éxito cumplidos; PRP-056 no roto

---

## 🧠 Aprendizajes (Self-Annealing)

### 2026-06-16: Implementación SCOPEADA (Fases 1, 3, 4, 5 — sin tocar Agora)
Hechas sin colisionar con la sesión paralela (Fernando, ahora ya commiteada). typecheck 0 / build OK.
- **Fase 1**: tabla `stock_movimientos` (migración `20260616120000`), `data/kardex.ts` (tipos+labels), `services/kardex.ts` (`registrarMovimiento` idempotente por `(origen_linea_id,producto_id)` + `revertirMovimientosPorDocumento` + saldo materializado en `stock.cantidad_actual`). Índice único de idempotencia validado a nivel SQL.
- **Fase 3**: `services/entradas-stock-por-albaran.ts` + cableado en `albaranes-actions.updateAlbaranEstado`: al entrar a estado **"Recibido"** genera entradas (revierte antes → idempotente); al salir de "Recibido", revierte. `albaranes.lineas` es **jsonb** (camelCase: `productoId`,`cantidad`,`id`), NO tabla `albaranes_lineas` (vacía).
- **Fase 4**: `kardex-actions.ts` (`listMovimientosProducto` con filtro fechas + `getFacturaAgora`), `MovimientosStockSection` (Card en `ProductosView` tras Tarifas, sin columna de almacén) + `FacturaAgoraInline` (factura Ágora desplegable leyendo `pos_tickets`/`pos_ticket_lineas` de PRP-056).
- **Fase 5**: columna nueva `productos.descuenta_stock_directo` (flag 1:1 sin receta). **Marcadas SOLO las 9 bebidas aprobadas.** Informe: **108 productos de venta vendidos en Ágora sin escandallo** → 1:1 candidatos (≈30 botellas, San Miguel/Radler, Sabores, cafés) vs necesitan receta (platos y cócteles). NO auto-marcados: requieren criterio del dueño.

### PENDIENTE (Fase 2, diferida hasta `git pull` de lo de Fernando)
- Descuento venta→escandallo (evolucionar `descontar-stock-por-ventas.ts` para emitir movimientos vía `services/kardex.ts`, que ya está listo para que lo llamen) + honrar `descuenta_stock_directo` (1:1) + arreglar el `stock_descontado=true` falso de PRP-056. Toca archivos de Ágora → esperar coordinación.
- Clasificar los 108 productos sin escandallo (cuáles 1:1, cuáles receta). Tarta de queso: receta manual.

---

## Gotchas

- [ ] **`stock_descontado=true` falso en Ágora**: `agora-ventas-ingesta.ts` ya lo marca `true` sin descontar. Antes de activar el descuento real hay que normalizar ese flag (los tickets ya ingeridos del backfill 12 meses lo tienen en `true` sin movimientos). Decidir: o se descuenta el histórico (genera movimientos de 12 meses) o se parte de "hoy en adelante" y se deja el histórico como saldo inicial. **Pedir decisión al dueño.**
- [ ] **Reproceso PRP-056**: la ingesta borra+reinserta `pos_ticket_lineas` → cambian los `id` de línea. La idempotencia debe basarse en revertir por `documento_id` (ticket) antes de reinsertar, no solo por `origen_linea_id`.
- [ ] **Dos caminos Ágora**: `agora-ventas-ingesta.ts` (PRP-056, por factura/ticket) y `agora-ventas-sync.ts` (legacy, agregado por agora_id). No deben descontar ambos el mismo día. Confirmar cuál queda como canónico (probablemente ingesta) y desactivar el descuento del otro.
- [ ] **Saldo negativo**: el servicio actual hace `Math.max(0, ...)`. Con kardex, `saldo_resultante` debe reflejar lo real (¿permitir negativo para detectar descuadres, o seguir capando a 0?). Decidir y aplicar coherente.
- [ ] **RLS**: usar `empresas_del_usuario()` (memoria), no filtrar solo por `profiles.empresa_id` (rompe multiempresa).
- [ ] **Albaranes hoy no mueven stock**: añadir el movimiento de entrada es comportamiento nuevo — verificar que no rompe flujos de pedidos/comparativa existentes.
- [ ] **Coordinación Fernando**: admin con sesión paralela que ya metió el espejo; no pisar (no git stash entre agentes — memoria `feedback_agentes_paralelos_git_stash`).
- [ ] **Regla de seguridad Ágora**: empezar solo-lectura; ante error de Ágora/persistencia, parar, mostrar error exacto, pedir aprobación. No swallow.

## Anti-Patrones

- NO duplicar la lógica de explosión de escandallo: reusar `descontar-stock-por-ventas.ts`.
- NO mantener el espejo recurrente de stock de Ágora (el stock lo gobierna Balles).
- NO añadir columna de almacén a la UI de movimientos (decisión explícita).
- NO descontar el mismo ticket/albarán dos veces (guardias obligatorias).
- NO romper PRP-056 ni el cron `/api/cron/agora-sync`.
- NO usar `any`; NO `uppercase` en UI (sentence case salvo siglas reales).

---

*PRP pendiente aprobación. No se ha modificado código.*
