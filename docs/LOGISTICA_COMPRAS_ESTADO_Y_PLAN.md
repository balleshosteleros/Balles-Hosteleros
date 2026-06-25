# Logística · Módulo de Compras / Aprovisionamiento — Estado y plan

> **Fecha:** 2026-06-24 · **Autor:** Claude (lado Fernando) · **Tipo:** handoff / plan, SIN código (solo lectura de código + BD).
> **Origen:** Iván delega la rama de **logística (compras)** y manda por audio la visión + **11 albaranes** de proveedores reales (18-19/06/2026) de Bacanal y Habana. Fernando pide diagnóstico antes de tocar nada.
> **Relacionado:** `docs/AGORA_INTEGRACION_ESTADO_Y_PLAN.md`, `.claude/memory/feedback/regla_seguridad_agora.md`, `.claude/memory/feedback/regla_oro_balles_fuente_verdad.md`.

---

## TL;DR

El módulo de compras que describe Iván **ya está construido en ~80%** (sugerencias por stock y por ventas, agrupación por proveedor, crear pedido, crear albarán desde pedido, recepción con foto + lectura IA, **comparativa pedido↔albarán con incidencias**). **El bloqueo NO son funciones que falten, sino DATOS sin sembrar:** stock máximo, media de ventas y el vínculo producto↔proveedor están vacíos, así que hoy "reponer almacén" **devuelve vacío**. El trabajo real pasa de "construir un módulo" a "**sembrar datos + cerrar 3 costuras mock**".

---

## 1. Verificación pedida por Iván: ¿las ventas se vuelcan bien a diario? → ✅ SÍ

Comprobado el 2026-06-24 en `agora_sync_log`: el cron corrió **dos veces y verde** (Vercel 08:49 UTC + GitHub Actions 12:08 UTC), **ambas empresas**, 0 errores (HABANA 21/21 registros, BACANAL 6/6). Las ventas entran a diario a `pos_tickets`/`pos_ticket_lineas` y queda registro por empresa. Esta parte está sólida (ver handoff de Ágora).

## 2. Lo que YA EXISTE en el código (no rehacer)

| Lo que pide Iván | Dónde está |
|---|---|
| Stock por producto (actual/máximo/mínimo) | `productos.stock_minimo/maximo`, tabla `stock` (`cantidad_actual/minima/maxima`), `stock-actions.ts`, `StockView.tsx` |
| "Reponer almacén" → propuesta de pedido por proveedor | `actions/sugerencias-actions.ts` + `components/pedidos/SugerenciasPedidoModal.tsx` |
| **Dos modos** de reposición | `getSugerenciasPorStock` (hasta el máximo) y `getSugerenciasPorVentas` (por cobertura de días) |
| Agrupar la compra por proveedor | `agruparPorProveedor` (usa `ingredientes_proveedor.es_preferido`) |
| Ficha de pedido | `createPedido` + `PedidoModal.tsx` + `DetallePedido.tsx` |
| Botón "crear albarán" desde el pedido | `createAlbaran` (`albaranes-actions.ts`), invocado desde `PedidosView.tsx` |
| Recepción con foto del albarán + lectura IA | `pedidos/AlbaranUploadModal.tsx` + `lib/importador-ia/extractor.ts` + `importador-ia-actions.ts` |
| **Comparativa pedido vs albarán** | `pedidos/ComparativaAlbaran.tsx` (cabecera "COMPARATIVA PEDIDO vs ALBARÁN PROVEEDOR") |
| **Incidencias** (no entregado / más-menos cantidad / precio distinto) | tipos `faltante`, `cantidad_diferente`, `precio_diferente`, `cantidad_y_precio`, `extra` en `lib/facturas/comparar-lineas.ts`; `resolverDiscrepancia` |
| Entrada de stock al recibir | `sumarStockDesdeAlbaran`, `services/entradas-stock-por-albaran.ts` |

→ La pantalla de "comparativa pedido↔albarán con alertas de discrepancia" que describe Iván **está hecha tal cual**.

## 3. El cuello de botella real: faltan DATOS (medido en BD el 2026-06-24)

- `productos` tipo=compra: **Bacanal 283 / Habana 280**, pero **`stock_maximo` > 0 → 0** y **`ventas_dia_promedio` > 0 → 0** en ambas empresas.
- `stock`: ~123-127 productos con `cantidad_actual` > 0 (del espejo de junio, **congelado** porque el descuento por ventas no está armado), pero **`cantidad_maxima` > 0 → 0**.
- `ingredientes_proveedor` (vínculo producto↔proveedor↔precio): **0 filas (vacío total)**.
- `pedidos` y `albaranes`: **0** (el flujo nunca se ha ejercitado con datos reales).
- `proveedores`: 32 por empresa, 18 con email. ✅

Consecuencia: `getSugerenciasPorStock` salta todo lo que tenga `stockMax <= 0` (= todo) y `getSugerenciasPorVentas` salta todo lo que tenga `ventasDia <= 0` (= todo). **Hoy "reponer almacén" sale vacío.** Esto es justo lo que anticipa Iván: *"de momento invéntate el stock provisional y luego se hace un barrido"*.

## 4. Huecos de funcionalidad reales (lo que sí hay que programar)

1. **Sembrar datos**: `stock_maximo`, `ventas_dia_promedio` y `ingredientes_proveedor` (provisional). Sin esto, nada funciona.
2. **`ventas_dia_promedio` no lo calcula nadie**: el motor lo LEE pero ningún código lo ESCRIBE desde `pos_tickets` (verificado: solo aparece en lecturas). Falta el cálculo (o siembra provisional).
3. **Envío real al proveedor = mock**: en `PedidosView.handleEnviarProveedor` solo se hace `setPedidos(...)` (estado local en React) con un mapa estático `PROVEEDOR_EMAILS`; el botón "Enviar" de `DetallePedido` abre un `mailto:`. **No persiste ni envía.** Infra real disponible: `src/lib/email/send.ts`, `marketing/services/resend-service.ts`, `marketing/services/whatsapp-service.ts`; y el campo `proveedores.email_pedidos` ya existe.
4. **`PedidosView` a medio de-mock**: tira de `data/pedidos.ts` (`PROVEEDOR_EMAILS`, estado local). Falta terminar de conectarlo a `pedidos-actions.ts` (BD).
5. **Recepción en MÓVIL**: no existe `logistica/mobile` ni pantalla móvil; `AlbaranUploadModal` es de escritorio. Iván la quiere en el móvil.
6. **Stock "actual" congelado**: `stock.cantidad_actual` está en los valores del espejo de junio; el descuento por ventas no está armado (`empresas.stock_descuento_desde = null`) → el "stock actual" no es *live*.

## 5. Los albaranes de Iván = el combustible que falta 🔑

Cada línea de albarán dice *qué proveedor trae qué producto a qué precio* → es justo lo que necesita `ingredientes_proveedor` (y da una base realista de precio de compra). El extractor IA ya existe. **El "pero":** hay que **emparejar** los nombres del proveedor (p.ej. "METRO Chef leche entera 1,5L", "BURGER POTATO HIGH 75GR") con los productos de compra de Balles, y habrá ambigüedades que decidir.

Inventario recibido (18-19/06/2026), referencia para la siembra:

| Proveedor | Empresa | Nº doc | Total | Categoría |
|---|---|---|---|---|
| Makro | Bacanal | 9-182738983 (2 pág.) | 793,28 € | Alimentación variada |
| Makro | Bacanal | 9-182740267 | 96,66 € | Pollo, secreto, merluza, mozzarella |
| Garcimar | Bacanal | MA/49733 | 335,43 € | Vieira, adobo, arroces |
| El Encinar de Humienta | Bacanal | H2026_9.079 | 487,38 € | Carnes (cachopo, entrecot, tomahawk, angus) |
| Antonio de Miguel | Bacanal | A/2081390 | 308,12 € | Jamón, pan brioche, croquetas, burratina |
| Belmon Drink | Bacanal | 13399 | 242,87 € | Vinos / bebidas |
| Belmon Drink | Habana | 13376 (+13376/2) | 736,00 € | Licores, ginebras, Oxefruit |
| Serpeska (Distrib. Mozos) | Bacanal | 2175856 | 106,08 € | Panadería (burger potato, artesanitos) |
| Dither Frutería | Bacanal | 26000870 | 152,36 € | Frutas/verduras |
| Dither Frutería | Habana | 26000869 | 123,52 € | Fruta/azúcar/especias coctelería |
| Mahou | Bacanal | 93136/5 | 74,09 € | Cerveza Alhambra |
| Krittikali | Bacanal | SH2606-51647 | 90,47 € | Limpieza / desechables |
| Krittikali | Habana | SH2606-51660 | 198,41 € | Menaje / limpieza |
| DDI Nexia | Bacanal | 7200005199 | 31,04 € | Fuentes de vidrio |
| (Excel interno Habana) | Habana | — | — | Cachimba/shisha (formato de pedido de referencia) |

(Imágenes en poder de Fernando / WhatsApp. La transcripción línea a línea se hará con el extractor IA sobre los ficheros reales.)

## 6. Decisiones pendientes de Iván (bloquean la implementación)

1. **Reposición por ventas**: ¿por *cobertura de X días* (lo implementado) o literal *"vendí N → compro N"* desde el último pedido? ¿Qué ventana de días?
2. **Stock máximo provisional**: ¿cómo se genera? (¿factor × ventas? ¿% sobre stock actual? ¿lo fija él por producto?)
3. **`ingredientes_proveedor`**: ¿siembra automática desde los albaranes (IA) o lo monta el gerente de compras? ¿precio de compra de referencia = el del último albarán?
4. **Envío al proveedor**: ¿email (Resend), WhatsApp, o ambos? ¿a `email_pedidos`? ¿texto + PDF adjunto del pedido?
5. **Recepción con foto**: ¿prioridad móvil, o empezamos por escritorio (que ya está)?
6. **Stock "actual"**: ¿pasa a ser *live* (armar descuento por ventas + entradas por albarán) o seguimos con provisional + barrido manual?

## 7. Plan por fases (propuesta, a confirmar tras las respuestas)

- **Fase 0 — Decisiones (Iván).** Responder §6. Bloquea el resto.
- **Fase 1 — Siembra de datos.** `ingredientes_proveedor` desde los albaranes (IA + emparejado), `stock_maximo` y `ventas_dia_promedio` provisionales. Tablas: `productos`, `stock`, `ingredientes_proveedor`. (Aplica Regla de Seguridad: escrituras idempotentes y reversibles.)
- **Fase 2 — De-mock de pedidos.** Conectar `PedidosView` a `pedidos-actions.ts`, quitar `PROVEEDOR_EMAILS` estático y estado local; usar `proveedores.email_pedidos`. Solo frontend + actions.
- **Fase 3 — Envío real.** Server action `enviarPedidoProveedor` con Resend y/o WhatsApp (según §6.4), persistir estado "Enviado", adjuntar PDF. Reusar `lib/email/send.ts` / `marketing/services/whatsapp-service.ts`.
- **Fase 4 — Recepción en móvil.** Llevar `AlbaranUploadModal` + comparativa a la superficie móvil.
- **Fase 5 — Gestión avanzada de incidencias.** (Iván: *"de momento déjalo ahí"*.) Guardar/gestionar incidencias más allá de la alerta actual.
- **Fase 6 — Stock live (opcional, §6.6).** Armar descuento por ventas + entradas por albarán para que el stock actual deje de estar congelado.

## 8. Notas de seguridad / coordinación

- **Zona compartida con Iván** (`logistica/`, `sala/`): él la ha delegado para compras, pero hay trabajo concurrente → coordinar antes de tocar y commits atómicos.
- **Regla de Seguridad Ágora**: ante cualquier error de Ágora/persistencia, parar, mostrar el error exacto y pedir aprobación.
- **A 2026-06-24 NO se ha tocado código ni BD** — todo este documento es diagnóstico (lectura). HEAD `8286bce`.

---

## 9. ACTUALIZACIÓN 2026-06-25 — decisiones de Iván + hallazgos + orden revisado

Iván respondió las 6 dudas (detalle en `docs/LOGISTICA_COMPRAS_RESPUESTAS_IVAN.md`). Resumen de decisiones:
1. **Reposición por ventas** = cobertura por días, presets **3/7/14 + personalizado** (entre 2 fechas), ventana **desde AYER** (hoy no cuenta).
2. **Stock máximo por TEMPORADAS**: 2 por defecto (verano/invierno), cobertura total del año sin huecos; **Auto** = semana de más venta de esa temporada el **año anterior** ×7 días; **Manual** por producto; flag Auto/Manual por producto con cambio en caliente.
3. **`ingredientes_proveedor` automático**: cada producto compra con **1 proveedor principal obligatorio** (+ secundarios); en pedidos prevalece el principal; **precio de referencia = el de la ficha**, NO el del último albarán.
4. **Envío = WhatsApp + Email**, ambos con **PDF**; email **desde dentro del software** a `proveedores.email_pedidos`.
5. **Recepción 100% MÓVIL**: crear **"Mis Departamentos" → Logística → Albaranes** (hoy el móvil solo tiene "Mis Paneles"); abrir albarán pendiente, foto del albarán del proveedor, **chequeo automático** (tick verde / errores), foto adjunta al albarán nuestro.
6. **Stock LIVE al CONFIRMAR**: descuenta ventas + suma albaranes confirmados; pendientes no cuentan; **barrido manual inicial** (la semana que viene); si va bien, migrar Ágora→Balles **solo en compras**.

### Hallazgos (verificados en BD el 2026-06-25) que reordenan el plan
- **NO hay histórico de 1 año.** `pos_tickets` = 308 tickets, **99% de junio 2026** (abril/mayo: 1 cada uno); rango 2026-04-17 → 2026-06-24. → **El cálculo Auto del stock máximo (§2) es imposible ahora**; se construye pero queda dormido hasta acumular histórico (~jun-2027). **Arrancamos en Manual** (confirmado por Iván).
- **La reposición por ventas (§1) depende de las recetas** (explotar ventas→productos de compra por escandallo), que son **triviales 1:1** → solo fiable para lo vendido casi directo (**bebidas**) hasta cargar las recetas reales del Excel. La reposición **por stock** NO tiene esta dependencia.
- `pos_tickets.stock_descontado` = **False en los 308** → el stock nunca se ha movido; §6 (live) es greenfield.

### Orden revisado (a falta de confirmar archivos por incremento)
- **Incremento 1 (viable ya, sin histórico ni recetas) — "Reponer almacén POR STOCK" E2E:** §2 en **Manual** (stock máximo por producto) + §3 (sembrar `ingredientes_proveedor` con proveedor principal desde los 11 albaranes). Salida: pedido real agrupado por proveedor.
- **Paralelo (frontend):** §4 envío (WhatsApp Business API + email interno con PDF), §5 recepción móvil.
- **Después:** §1 por-ventas (con aviso de recetas), §6 stock live (con barrido manual), §2 **Auto** (cuando haya histórico).
- Matiz §4: el botón de WhatsApp que **auto-adjunta PDF** requiere la **API de WhatsApp Business** (la de marketing); `wa.me` simple solo lleva texto.

**Decisión de Fernando (2026-06-25): arrancar por el Incremento 1.** Pendiente: confirmar archivos exactos antes de escribir código.
