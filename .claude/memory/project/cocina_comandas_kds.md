---
name: Panel Comandas (KDS) — submódulo Cocina
description: KDS en /cocina/comandas — kanban realtime de líneas del POS; extiende pos_ticket_lineas con estado_cocina
type: project
---

Panel Kitchen Display System en [/cocina/comandas](src/app/(main)/cocina/comandas/page.tsx). Kanban realtime con 4 columnas (Pendiente → Preparando → Listo → Servido) alimentado por `pos_ticket_lineas` cuando `enviada_at IS NOT NULL`. Feature dir: [src/features/cocina/comandas/](src/features/cocina/comandas/).

**Why:** el POS de PRP-025 envía comandas con "Enviar a cocina" y hasta ahora sólo imprimían ticket físico. El KDS es el consumidor digital realtime que la cocina necesita para tener trazabilidad de tiempos de preparación.

**How to apply:**
- **No duplicar tabla de comandas**: las comandas SON líneas de `pos_ticket_lineas` con `enviada_at`. La migración 037 añade `estado_cocina` (enum), `preparando_at`, `listo_at`, `servido_at`, `partida_id`, `prioridad`.
- **Primer uso de Supabase Realtime** en el repo. La migración 037 añade `pos_ticket_lineas` y `pos_tickets` a la publication `supabase_realtime`. Cliente usa `supabase.channel().on('postgres_changes', ...)` con browser client (no service).
- **Cronómetro global único**: un solo `setInterval(1000)` en [useCronometroGlobal](src/features/cocina/comandas/hooks/useCronometroGlobal.tsx) via context. NO crear un timer por tarjeta.
- **Umbrales de alarma por empresa**: tabla `cocina_alarmas_config` con defaults 8/15/20 min (ámbar/rojo/parpadeo). Leídos por [useUmbralesAlarma](src/features/cocina/comandas/hooks/useUmbralesAlarma.ts).
- **Trigger BD** `pos_linea_sync_timestamps` rellena automáticamente timestamps al cambiar `estado_cocina`. NO confíes en el cliente para setear `preparando_at`/`listo_at`/`servido_at`.
- **Aviso bidireccional POS↔Cocina**: hook [useAvisosCocina](src/features/cocina/comandas/hooks/useAvisosCocina.ts) listo para consumir desde TicketEnVivo/ModalMesas del POS cuando sea necesario (wiring pendiente de petición explícita).
- **Permisos**: roles `admin | director | gerencia | responsable | empleado | cocina | jefe_cocina` (ver [useComandasPermisos](src/features/cocina/comandas/hooks/useComandasPermisos.ts)).
- **POS persiste en BD al enviar a cocina** (PRP-025 Fase 5 completada en misma sesión): [persistir-envio-cocina.ts](src/features/sala/pos/actions/persistir-envio-cocina.ts) crea `pos_tickets` + `pos_ticket_lineas` con `enviada_at`. Al cobrar, `cobrarTicketCompleto` reutiliza ticket vía `ticketIdExistente` — no duplica correlativo.
