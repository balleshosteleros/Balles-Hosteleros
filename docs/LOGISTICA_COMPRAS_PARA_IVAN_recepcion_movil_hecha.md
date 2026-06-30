# Logística · Compras §5 — Recepción móvil de albaranes (HECHA)

> **De:** Claude (trabajando con Fernando) · **Para:** Iván y su agente · **Fecha:** 2026-06-30
> **Commit:** `c5908b8` (rama main, sufijo `_Fernando`). Reutiliza el backend de escritorio; **no toca esquema ni datos**.

## Qué se ha hecho

La **recepción de albaranes 100% móvil** que pediste. Entrada: en el móvil, **"Más" → Albaranes** (`/m/albaranes`).

**Flujo:**
1. **Bandeja** `/m/albaranes`: lista los **pedidos en estado "Enviado"** (pendientes de recibir) de la empresa.
2. **Recepción** `/m/albaranes/recibir/[pedidoId]`: líneas del pedido con un campo **"Recibido" editable, precargado con lo pedido**. Botón **"Hacer foto del albarán"** → Edge Function `analizar-albaran` → **comparativa de incidencias** (`ComparativaAlbaran`). La foto es **opcional** (si falla o no hay cobertura, se ajusta a mano y se confirma igual).
3. **Confirmar recepción** → crea el albarán con las cantidades **recibidas**, lo marca **"Entregado"** (entra el stock vía `aplicarEntradasAlbaran`) y adjunta la foto + análisis al albarán.

**Decisiones de producto (Fernando):** alcance "completa desde pedido"; cantidades ajustables → **el stock entra = lo recibido** (correcto al instante), la IA solo resalta qué revisar.

## Cómo está construido (reutiliza tu backend, sin duplicar)

- **Reutilizado tal cual:** `createAlbaran`, `updateAlbaranEstado` (`albaranes-actions.ts`), `subirDocumentoAlbaran` (bucket `logistica-albaranes`), Edge Function `analizar-albaran`, `ComparativaAlbaran`, `AlbaranUploadModal`, `listPedidos`/`getPedido`.
- **Nuevo (mínimo):**
  - `src/features/logistica/actions/recepcion-movil-actions.ts` — 1 server action `recibirAlbaranDesdePedido({ pedidoId, recibidos })`: construye las líneas del albarán **desde el pedido en BD** (producto y precio del servidor, cantidad del cliente), crea el albarán y lo marca Entregado. Filtra líneas con `recibido = 0` (faltantes).
  - `src/app/(mobile)/m/albaranes/page.tsx` + `recibir/[pedidoId]/page.tsx` (server).
  - `src/features/logistica/mobile/components/RecepcionInbox.tsx` + `RecepcionAlbaranMobile.tsx` (client).
  - `src/features/mi-panel/mobile/components/MasGrid.tsx` — +1 item "Albaranes".

## Validación

- **Typecheck (proyecto entero) + ESLint: verdes, 0 errores** (sobre el árbol con tus 11 commits ya integrados por rebase).
- `next build` **no ejecutado** (OOM por la RAM de WSL ~3.8 GB; entorno, no código).
- **Pendiente: prueba en vivo.** Necesita un **pedido en estado "Enviado"** (genera uno: reponer por stock → crear pedido → §4 "Enviar al proveedor"). Luego recibirlo desde el móvil y comprobar que el stock sube.

## Notas / fuera de alcance v1

- §5 usa **Supabase Storage** (`logistica-albaranes`, ya existente con RLS por empresa) para la foto del albarán — **no depende del R2** (R2 sigue siendo para los vídeos de formación; ver `LOGISTICA_COMPRAS_PARA_IVAN_siembra_vs_ingest.md` §7).
- **Fuera de v1:** albarán suelto (sin pedido), recibir en móvil albaranes ya creados en escritorio, editar precios en móvil, paso de factura.
- No toca el importador de fichas (PRP-071) ni la siembra ni el esquema.

## ⚠️ Bug encontrado en la prueba en vivo (afecta también a ESCRITORIO)

Al probar §5 en vivo (recepción real, albarán creado y stock correcto) detecté que **el pedido NO pasaba a "Confirmado"** y reaparecía como pendiente. Causa raíz: `createAlbaran` (`src/features/logistica/actions/albaranes-actions.ts`) marca el pedido con:
```
update pedidos set estado='Confirmado', albaran_id=data.id, ...
```
pero **la tabla `pedidos` NO tiene columna `albaran_id`** (verificado en BD: las columnas son almacen, dto_*, enviado_at, estado, fecha*, hora_entrega*, notas, numero*, proveedor_*, total, updated_at — sin `albaran_id`). PostgREST rechaza el `update` entero → el pedido se queda en **"Enviado"**. El mismo problema afecta a `deleteAlbaran` (hace `albaran_id=null`) → al borrar un albarán el pedido no retrocede. En escritorio se enmascara con estado optimista local, pero en BD el pedido no transiciona.

**Fix = AÑADIR la columna** (verificado: además de escribirse, se **LEE** en `PedidosView.tsx:90` → `Pedido.albaranId`, que alimenta el "albarán vinculado" y el bloqueo de borrado del pedido; y **NO existe ninguna migración** que la creara). Quitar la referencia sería peor (habría que reescribir también el lado de lectura).

**Migración LISTA y commiteada:** `supabase/migrations/20260630170000_pedidos_albaran_id.sql` — `ADD COLUMN IF NOT EXISTS albaran_id uuid REFERENCES albaranes(id) ON DELETE SET NULL` + índice + backfill desde `albaranes.pedido_id` (idempotente).

**FALTA APLICARLA A PROD.** No la apliqué yo: el guardarraíl de migraciones de producción lo bloquea (necesita aprobación específica). Aplícala con `supabase db push` (tu flujo normal de migraciones) o pegando el SQL en el editor de Supabase. Una vez aplicada, el `createAlbaran` original ya marca el pedido `Confirmado` solo y el parche de §5 móvil (commit `a9e6e97`) se vuelve redundante (inofensivo).

---

Relacionado: `docs/LOGISTICA_COMPRAS_PARA_IVAN_siembra_vs_ingest.md`, `docs/LOGISTICA_COMPRAS_ESTADO_Y_PLAN.md`.
