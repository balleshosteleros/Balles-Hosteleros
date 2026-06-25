---
name: Compras/aprovisionamiento — decisiones de Iván (2026-06-25)
description: Respuestas de Iván a las 6 decisiones del módulo de compras (ventanas de venta con presets, stock máximo por TEMPORADAS auto/manual, proveedor principal obligatorio con precio de ficha, envío WhatsApp+email interno con PDF, recepción 100% móvil, stock live al confirmar). Detalle en docs/LOGISTICA_COMPRAS_RESPUESTAS_IVAN.md
type: project
---

**Decisiones de Iván (2026-06-25) que desbloquean la implementación de compras.** Responden a las 6 dudas de [[compras_aprovisionamiento_estado_2026-06-24]] / `docs/LOGISTICA_COMPRAS_ESTADO_Y_PLAN.md`. Detalle completo en `docs/LOGISTICA_COMPRAS_RESPUESTAS_IVAN.md`.

1. **Reposición por ventas = cobertura por días (modelo OK)** con presets de UX: **Últimos 3 / 7 / 14 días** + **Personalizado entre dos fechas** (detecta lo vendido entre esas fechas y esa es la propuesta). **La ventana NO cuenta hoy: empieza desde AYER hacia atrás.**

2. **Stock máximo = por TEMPORADAS.** Tabla nueva de temporadas (rango fecha→fecha) por empresa; **2 por defecto para todos: verano e invierno** (al empezar una termina la otra); **cobertura total obligatoria** — ningún día sin temporada, por defecto coge una. Cada producto de compra tiene **stock máximo por cada temporada**. Auto: el sistema mira **ventas de esa misma temporada del AÑO ANTERIOR** y detecta **la semana que más se vendió**; stock máximo **siempre por 7 días**. Al reponer por stock, **avisar "cubre máx. 7 días, luego repetir"**. Cada producto configurable **Automático o Manual** (manual = valor fijado a mano que se usa de referencia); **siempre uno u otro**, y **cambio en caliente** (el pedido lo coge al momento). ⚠️ **Riesgo:** el Auto necesita histórico de 1 año en `pos_tickets`; el volcado Ágora empezó hace poco → si no hay año-anterior, **arrancar en Manual** y activar Auto al acumular histórico (Fernando confirma cuánto histórico real hay).

3. **`ingredientes_proveedor` = automático, manda el PRINCIPAL.** Cada producto de compra puede tener varios proveedores pero **1 principal obligatorio** (resto secundario/terciario); para pedidos **prevalece el principal**. **Precio = el grabado en la ficha del producto para ese proveedor**, NO el del último albarán. El precio del último albarán **solo cuenta para los datos del albarán**, no pisa la ficha.

4. **Envío al proveedor = WhatsApp + Email, ambos con PDF.** WhatsApp: botón que abre WhatsApp y adjunta **PDF** del pedido. Email: **desde dentro del software** (vincular al apartado de emails ya integrado, NO sacarlo a otra plataforma), enviado al **`proveedores.email_pedidos`**, **texto + PDF adjunto**.

5. **Recepción con foto = PRIORIDAD MÓVIL ABSOLUTA.** En la app móvil hoy solo existe "MIS PANELES"; **crear "MIS DEPARTAMENTOS"** y meter ahí **LOGÍSTICA** (diseño libre). Botón **"ALBARANES"** → lista de albaranes **pendientes de confirmar**; al abrir trae los **mismos datos del pedido** que lo generó. El gerente chequea mercancía y **hace foto al albarán del proveedor**; el sistema hace **chequeo automático** (errores donde no coincide, **tick verde** donde sí). La **foto queda adjunta a nuestro albarán** (viven juntas).

6. **Stock "actual" = LIVE.** Se mueve **solo al CONFIRMAR**: descuenta ventas + suma albaranes confirmados. **Pendientes NO cuentan** en stock; el pedido menos (paso previo). **Eliminar el provisional** al entrar en uso. **Primer barrido MANUAL** para dejarlo actualizado (puede ser **la semana que viene**); desde ahí entran todos los albaranes. Si funciona OK → **migrar toda la logística y dejar Ágora SOLO a nivel de COMPRAS** (el resto de Ágora sigue).

Relacionado: [[compras_aprovisionamiento_estado_2026-06-24]], [[logistica_spec_completa]], [[agora_estado_y_pendientes_2026-06-23]]. Zona compartida con Fernando → coordinar.
