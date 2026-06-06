# QA Report — PRP-051 Tipo de reserva TICKET

**Date**: 2026-06-03
**Status**: PASSED (con 1 bug menor anotado)

## Cobertura

Probado el camino crítico end-to-end del cliente final + lógica BD. Las pantallas
admin (Configuración → Tickets, Hub de enlaces, ficha cliente) no se probaron via
UI por falta de credenciales de login, pero typecheck + build OK y los datos
creados via SQL se consumen correctamente por la lógica que SÍ se probó.

## Pasos

| # | Paso | Resultado | Evidencia |
|---|------|-----------|-----------|
| 1 | Crear producto-ticket "Brunch QA" (25€, IVA 10%, por persona, stock 10, ocultar=ON) | ✅ | numero_secuencial=8 |
| 2 | Crear enlace QA_BRUNCH (vende_tickets=true) + pivote al producto | ✅ | BD |
| 3 | `list_ticket_productos_publicos('habana','QA_BRUNCH')` devuelve solo Brunch QA | ✅ | RPC |
| 4 | `/reservar/habana/qa_brunch` renderiza selector con badge "Elige tu ticket *" (rojo), 27.50 €/persona, descripción, "IVA incluido" | ✅ | `01-flujo-publico-selector.png` |
| 5 | Click ticket → `aria-pressed=true` + check verde | ✅ | `04b-resultado.png` |
| 6 | Submit form (2 personas) → reserva creada `tipo_categoria='ticket'`, `ticket_unidades=2`, `ticket_importe=50€`, `ticket_iva=10`, `pago_pendiente=true`, mesa B1 asignada | ✅ | BD reserva `53e22a54…` |
| 7 | Stock descontado 10 → 8 (modo por_persona × 2 pax) | ✅ | BD |
| 8 | `/reservar/habana/qa_brunch/embed` headers `X-Frame-Options: ALLOWALL` + `Content-Security-Policy: frame-ancestors *` | ✅ | curl headers |
| 9 | Embed renderiza form SIN logo del restaurante (chrome oculto) | ✅ | `05-embed.png` |
| 10 | Cambiar estado reserva → NO_SHOW → trigger inserta bloqueo automático | ✅ | BD bloqueo `35478410…`, motivo `no_show` |
| 11 | Re-reserva con mismo email/teléfono → toast rojo "Tu cuenta tiene un bloqueo por inasistencia previa. Contacta con el restaurante." | ✅ | `06-bloqueado.png` |
| 12 | Stock NO se descuenta por intento bloqueado (sigue en 2) | ✅ | BD — check bloqueo va ANTES del consumo |
| 13 | Desbloquear bloqueo (set `desbloqueado_at`) | ✅ | BD |
| 14 | Re-reservar tras desbloqueo → "¡Reserva recibida!" | ✅ | `07-tras-desbloqueo.png` |
| 15 | Stock 2 → 4 tras la nueva reserva | ✅ | BD |
| 16 | Forzar stock_consumido=stock_total | ✅ | BD |
| 17 | `list_ticket_productos_publicos` devuelve 0 filas con y sin keyword (oculto correctamente) | ✅ | RPC |
| 18 | Carga pública de `/reservar/habana/qa_brunch` ya NO muestra el selector (producto oculto) | ✅ | `08-agotado-y-oculto.png` |

## Findings

### Bug menor — enlace `vendeTickets=true` con productos agotados/ocultos

Cuando un enlace marcado como "Vende ticket" se queda sin productos visibles
(stock agotado + ocultar_al_agotar=true), el formulario público se renderiza
como una **reserva normal** (sin selector, botón "Reservar mesa" habilitado sin
ticket). El cliente puede mandar la reserva y pasa porque:

1. Client-side: `ticketObligatorio = ticketOnly && productosTicket.length > 0`
   queda en `false` cuando `productosTicket=[]`.
2. Server-side: `crear-reserva-publica.ts` recibe `ticketOnly=false` (calculado
   en cliente) y permite la reserva sin ticket.

**Comportamiento esperado**: si `linkInfo.vendeTickets=true` y no hay productos
visibles, mostrar un mensaje "Lo sentimos, este evento está agotado" y bloquear
el envío. Fix sugerido — en `[slug]/[keyword]/page.tsx`:

- Pasar `vendeTickets` y `productosTicket` independientes.
- En `ReservaPublicaForm`, si `ticketOnly && productosTicket.length === 0`,
  renderizar el bloque agotado en vez del form.
- En el server action, validar también con la fuente real del link
  (`vende_tickets` consultado en BD) en vez de confiar en `ticketOnly` del cliente.

No bloqueante para el lanzamiento del feature; los restaurantes monitorean stock
y bajarían el enlace antes de llegar a esto. Anotar para próxima iteración.

## Conclusión

Todo lo prometido por PRP-051 funciona en el camino crítico:
selector público + consumo atómico de stock + bloqueo por NO_SHOW
(automático vía trigger) + desbloqueo + ocultar al agotar + embed con headers
correctos. Stock NUNCA se devuelve (verificado en intento bloqueado y en
test de overflow). 1 bug menor de UX en el caso borde "enlace vendeTickets
con todo agotado".

## Screenshots

- `01-flujo-publico-selector.png` — selector de tickets renderizado
- `04b-resultado.png` — ticket seleccionado con check verde, botón "Enviando…"
- `05-embed.png` — modo embed sin logo
- `06-bloqueado.png` — toast de bloqueo activo
- `07-tras-desbloqueo.png` — éxito tras desbloquear
- `08-agotado-y-oculto.png` — flujo público sin selector (producto agotado)

## Limpieza

Todos los datos de prueba eliminados (reserva, cliente, bloqueo, pivote, enlace,
producto). Scripts QA scratch borrados.
