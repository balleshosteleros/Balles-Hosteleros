# PRP-024: Auditoría Técnica — Integración Logística con Ágora POS

> **Estado**: PENDIENTE
> **Fecha**: 2026-04-14
> **Proyecto**: Balles-Hosteleros

---

## Objetivo

Hacer una auditoría técnica completa del módulo de logística para blindar la integración con Ágora POS: mapear el flujo de datos actual, definir un esquema de validación de entradas, crear un plan Fail-Safe ante caídas de Ágora, y generar un mapa de testeo objetivo para verificar que todos los botones del módulo funcionan correctamente.

## Por Qué

| Problema | Solución |
|----------|----------|
| Los datos de ventas de Ágora (agora_id) se guardan en BD sin validación formal de formato ni integridad | Definir un esquema Zod de validación previo al upsert en la tabla `productos` |
| No existe ningún mecanismo documentado para cuando Ágora no responde o devuelve datos corruptos | Crear un plan Fail-Safe con cola de reintentos y registro de errores en BD |
| Los botones del módulo de logística carecen de un mapa de testeo objetivo y reproducible | Generar un conjunto de tests Playwright que validen cada botón y acción del módulo |
| El flujo de extracción de ventas de Ágora está implícito en `data-productos-venta.ts` (datos hardcodeados) sin un conector real al API de Ágora | Documentar y preparar la arquitectura del conector para cuando Ágora exponga su API |

**Valor de negocio**: Protege la integridad de 74 productos de venta y 98 escandallos ya existentes en BD. Evita inconsistencias de stock y coste que afectan directamente a la rentabilidad del restaurante.

## Qué

### Criterios de Éxito

- [ ] Mapa de flujo de datos Ágora → BD documentado y revisado
- [ ] Schema Zod `agoraVentaSchema` definido y aplicado en la ruta de ingesta
- [ ] Plan Fail-Safe documentado con tabla `agora_sync_log` en BD para registrar errores y reintentos
- [ ] Todos los botones del módulo de logística cubiertos por un test Playwright ejecutable
- [ ] `npm run typecheck` pasa sin errores tras los cambios
- [ ] `npm run build` exitoso

### Comportamiento Esperado

**Happy Path — Sincronización de Ventas desde Ágora:**

1. El sistema ejecuta (manual o periódicamente) la sincronización de ventas de Ágora
2. Los datos recibidos pasan por el schema Zod `agoraVentaSchema` — si un campo falla, se descarta ese registro y se guarda el error en `agora_sync_log`
3. Los registros válidos se hacen upsert en `productos` usando `agora_id` como clave única (índice único `idx_productos_agora` ya existe)
4. Si Ágora no responde: se guarda un registro `{ status: "timeout", error: "...", retry_count: N }` en `agora_sync_log` y se muestra el error exacto al usuario (per Regla Seguridad Ágora)
5. Los tests de Playwright confirman que cada botón de logística ejecuta su acción y no queda en estado de carga infinito

---

## Contexto

### Referencias

- `src/features/logistica/services/ingest-from-pdfs/data-productos-venta.ts` — Fuente actual de datos de venta de Ágora (hardcodeados, 74 productos con agoraId)
- `src/features/logistica/services/ingest-from-pdfs/run-ingest.ts:148-180` — Lógica de combinación de productos venta con agoraId en el upsert inicial
- `src/features/logistica/types/db.ts:35` — Campo `agora_id: string | null` en `ProductoRow`
- `.claude/migrations/001_logistica.sql:52-53` — Índice único `idx_productos_agora` sobre `(empresa_id, agora_id)`
- `src/features/logistica/actions/producto-actions.ts` — Server actions CRUD con Zod (patrón de validación a extender)
- `src/features/logistica/actions/escandallos-actions.ts:84-96` — Lookup de productos por `agora_id` en escandallos
- `.claude/memory/feedback/regla_seguridad_agora.md` — Protocolo obligatorio ante fallos de Ágora: detenerse, mostrar error exacto, pedir aprobación
- `src/features/logistica/lib/supabase-context.ts` — Contexto de autenticación y empresa para todas las operaciones

### Arquitectura Propuesta (Feature-First)

```
src/features/logistica/
├── services/
│   └── agora-sync.ts          # Conector Ágora: fetch → validar → upsert
├── types/
│   └── agora.ts               # AgoraVentaRaw, AgoraVentaValidada (Zod schemas)
├── actions/
│   └── agora-actions.ts       # Server action: syncVentasAgora(), getLastSyncLog()
└── components/
    └── AgoraSyncStatus.tsx    # UI: estado del último sync, errores, botón manual

.claude/migrations/
└── 012_agora_sync_log.sql     # Tabla agora_sync_log para auditoria y reintentos
```

### Modelo de Datos

```sql
-- Migración 012: tabla de registro de sincronizaciones con Ágora
CREATE TABLE IF NOT EXISTS public.agora_sync_log (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id    UUID NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  sync_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  status        TEXT NOT NULL,          -- 'ok' | 'partial' | 'timeout' | 'error'
  total_records INT NOT NULL DEFAULT 0,
  ok_records    INT NOT NULL DEFAULT 0,
  error_records INT NOT NULL DEFAULT 0,
  retry_count   INT NOT NULL DEFAULT 0,
  error_detail  JSONB,                  -- Array de errores por registro
  created_by    UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

ALTER TABLE public.agora_sync_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "empresa propia" ON public.agora_sync_log
  FOR ALL USING (empresa_id IN (
    SELECT empresa_id FROM public.profiles WHERE user_id = auth.uid()
  ));
```

**Zod Schema propuesto** (`src/features/logistica/types/agora.ts`):

```typescript
import { z } from "zod";

// Lo que Ágora devuelve (o lo que viene en el CSV/Excel)
export const agoraVentaRawSchema = z.object({
  agora_id: z.string().min(1, "agora_id obligatorio").regex(/^\d+$/, "agora_id debe ser numérico"),
  nombre: z.string().min(1, "nombre obligatorio").max(255),
  categoria: z.string().min(1, "categoría obligatoria"),
  precio_venta: z.string().optional().nullable(),
});

export type AgoraVentaRaw = z.infer<typeof agoraVentaRawSchema>;
```

---

## Plan Fail-Safe

### Escenarios cubiertos

| Escenario | Comportamiento | Registro en BD |
|-----------|----------------|---------------|
| Ágora no responde (timeout) | Mostrar error exacto, pedir aprobación antes de reintentar | `status: "timeout"` en `agora_sync_log` |
| Ágora devuelve datos malformados | Descartar registro inválido, continuar con los válidos, registrar error | `status: "partial"`, `error_detail` con lista de errores |
| agora_id duplicado en la respuesta | El índice único de BD (`idx_productos_agora`) rechaza el duplicado, se registra | `status: "partial"` |
| Error de autenticación Supabase | Devolver error inmediato, NO escribir nada | No se crea registro en log |
| Sync exitoso | Upsert de todos los registros válidos | `status: "ok"` |

### Política de reintentos

- Máximo 3 reintentos automáticos con backoff exponencial (1s, 2s, 4s)
- Tras 3 fallos: estado `status: "error"` permanente hasta aprobación manual
- Nunca reintentar sin aprobación del usuario (Regla Seguridad Ágora)

---

## Mapa de Testeo — Botones de Logística

### Vistas a cubrir con Playwright

| Vista | Botones/Acciones a verificar |
|-------|------------------------------|
| ProductosView | Crear producto, Editar producto, Eliminar producto, Importar CSV/Excel, Exportar |
| ProveedoresView | Crear proveedor, Editar proveedor, Archivar proveedor |
| PedidosView | Crear pedido, Actualizar estado pedido, Eliminar pedido, Ver detalle |
| InventariosView | Abrir inventario, Guardar conteo, Ver resultado |
| StockView | Editar stock mínimo/máximo, Exportar CSV |
| IncidenciasView | Crear incidencia, Resolver incidencia |

### Criterio objetivo de éxito por test

Un botón pasa el test si:
1. Al hacer click, NO queda en estado loading indefinido (máx 5s)
2. Aparece un toast de éxito O un mensaje de error concreto (no silencio)
3. La tabla/lista refleja el cambio esperado tras la acción

---

## Blueprint (Assembly Line)

> IMPORTANTE: Solo definir FASES. Las subtareas se generan al entrar a cada fase
> siguiendo el bucle agéntico (mapear contexto → generar subtareas → ejecutar)

### Fase 1: Documentar y Formalizar el Flujo de Datos Ágora
**Objetivo**: Crear `src/features/logistica/types/agora.ts` con los schemas Zod, y documentar el flujo completo Ágora → validación → BD en un diagrama de comentarios dentro del código.
**Validación**: El archivo `agora.ts` existe, el schema Zod pasa tests unitarios con datos reales (los 74 productos del `data-productos-venta.ts`).

### Fase 2: Schema de Validación en la Ruta de Ingesta
**Objetivo**: Modificar `run-ingest.ts` y preparar `agora-sync.ts` para que todo dato de Ágora pase por `agoraVentaRawSchema.safeParse()` antes del upsert. Los registros inválidos se descartan y se recopilan en un array de errores.
**Validación**: Introducir un registro con `agora_id: "abc"` (no numérico) y verificar que se rechaza sin detener el proceso.

### Fase 3: Migración y Tabla agora_sync_log
**Objetivo**: Crear la migración `012_agora_sync_log.sql` con la tabla de registro y su RLS. Crear el server action `getLastSyncLog()` en `agora-actions.ts`.
**Validación**: La tabla existe en Supabase, el RLS bloquea acceso a otras empresas.

### Fase 4: Plan Fail-Safe — agora-actions.ts
**Objetivo**: Implementar `syncVentasAgora()` con manejo de timeout, política de reintentos (máx 3) y escritura en `agora_sync_log`. Cumplir la Regla Seguridad Ágora: ante error, mostrar mensaje exacto y pedir aprobación.
**Validación**: Simular timeout (mock de red) y verificar que se graba `status: "timeout"` en `agora_sync_log` y se muestra el error exacto al usuario.

### Fase 5: Mapa de Testeo Playwright
**Objetivo**: Crear el archivo `tests/logistica.spec.ts` con tests E2E para cada botón del módulo de logística (tabla del mapa de testeo). Cada test verifica: click → no loading infinito → toast o cambio visible.
**Validación**: `npx playwright test tests/logistica.spec.ts` pasa sin fallos (o lista los fallos reales para triaje).

### Fase 6: Validación Final
**Objetivo**: Sistema funcionando end-to-end con todas las fases integradas.
**Validación**:
- [ ] `npm run typecheck` pasa sin errores
- [ ] `npm run build` exitoso
- [ ] Playwright screenshot confirma que la UI del módulo de logística carga correctamente
- [ ] `agora_sync_log` tiene al menos un registro de prueba en BD
- [ ] El schema Zod rechaza correctamente datos inválidos de Ágora

---

## Aprendizajes (Self-Annealing / Neural Network)

> Esta sección CRECE con cada error encontrado durante la implementación.

### [2026-04-14]: Zod v4 usa `.issues` no `.errors`
- **Error**: `result.error.errors[0]` — `errors` no existe en Zod v4
- **Fix**: Cambiar a `result.error.issues[0]`
- **Aplicar en**: Cualquier `safeParse()` en el proyecto. El proyecto usa `zod@^4.3.6`.

### [2026-04-14]: `scripts/` debe excluirse del tsconfig
- **Error**: Next.js build incluye `scripts/*.ts` y falla por tipos desactualizados
- **Fix**: Añadir `"scripts"` a `"exclude"` en `tsconfig.json`
- **Aplicar en**: Todo proyecto que tenga carpeta `scripts/` con código de utilidad fuera de src.

### [2026-04-14]: `ProveedoresView.tsx` — campo `nombre` vs `nombreComercial`
- **Error**: `p.nombre` no existe — el tipo `Proveedor` usa `nombreComercial` y `telefonoPrincipal`
- **Fix**: Corregir las propiedades en el export de CSV/XLSX
- **Aplicar en**: Cualquier acceso a campos de `Proveedor` en componentes de logística.

### [2026-04-14]: `CalendarDrawer.tsx` — `setForm` requiere `addMeet`
- **Error**: Al editar evento, `setForm({...})` no incluía `addMeet` (campo obligatorio en type `Form`)
- **Fix**: Hacer spread de `FORM_VACIO` como base antes de los campos del evento
- **Aplicar en**: Cualquier `setForm` en CalendarDrawer que no pase por `FORM_VACIO`.

---

## Gotchas

> Cosas críticas a tener en cuenta ANTES de implementar

- [ ] El índice único `idx_productos_agora` en `(empresa_id, agora_id)` ya existe en BD. Usar upsert con `onConflict: "empresa_id,agora_id"` para no romper registros existentes.
- [ ] Los 74 productos de venta actuales tienen sus `agora_id` hardcodeados en `data-productos-venta.ts`. El schema Zod debe aceptar exactamente ese formato (strings numéricos tipo "1833").
- [ ] La Regla Seguridad Ágora (`.claude/memory/feedback/regla_seguridad_agora.md`) es obligatoria: NUNCA reintentar automáticamente tras un fallo sin aprobación explícita del usuario.
- [ ] El campo `agora_id` en `ProductoRow` es `string | null`. El schema Zod debe reflejar esto: solo los productos de tipo `venta` deben tener `agora_id` no nulo.
- [ ] `getLogisticaContext()` devuelve el cliente Supabase correcto según el entorno (dev bypass vs. producción). Usarlo siempre en lugar de `createClient()` directamente en el módulo de logística.
- [ ] Playwright requiere que la app esté corriendo en local (`npm run dev`) o que se use el base URL configurado. Verificar `.env.test` antes de ejecutar los tests.

## Anti-Patrones

- NO crear un cliente Supabase directo en `agora-sync.ts` — usar `getLogisticaContext()` siempre
- NO ignorar errores de TypeScript en los types de Ágora
- NO hardcodear el endpoint de Ágora — usar variable de entorno `AGORA_API_URL`
- NO omitir validación Zod: todo dato externo (Ágora, CSV, Excel) debe pasar por safeParse antes de tocar BD
- NO usar `localStorage` para guardar datos de sync (Protocolo Guardado Supabase)
- NO intentar arreglar errores de Ágora de forma autónoma — mostrar error, pedir aprobación

---

*PRP pendiente aprobación. No se ha modificado código.*
