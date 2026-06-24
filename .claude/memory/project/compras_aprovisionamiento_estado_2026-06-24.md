---
name: Módulo de compras/aprovisionamiento — estado real y plan (2026-06-24)
description: El módulo de compras que pidió Iván (sugerencias por stock/ventas, pedido por proveedor, crear albarán, recepción con foto + comparativa pedido↔albarán con incidencias) YA ESTÁ ~80% construido; el bloqueo es DATOS sin sembrar, no funciones. Plan y dudas en docs/LOGISTICA_COMPRAS_ESTADO_Y_PLAN.md
type: project
---

**Diagnóstico 2026-06-24 (Claude, lado Fernando; solo lectura de código + BD, NO se tocó nada). Para el equipo / agente de Iván.**

Iván delegó la rama de **logística (compras)** por audio + 11 albaranes reales (Bacanal/Habana, 18-19 jun). Conclusión: **la mayor parte del módulo YA EXISTE en el código** — NO rehacer:
- Sugerencias **por stock** (`getSugerenciasPorStock`, hasta el máximo) **y por ventas** (`getSugerenciasPorVentas`, por cobertura de días) en `actions/sugerencias-actions.ts` + `components/pedidos/SugerenciasPedidoModal.tsx`; agrupan por proveedor vía `ingredientes_proveedor.es_preferido`.
- `createPedido`/`PedidoModal`/`DetallePedido`; `createAlbaran` (botón "crear albarán" desde el pedido).
- Recepción con foto + lectura IA (`AlbaranUploadModal`, `lib/importador-ia/extractor.ts`, `importador-ia-actions.ts`).
- **Comparativa pedido↔albarán YA HECHA** (`pedidos/ComparativaAlbaran.tsx`) con incidencias `faltante`/`cantidad_diferente`/`precio_diferente`/`extra` (`lib/facturas/comparar-lineas.ts`) + `resolverDiscrepancia` + entrada de stock (`sumarStockDesdeAlbaran`).

**El bloqueo real = DATOS sin sembrar** (medido en BD 24-jun): `productos` compra Bacanal 283/Habana 280 con **stock_maximo=0 y ventas_dia_promedio=0 en TODOS**; `stock.cantidad_maxima=0`; **`ingredientes_proveedor` VACÍO (0 filas)**; `pedidos`/`albaranes`=0. → hoy "reponer almacén" sale vacío. (Iván ya lo intuye: "invéntate el stock provisional, luego barrido".)

**Huecos de funcionalidad reales:** (1) sembrar datos (stock_maximo, ventas_dia_promedio, ingredientes_proveedor — los albaranes de Iván son la fuente); (2) **`ventas_dia_promedio` no lo computa nadie** desde `pos_tickets` (solo se lee); (3) **envío al proveedor es MOCK** (`PedidosView.handleEnviarProveedor` = estado local + mapa estático `PROVEEDOR_EMAILS`; el botón "Enviar" es un `mailto:`) — falta cablear Resend/WhatsApp real (infra existe en `lib/email/send.ts` y `marketing/services/whatsapp-service.ts`; el campo `proveedores.email_pedidos` ya existe); (4) `PedidosView` a medio de-mock (tira de `data/pedidos.ts`); (5) **recepción en móvil no existe** (no hay `logistica/mobile`); (6) stock_actual congelado (espejo junio, descuento por ventas sin armar).

**Verificación pedida por Iván (ventas a diario, ambas empresas, con registro): ✅ OK** (cron verde ×2 el 24-jun en `agora_sync_log`).

**6 decisiones pendientes de Iván** (bloquean implementación): modelo de reposición por ventas (cobertura-días vs "vendí N→compro N"); cómo generar stock_maximo provisional; sembrar `ingredientes_proveedor` por IA o a mano + precio de referencia; canal de envío (email/WhatsApp); recepción móvil vs escritorio primero; stock live vs provisional.

**Estado: PLAN ESCRITO, esperando a Iván (Fernando lo decidió).** NO se ha tocado código ni BD. Plan por fases + tabla de albaranes + dudas en **`docs/LOGISTICA_COMPRAS_ESTADO_Y_PLAN.md`**. Relacionado: [[regla_oro_balles_fuente_verdad]], `agora_estado_y_pendientes_2026-06-23.md`. Zona compartida con Iván → coordinar.
