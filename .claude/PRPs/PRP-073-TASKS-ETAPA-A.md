# PRP-073 — TASKs de la Etapa A (Fases 1 y 2)

> Generados el 2026-08-04 tras aprobar el PRP (`1cffc0f0`), contra el código real de ese día.
> Numeración continúa la serie del flujo de albaranes (001-008 escritorio, 101-105 móvil).
> Cada TASK acaba con typecheck + lint dirigido verdes. Commits `_Fernando`.
> **Gate de la etapa:** matriz 2/8/12 MB pasa desde móvil; mismo archivo no crea dos
> albaranes; Iván repite su prueba fallida con éxito.

## Hechos verificados que condicionan los contratos

- `getLogisticaContext()` resuelve `empresaId` vía `getEmpresaActivaForUser` (multi-empresa).
  Las políticas Storage de `logistica-albaranes` autorizan por `usuarios.empresa_id`, que
  puede divergir de la empresa activa → **la autorización del path se decide en servidor**
  (credencial firmada emitida por la action), nunca confiando solo en la RLS del bucket.
- Cliente browser Supabase: `src/lib/supabase/client.ts` (singleton) → `uploadToSignedUrl`.
- `albaranes.proveedor_id` ya existe (nullable desde `018_fix_albaranes_schema.sql`);
  hoy nadie lo escribe desde el flujo por foto. `albaranes.documentos` es JSONB.
- Iván subió los buckets a 50 MB (`20260801140000`) y `MAX_DOCUMENTO_MB=50` en
  `src/shared/lib/documentos.ts`, **asumiendo** que los documentos "van directos al bucket".
  Ese supuesto es falso hoy para este flujo (base64 por Server Action, límite real ~10,5 MB);
  la F1 lo hace verdadero → el tope 50 MB se mantiene para la SUBIDA, y el límite del OCR
  (petición a Gemini ~15 MB efectivos) pasa a ser un error claro propio, no un fallo mudo.
- `geminiJSON` acepta `attachments: [{mimeType, base64}]` → el OCR desde Storage es:
  descargar en servidor + base64 interno. El límite de request de la Server Action deja de
  aplicar porque el archivo ya no viaja en el body.
- `browser-image-compression` ya está en `package.json`.
- El trigger de `numero_secuencial` asigna solo cuando llega NULL (no tocar).

---

## Fase 1 — Base fiable de importación

### TASK-201 [SCRIPT+LLM] — Migración `albaran_importaciones` + `albaran_eventos`

- **Archivo:** `supabase/migrations/20260804TTTTTT_albaran_importaciones.sql`.
- **`albaran_importaciones`:** `id uuid pk default gen_random_uuid()`, `empresa_id uuid not null`,
  `created_by uuid`, `flujo text check in ('libre','pedido')`, `pedido_id uuid`, `albaran_id uuid`,
  `estado text check in ('pendiente_subida','subido','analizando','revisable','error','finalizado')`,
  `storage_path text`, `file_name text`, `mime_type text`, `size_bytes bigint`,
  `archivo_sha256 text`, `ocr_resultado jsonb`, `intentos int not null default 0`,
  `error_code text`, `error_message text`, `trace_id text`, `created_at/updated_at`.
  Índice único parcial `(empresa_id, archivo_sha256) where albaran_id is not null`.
  Índices de consulta: `(empresa_id, estado)`, `(empresa_id, archivo_sha256)`.
- **`albaran_eventos`:** `id`, `empresa_id`, `albaran_id`, `importacion_id`, `actor_id`,
  `tipo text`, `payload jsonb` (sin fichero/base64/secretos), `created_at`. **Append-only:**
  RLS con select + insert por pertenencia a empresa; SIN policies de update/delete.
- **`albaranes`:** `add column if not exists importacion_id uuid`.
- RLS de importaciones: select/insert/update por empresa del usuario (patrón de las tablas
  de logística existentes). Sin delete (las huérfanas se limpian por job, fuera de alcance).
- **Validación:** SQL idempotente (`if not exists` / `drop policy if exists`). Se escribe y
  commitea; **ejecutar en prod = OK explícito de Fernando** (Management API, como siempre).

### TASK-202 [LLM] — Tipos de error, eventos y actions de importación

- **Archivos:** nuevo `src/features/logistica/lib/albaranes/importaciones.ts` (tipos
  `FlujoImportacionAlbaran`, `EstadoImportacionAlbaran`, `ErrorImportacionAlbaran`,
  `FalloImportacion { errorCode, message, traceId, retryable }`, mensajes en español por
  código, generador de traceId corto) + nuevo
  `src/features/logistica/actions/importaciones-albaran-actions.ts`.
- **Actions (contrato del PRP):**
  - `iniciarImportacionAlbaran({ flujo, pedidoId?, fileName, mimeType, size })` → valida
    sesión (`AUTH_EXPIRED`), empresa activa (`NO_ACTIVE_COMPANY`), MIME en allowlist
    (imagen/PDF → `UNSUPPORTED_MEDIA`), `size ≤ MAX_DOCUMENTO_BYTES` (`FILE_TOO_LARGE`);
    crea la fila en `pendiente_subida` y devuelve `{ importacionId, path, token }` de
    `createSignedUploadUrl` sobre `logistica-albaranes` en
    `${empresaId}/importaciones/${importacionId}/${nombreSaneado}`.
  - `completarSubidaAlbaran({ importacionId })` → descarga el objeto en servidor, valida
    existencia/tamaño real/cabecera mágica básica (JPEG/PNG/WebP/HEIC/PDF; `file.type` no es
    confiable), calcula **SHA-256 autoritativo en servidor**, guarda `archivo_sha256` y pasa
    a `subido`. Si el objeto no está → `UPLOAD_FAILED` retryable.
  - `analizarImportacionAlbaran({ importacionId })` → estado `analizando`, descarga de
    Storage → base64 interno → OCR (mismo prompt/schema actuales), persiste `ocr_resultado`
    y pasa a `revisable`. Fallo → `error` + `OCR_FAILED`/`OCR_EMPTY` (retryable). Si el
    objeto supera el límite práctico de Gemini (~15 MB) → error claro no-retryable con
    mensaje "hazla de nuevo con menos resolución" (las imágenes ya llegan comprimidas por
    TASK-203; esto cubre PDFs gigantes).
  - `reintentarImportacionAlbaran({ importacionId })` → `intentos+1`, reusa el archivo.
- **Extracción compartida:** el cuerpo OCR de `analizarAlbaranFoto` (prompt + schema +
  normalización de líneas) se extrae a `src/features/logistica/lib/albaranes/ocr-albaran.ts`
  para que la action vieja (escritorio, hasta TASK-203) y la nueva usen EL MISMO extractor.
  `analizarAlbaranFoto` queda como wrapper fino — se retira cuando el hook migre.
- **Eventos:** cada transición escribe en `albaran_eventos`
  (`importacion_creada`, `subida_completada`, `ocr_ok`, `ocr_error`, `reintento`).
- **Validación:** typecheck + lint dirigidos.

### TASK-203 [LLM] — Cliente: compresión + subida directa + reintento en `useSubirAlbaran`

- **Archivos:** `src/features/logistica/hooks/use-subir-albaran.ts` (+ retoques mínimos en
  `SubirAlbaranMobile.tsx` y `SubirAlbaranDialog.tsx` para los estados nuevos).
- **Contrato:**
  - `handleFile`: si es imagen, comprimir con `browser-image-compression`
    (`maxSizeMB≈3, maxWidthOrHeight≈2560, useWebWorker`) con fallback al original si la
    compresión falla; PDF pasa sin tocar. El tope de entrada sigue `MAX_DOCUMENTO_MB` (50).
  - `analizar` v2: `iniciar → uploadToSignedUrl (cliente browser) → completar → analizar`,
    **muere el base64 por Server Action en este flujo**. Progreso visible: paso nuevo
    `subiendo` antes de `analizando`.
  - Estado de error recuperable: si `retryable`, botón "Reintentar" que reusa la importación
    (sin re-hacer la foto); si no, mensaje claro con el código + traceId discreto.
  - `importacionId` queda en el estado del hook para TASK-204.
- **Validación:** typecheck + lint; smoke manual de NO-regresión del diálogo de escritorio.

### TASK-204 [LLM] — Vincular albarán ↔ importación (el original ya vive en Storage)

- **Archivos:** `albaranes-actions.ts`, `importaciones-albaran-actions.ts`, hook.
- **Contrato:** `guardar` pasa `importacionId` a `createAlbaran`; `createAlbaran` persiste
  `importacion_id` y, tras crear, una función servidor
  `adjuntarDocumentoDesdeImportacion({ albaranId, importacionId })` **mueve/copia** el objeto
  de `…/importaciones/…` al path canónico `${empresaId}/${albaranId}/…`, appendea el doc
  (con `analisis`) a `albaranes.documentos`, marca la importación `finalizado` +
  `albaran_id`, y emite evento `albaran_creado`. El `subirDocumentoAlbaran` por FormData
  queda solo para adjuntos manuales posteriores (no en el flujo de foto).
  - Resultado: ya NO puede existir un albarán del flujo foto sin su original (el archivo
    está en Storage ANTES de crear el albarán; si la creación falla, la importación queda
    `revisable` y se reintenta el guardado, no la subida).
- **Validación:** typecheck + lint.

### TASK-205 [LLM+gate] — Validación Fase 1: matriz de tamaños + E2E + deploy

1. Typecheck (`~/_typecheck.sh`) + lint → commit(s) → push → deploy verde (`~/_wait_deploy.sh`).
   (Antes: aplicar la migración de TASK-201 en prod **con OK de Fernando**.)
2. **Matriz de tamaños** (gate del PRP): generar JPEGs sintéticos de ~2, ~8 y ~12 MB y
   subirlos por el flujo móvil (viewport 375×812). Los tres deben terminar en éxito
   (los grandes, comprimidos en cliente) o en error CLARO recuperable — nunca fallo mudo.
3. E2E móvil completo con foto real conocida → albarán en Revisión con original adjunto →
   verificar en BD (`albaran_importaciones` finalizada, eventos, sha256, 0 stock) →
   borrar albarán de prueba.
4. Smoke NO-regresión escritorio.

## Fase 2 — Identidad y duplicados

### TASK-206 [SCRIPT+LLM] — Migración de duplicados

- **Archivo:** `supabase/migrations/20260804TTTTTT_albaranes_duplicados.sql`.
- `albaranes`: `posible_duplicado_de uuid`, `duplicado_override_motivo text`,
  `duplicado_override_por uuid`, `duplicado_override_at timestamptz`.
- Índice único parcial `(pedido_id) where pedido_id is not null` (un solo albarán por pedido).
  **Pre-check obligatorio:** query de violaciones existentes ANTES de aplicar; si hay
  duplicados históricos, decidir con Fernando (no abortar a ciegas).
- Índices de identidad de negocio: `(empresa_id, proveedor_id, numero_proveedor)` y
  `(empresa_id, fecha, proveedor_nombre)`.
- Escribir + commitear; ejecutar en prod con OK.

### TASK-207 [LLM] — Detección de duplicados al guardar

- **Archivos:** `importaciones-albaran-actions.ts`, hook, `SubirAlbaranMobile.tsx`,
  `SubirAlbaranDialog.tsx`.
- **Contrato (política del PRP):**
  1. En `completarSubidaAlbaran`: mismo `archivo_sha256` con albarán ya creado en la
     empresa → **bloqueo** con enlace/número del existente (no se llega ni al OCR).
  2. En `guardar`: candidato fuerte por `proveedor + numero_proveedor` normalizado; si no
     hay número fiable, `proveedor + fecha + total`. Aviso en la UI con el albarán
     coincidente y dos salidas: "Ver el existente" o "Registrar de todos modos" con
     **motivo obligatorio** → `duplicado_override_*` + evento `duplicado_override`.
  3. El flujo por foto empieza a escribir `albaranes.proveedor_id` cuando el proveedor
     elegido en el combobox es uno real de la tabla `proveedores` (identidad, no snapshot).
- **Validación:** typecheck + lint.

### TASK-208 [SCRIPT+LLM] — Backfill `proveedor_id` + re-check al confirmar

- **Backfill:** script one-shot (Management API) que puebla `albaranes.proveedor_id`
  emparejando `proveedor_nombre` normalizado contra `proveedores` de la misma empresa —
  SOLO coincidencia inequívoca; ambiguos y sin match quedan en un informe, no se adivinan.
- **Re-check:** `updateAlbaranEstado` (camino a Entregado/Confirmado) repite la evaluación
  de duplicado de negocio y bloquea si hay coincidencia sin override registrado. (El
  bloqueo bajo transacción llega en F4; aquí es la comprobación previa.)
- **Validación:** typecheck + informe del backfill guardado en `docs/`.

### TASK-209 [gate] — Cierre de la Etapa A

1. E2E de duplicados: subir dos veces el mismo archivo (bloqueo por sha), y dos albaranes
   distintos con mismo proveedor+número (aviso + override con motivo + evento).
2. Deploy verde + verificación en BD.
3. Nota a Iván: Etapa A desplegada, **pedirle que repita su prueba móvil fallida** (gate),
   fin del freeze de los 3 ficheros, y aviso de que su tope de 50 MB ahora sí es verdad
   para la subida (no hizo falta revertirlo: se hizo verdadera su suposición).
4. Actualizar memoria + marcar fases 1-2 ejecutadas en el PRP.
