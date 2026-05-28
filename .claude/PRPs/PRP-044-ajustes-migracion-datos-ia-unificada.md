# PRP-044: Ajustes — Migración de datos con IA (sistema unificado one-shot)

> **Estado**: PENDIENTE
> **Fecha**: 2026-05-27
> **Proyecto**: Balles-Hosteleros

---

## Objetivo

Crear en `Ajustes → Migración de datos con IA` un **panel único de onboarding** que centralice la carga inicial de las 5 entidades migrables del software (productos, proveedores, empleados, contactos, escandallos). El usuario sube un documento de cualquier formato (PDF, Excel, CSV, Word, foto) por bloque, una IA lo lee con `geminiJSON` + `responseSchema` derivado del catálogo de submódulos, presenta una preview editable con campos vacíos resaltados y chat opcional para resolver dudas, y al confirmar inserta las filas como `estado=activo` (si cumplen el modo activo de la empresa) o `estado=borrador` (si faltan campos requeridos). Todo a través de un componente reutilizable `<MigracionIADialog entidad="…" />`.

## Por Qué

| Problema | Solución |
|----------|----------|
| Hoy existen 4 dialogos de import IA dispersos (`ImportadorIADialog` logística, `ImportadorIACatalogoDialog`, `ImportadorIAContactosDialog`, `ImportadorIAFacturasDialog`) con UX, schemas y promociones a BD distintos. Onboarding fragmentado. | Un único `<MigracionIADialog>` parametrizado por entidad, con UX idéntica para las 5 entidades migrables (`SUBMODULOS_MIGRABLES`). |
| El usuario que acaba de crear empresa no tiene un sitio claro donde "cargar todo el negocio" y se pierde saltando entre submódulos. | Página central en `Ajustes → Migración de datos` con 5 cards (una por entidad) que muestran estado: No iniciado / Borrador (N pendientes) / Completado. |
| Cuando la IA no rellena todos los campos requeridos del modo activo de la empresa, el usuario hoy no puede continuar — o se le importan registros activos incompletos, contra la regla `feedback_datos_completos_obligatorio`. | Promoción dual: filas con todos los campos requeridos → `estado=activo`; filas con huecos → `estado=borrador` (visible en la vista del submódulo con badge "Pendiente de completar"). |
| El usuario no tiene cómo preguntar a la IA "¿qué pongo en este campo?" durante la revisión. | Chat lateral en el dialog con contexto del archivo + de la fila concreta, mismo cliente Gemini. |
| Cada submódulo migrable tiene su propio `bulkImport*` y un schema Zod distinto. Si en el futuro añadimos un campo obligatorio nuevo nadie sabe dónde tocar. | Centralizar el schema/promoción en `reglas-submodulos-catalogo.ts` (ya existe) + un único `MigracionIAOrchestrator` por entidad. |

**Valor de negocio**: convierte el onboarding de un restaurante nuevo de ~6 horas (carga manual ítem a ítem) a < 30 minutos (subir 5 archivos y revisar). Es el principal cuello de botella en la activación de nuevos clientes SaaS y bloquea actualmente la conversión post-demo.

## Qué

### Criterios de Éxito

- [ ] Existe nueva ruta `/ajustes?tab=migracion` con 5 cards (Productos, Proveedores, Empleados, Contactos, Escandallos) cada una con estado actual (No iniciado / Borrador (N) / Completado) y CTA "Migrar / Continuar migración".
- [ ] Un único componente `<MigracionIADialog entidad="productos|proveedores|empleados|contactos|escandallos" />` cubre las 5 entidades. Cero dialogos paralelos nuevos.
- [ ] Acepta upload de: `.pdf, .xlsx, .xls, .csv, .tsv, .png, .jpg, .jpeg, .webp, .heic, .docx` (Word vía conversión a texto en cliente, o entrega cruda a Gemini si el modelo lo soporta).
- [ ] Cada entidad llama a `geminiJSON` con un `responseSchema` derivado del catálogo `reglas-submodulos-catalogo.ts` (no hay duplicación de schemas).
- [ ] Preview muestra todas las filas, con campos vacíos resaltados en rojo y un contador "X filas completas / Y filas borrador".
- [ ] El usuario puede editar inline cualquier celda, añadir/eliminar filas, y abrir un chat lateral con Gemini para resolver dudas por fila o sobre el archivo entero.
- [ ] Al pulsar "Importar todo": filas con todos los campos del **modo activo de la empresa** → `estado=activo`; filas con cualquier campo requerido vacío → `estado=borrador`. No se aborta el flujo por filas incompletas.
- [ ] Cualquier registro con `estado=borrador` aparece en la vista del submódulo con badge "Pendiente de completar" y NO se cuenta como activo en métricas, listados de selección (ej. selector de proveedor en pedidos) ni exports.
- [ ] Al editar un borrador y completar todos los campos requeridos, se promueve automáticamente a `estado=activo`.
- [ ] El card de cada entidad refleja en tiempo real el conteo de borradores y se marca "Completado" cuando hay ≥ 1 activo y 0 borradores.
- [ ] Cada llamada IA queda en `ia_uso_log` (tokens + coste estimado).
- [ ] `npm run typecheck` pasa, `npm run build` exitoso.
- [ ] Playwright: subir Excel real de productos → preview con filas mixtas (algunas con `unidad` vacía) → confirmar → en `/logistica/productos` las completas salen activas y las incompletas con badge "Pendiente".

### Comportamiento Esperado

**Happy path:**

1. Usuario va a `Ajustes` y abre nueva tab "Migración de datos" (icono `Database` o `Upload`).
2. Ve 5 cards: Productos · Proveedores · Empleados · Contactos · Escandallos. Cada card muestra: nombre, icono, estado actual ("No iniciado" / "Borrador · 3 filas pendientes" / "Completado · 142 activos"), botón principal.
3. Click en "Migrar productos" → abre `<MigracionIADialog entidad="productos" />`.
4. Drop-zone único acepta cualquier archivo soportado. Usuario suelta `catalogo_makro.pdf`.
5. `extraerDeArchivo` (reutiliza `src/features/logistica/lib/importador-ia/extractor.ts`, extendido para `.docx`) devuelve payload tabla o binario.
6. Server action `analizarMigracionIA({ entidad, payload })` llama a `geminiJSON` con `responseSchema` derivado de `CAMPOS_PRODUCTOS` (o el catálogo de la entidad).
7. Frontend recibe `{ filas[], resumen, alertas[] }` y muestra tabla editable con columnas según `CAMPOS_{ENTIDAD}` del catálogo. Campos exigidos por el **modo activo de la empresa** (consultado vía `useReglasSubmodulo`) llevan asterisco y se resaltan en rojo si vacíos.
8. Encabezado del dialog muestra contador: "10 filas — 6 completas (se importarán como activas) · 4 borrador (se importarán como pendientes)".
9. Si el usuario duda en una fila, abre el chat lateral ("Pregunta a la IA"): conversación con contexto del archivo original + fila seleccionada. Puede aplicar la respuesta como sugerencia.
10. Usuario pulsa "Importar todo" → server action `confirmarMigracionIA({ entidad, filas })` clasifica cada fila según campos requeridos del modo activo, inserta con `estado=activo` o `estado=borrador` via la `bulkImport*` correspondiente (que ya se respeta `numero_counters` y RLS).
11. Toast: "Importados 6 productos activos y 4 borradores. Completa los borradores cuando puedas." Dialog se cierra. Card de Productos actualiza estado.
12. En `/logistica/productos` los 4 borradores aparecen con badge amber "Pendiente · faltan campos". Click → modal "Completar producto" con solo los campos faltantes. Al guardar todos los requeridos → promoción automática a `activo`.

**Edge cases cubiertos:**

- Archivo > 20 MB → mensaje claro, sugiere partir.
- Gemini sin API key → `GeminiKeyMissingError` con guía al admin.
- IA devuelve 0 filas → "No detecté datos útiles. ¿Es este un catálogo de [entidad]?" + botón "Probar otra entidad".
- IA confunde entidad (ej. detecta proveedores cuando el usuario pulsó Productos) → banner amarillo "Esto parece más una lista de proveedores. ¿Cambiar a Proveedores?" sin perder el upload.
- Borrador con TODOS los campos requeridos rellenados → promoción automática silenciosa, toast "Producto activado".
- Empresa cambia de modo (básico → avanzado) → borradores que ya no cumplen vuelven a estar incompletos (no se "desactivan" registros activos previos: la promoción solo es upward).
- Multi-empresa: cookie `bh_empresa_activa` decide a qué empresa se importan los datos (respeta `getAppContext()`).

---

## Contexto

### Referencias

- `src/features/ajustes/lib/reglas-submodulos-catalogo.ts` — catálogo de campos por submódulo + `SUBMODULOS_MIGRABLES` + `camposExigidos()`. **Fuente única de verdad** para schemas y campos requeridos.
- `src/features/ajustes/hooks/use-reglas-submodulo.ts` — hook para leer el modo activo de la empresa (basico/estandar/avanzado/personalizado).
- `src/features/contabilidad/components/ImportadorIAContactosDialog.tsx` — patrón UX target (drop-zone → tabla editable → footer con contador faltantes). Se generaliza.
- `src/features/logistica/components/ImportadorIADialog.tsx` — patrón UX de Productos. Se reemplaza por el nuevo componente unificado.
- `src/features/logistica/components/ImportadorIACatalogoDialog.tsx` — patrón de catálogos masivos.
- `src/features/logistica/lib/importador-ia/extractor.ts` — `extraerDeArchivo` reutilizable. Hay que **extender a `.docx`** (mammoth.js en cliente o pasar a Gemini como binario).
- `src/features/logistica/types/importador-ia.ts` — `PayloadExtraido`, `CampoProducto`, `FilaSugerida`.
- `src/features/contabilidad/types/importador-ia.ts` — tipos análogos para contactos.
- `src/features/contabilidad/actions/importador-ia-actions.ts::analizarContactosIA` — patrón server action.
- `src/features/logistica/actions/producto-actions.ts::bulkImportProductos` — promoción a BD. **Hay que añadirles parámetro `estado`**.
- `src/features/logistica/actions/proveedores-actions.ts::bulkImportProveedores` — idem.
- `src/features/cocina/actions/escandallos-actions.ts::bulkImportEscandallos` — idem.
- `src/features/contabilidad/actions/importador-ia-actions.ts::bulkImportContactos` — idem.
- `src/features/rrhh/actions/empleados-actions.ts` — verificar nombre exacto de `bulkImportEmpleados` (puede no existir aún).
- `src/lib/ia/gemini.ts::geminiJSON<T>()` — cliente Gemini con `responseSchema` y attachments multimodales.
- `src/app/(main)/ajustes/page.tsx` — punto donde añadir la nueva tab "Migración de datos".
- `.claude/memory/feedback_datos_completos_obligatorio.md` (referenciada en CLAUDE.md, pendiente crear/leer) — nada se promueve a activo sin tener todos los campos requeridos del modo activo.
- `.claude/memory/project_empresa_activa_cookie.md` — `getAppContext()` debe respetar la cookie `bh_empresa_activa`.
- `.claude/memory/project_rls_multiempresa.md` — toda política RLS con `empresa_id` debe aceptar `profiles.empresa_id ∪ user_empresas`.
- `.claude/memory/project_id_secuencial_inmutable.md` — los bulk insert deben respetar `numero_counters` por empresa.
- `.claude/PRPs/PRP-037-logistica-importador-ia.md` — precedente más cercano, del que se hereda extracción multi-formato y patrón Gemini structured output.

### Arquitectura Propuesta (Feature-First)

```
src/features/ajustes/
├── components/
│   └── migracion/
│       ├── MigracionTab.tsx                  ── tab principal en Ajustes con 5 cards
│       ├── MigracionEntidadCard.tsx          ── card por entidad (No iniciado/Borrador/Completado)
│       ├── MigracionIADialog.tsx             ── dialog único parametrizado por entidad
│       ├── MigracionIADropzone.tsx           ── drop-zone multi-formato (refactor de extractor)
│       ├── MigracionIAPreviewTable.tsx       ── tabla editable, columnas dinámicas por entidad
│       ├── MigracionIAChatPanel.tsx          ── panel lateral chat con Gemini por fila/archivo
│       └── MigracionIAResumen.tsx            ── footer con conteo activas/borrador
│
├── services/
│   └── migracion-ia/
│       ├── schemas.ts                        ── construye Gemini Schema desde reglas-submodulos-catalogo
│       ├── prompts.ts                        ── prompts por entidad (productos, proveedores, …)
│       └── promocion.ts                      ── clasificar fila → activo|borrador según modo activo
│
├── actions/
│   └── migracion-ia-actions.ts               ── server actions:
│                                                 - analizarMigracionIA({ entidad, payload })
│                                                 - confirmarMigracionIA({ entidad, filas })
│                                                 - chatMigracionIA({ entidad, archivo, fila?, pregunta })
│                                                 - getEstadoMigracion() → conteos por entidad
│
└── types/
    └── migracion-ia.ts                       ── EntidadMigrable, FilaMigracion, EstadoMigracion
```

Reutiliza:
- `src/features/logistica/lib/importador-ia/extractor.ts` (con extensión `.docx`)
- `src/features/logistica/actions/producto-actions.ts::bulkImportProductos`
- `src/features/logistica/actions/proveedores-actions.ts::bulkImportProveedores`
- `src/features/cocina/actions/escandallos-actions.ts::bulkImportEscandallos`
- `src/features/contabilidad/actions/importador-ia-actions.ts::bulkImportContactos`
- `src/features/rrhh/actions/empleados-actions.ts::bulkImportEmpleados` (crear si no existe)
- `src/lib/ia/gemini.ts::geminiJSON`

Reemplaza (deprecar en fase final, no borrar todavía):
- `ImportadorIADialog` (logística) → wrapper que invoca al nuevo `<MigracionIADialog entidad="productos" />`
- `ImportadorIAContactosDialog` → idem para `entidad="contactos"`

### Modelo de Datos

Las 5 tablas migrables ya existen. Se añade una columna `estado` a cada una si no la tienen ya. Verificar antes de tocar:

```sql
-- Solo si la columna no existe en cada tabla.
ALTER TABLE productos     ADD COLUMN IF NOT EXISTS estado text NOT NULL DEFAULT 'activo';
ALTER TABLE proveedores   ADD COLUMN IF NOT EXISTS estado text NOT NULL DEFAULT 'activo';
ALTER TABLE empleados     ADD COLUMN IF NOT EXISTS estado text NOT NULL DEFAULT 'activo';
ALTER TABLE contactos     ADD COLUMN IF NOT EXISTS estado text NOT NULL DEFAULT 'activo';
ALTER TABLE fichas_tecnicas ADD COLUMN IF NOT EXISTS estado text NOT NULL DEFAULT 'activo';

-- Check constraint (revisar valores actuales antes de aplicar; si hay otros estados ya en uso, ampliar el dominio).
ALTER TABLE productos     ADD CONSTRAINT productos_estado_chk     CHECK (estado IN ('activo','borrador','archivado'));
-- … idem para las otras cuatro

-- Índice parcial para listar borradores rápido por empresa.
CREATE INDEX IF NOT EXISTS idx_productos_borrador     ON productos     (empresa_id) WHERE estado = 'borrador';
CREATE INDEX IF NOT EXISTS idx_proveedores_borrador   ON proveedores   (empresa_id) WHERE estado = 'borrador';
CREATE INDEX IF NOT EXISTS idx_empleados_borrador     ON empleados     (empresa_id) WHERE estado = 'borrador';
CREATE INDEX IF NOT EXISTS idx_contactos_borrador     ON contactos     (empresa_id) WHERE estado = 'borrador';
CREATE INDEX IF NOT EXISTS idx_fichas_borrador        ON fichas_tecnicas (empresa_id) WHERE estado = 'borrador';
```

Tabla auxiliar (auditoría / progreso por empresa, idempotente):

```sql
CREATE TABLE IF NOT EXISTS migracion_ia_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id UUID NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id),
  entidad text NOT NULL CHECK (entidad IN ('productos','proveedores','empleados','contactos','escandallos')),
  archivo_nombre text,
  archivo_mime text,
  filas_total int NOT NULL DEFAULT 0,
  filas_activo int NOT NULL DEFAULT 0,
  filas_borrador int NOT NULL DEFAULT 0,
  tokens_input int,
  tokens_output int,
  modelo text,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE migracion_ia_jobs ENABLE ROW LEVEL SECURITY;
-- RLS: empresa_id ∈ profiles.empresa_id ∪ user_empresas (mismo patrón que el resto)
```

RLS para columnas `estado` nuevas: las políticas existentes siguen valiendo (filtran por `empresa_id`), pero los listados de cada submódulo deben filtrar `estado = 'activo'` por defecto y permitir `estado IN ('activo','borrador')` solo cuando el usuario está editando o en la vista de pendientes.

---

## Blueprint (Assembly Line)

> IMPORTANTE: Solo se definen FASES. Las subtareas se generan al entrar a cada fase
> siguiendo el bucle agéntico (mapear contexto → generar subtareas → ejecutar).

### Fase 1: Modelo de datos y promoción dual
**Objetivo**: Las 5 tablas migrables tienen columna `estado` con dominio claro, la tabla `migracion_ia_jobs` existe, y RLS+índices están en su sitio. Los listados de cada submódulo respetan por defecto `estado='activo'`.
**Validación**:
- Migración aplicada en Supabase, `\d productos` muestra `estado`.
- Query manual: insertar producto con `estado='borrador'` → no aparece en `/logistica/productos` con filtro default.

### Fase 2: Extractor multi-formato y schemas por entidad
**Objetivo**: `extraerDeArchivo` soporta `.docx` (además de PDF/Excel/imagen). `src/features/ajustes/services/migracion-ia/schemas.ts` genera el `responseSchema` Gemini para las 5 entidades a partir de `reglas-submodulos-catalogo.ts` (sin duplicar el catálogo).
**Validación**:
- Unit test: subir un `.docx` con tabla de productos devuelve `PayloadExtraido` válido.
- Para cada entidad, el `responseSchema` generado contiene exactamente las `keys` declaradas en su `CAMPOS_*`.

### Fase 3: Componente `<MigracionIADialog>` unificado
**Objetivo**: Un solo dialog parametrizado por `entidad` que cubre drop-zone, llamada a `analizarMigracionIA`, preview editable con columnas dinámicas, contador activas/borrador, y chat lateral (`MigracionIAChatPanel`) conectado a `chatMigracionIA`.
**Validación**:
- Storybook (o página de pruebas) renderiza el dialog para cada una de las 5 entidades con datos fake.
- Click en "Pregunta a la IA" abre el panel y responde con `geminiJSON` (modo texto, sin schema).

### Fase 4: Server actions y promoción a activo/borrador
**Objetivo**: `confirmarMigracionIA` clasifica cada fila contra `camposExigidos(submodulo, modo, …)` y llama al `bulkImport*` de la entidad pasando el `estado` correcto. Cada `bulkImport*` acepta y respeta el campo `estado`. Se crea `bulkImportEmpleados` si no existe.
**Validación**:
- Test integración: importar 10 filas (6 completas, 4 incompletas) → en BD aparecen 6 con `estado='activo'` y 4 con `estado='borrador'`.
- `migracion_ia_jobs` registra el job con tokens y conteos.

### Fase 5: Tab "Migración de datos" en Ajustes + cards de estado
**Objetivo**: Nueva tab en `/ajustes` (`tab=migracion`) con 5 cards. Cada card consulta `getEstadoMigracion()` y muestra No iniciado / Borrador (N) / Completado en tiempo real (SWR). CTA abre `<MigracionIADialog entidad="…" />`. Tab visible solo para usuarios con permisos de admin de empresa.
**Validación**:
- Playwright: en empresa de prueba sin datos, la tab muestra los 5 cards en "No iniciado".
- Tras importar productos con 2 borradores, el card Productos muestra "Borrador · 2 filas pendientes".

### Fase 6: Promoción automática al completar borrador + badge en submódulos
**Objetivo**: En la vista de cada submódulo migrable, los registros con `estado='borrador'` muestran badge amber "Pendiente · faltan N campos" y, al editar y guardar con todos los campos requeridos del modo activo, se promueven silenciosamente a `estado='activo'` (toast "Activado"). Los listados de "selección" (ej. selector de proveedor en pedido) filtran `estado='activo'` para no ofrecer borradores como opción.
**Validación**:
- Playwright: abrir borrador desde card → modal "Completar", rellenar campos → badge desaparece, queda como activo.
- En `/logistica/pedidos` nuevo pedido, el selector de proveedor no muestra los proveedores en borrador.

### Fase 7: Deprecación de dialogos legacy
**Objetivo**: `ImportadorIADialog` (logística) y `ImportadorIAContactosDialog` se convierten en wrappers thin que delegan en `<MigracionIADialog>`. Los call sites siguen funcionando sin cambios visibles. `ImportadorIACatalogoDialog` queda como caso especial (catálogo masivo de productos) por ahora — no se migra.
**Validación**:
- En todos los call sites existentes el flujo de import sigue funcionando.
- `grep` confirma que la lógica de UX está en un solo sitio.

### Fase 8: Validación Final
**Objetivo**: Sistema funcionando end-to-end en empresa de prueba.
**Validación**:
- [ ] `npm run typecheck` pasa.
- [ ] `npm run build` exitoso.
- [ ] Playwright cubre las 5 entidades: subir archivo → preview → importar → ver activos + borradores → completar borrador → activo.
- [ ] Tokens IA registrados en `migracion_ia_jobs` para cada job.
- [ ] Multi-empresa: cambiar empresa activa (cookie `bh_empresa_activa`) y verificar que la siguiente migración entra en la empresa correcta.
- [ ] RLS: usuario de otra empresa no ve los borradores ni los jobs ajenos.
- [ ] Criterios de éxito cumplidos.

---

## Aprendizajes (Self-Annealing / Neural Network)

> Esta sección CRECE con cada error encontrado durante la implementación.
> El conocimiento persiste para futuros PRPs. El mismo error NUNCA ocurre dos veces.

_(vacío — se rellena en `/bucle-agentico`)_

---

## Gotchas

- [ ] **`.docx` en cliente**: parsear Word en el browser requiere `mammoth` (~120KB). Alternativa: enviar el binario crudo a Gemini con `inlineData` y dejar que él lo lea (gemini-2.5-flash soporta `.docx` nativamente). Decidir en Fase 2 con un POC.
- [ ] **Promoción automática upward-only**: si la empresa cambia de modo (estándar → avanzado), NO degradar registros activos previos a borrador. Solo upward: borrador → activo cuando se completa.
- [ ] **`bulkImportEmpleados` no existe aún** o usa flujo distinto (crea `auth.users` + `profiles` + `empleados`). Para empleados, el `estado='borrador'` significa "ficha de empleado creada en RRHH pero SIN usuario asociado" — no se crea cuenta auth hasta promoción a activo.
- [ ] **`numero_counters` por empresa** (memory `project_id_secuencial_inmutable.md`): los borradores SÍ consumen número secuencial (no se reusan huecos). Si el usuario borra un borrador, el número queda hueco para siempre.
- [ ] **RLS multi-empresa** (memory `project_rls_multiempresa.md`): todas las nuevas políticas RLS (en `migracion_ia_jobs` y filtros de `estado`) deben aceptar `profiles.empresa_id ∪ user_empresas`.
- [ ] **Empresa activa por cookie** (memory `project_empresa_activa_cookie.md`): `confirmarMigracionIA` debe usar `getAppContext()` y NO `profiles.empresa_id` directo.
- [ ] **Gemini structured output con `oneOf`**: Gemini Schema NO soporta `oneOf` ni `anyOf` en `responseSchema`. Si una entidad necesita uniones (ej. `tipo: 'compra' | 'venta'`), usar `enum` en lugar de unión Zod.
- [ ] **Borradores no aparecen como opción** en selectores cruzados (proveedor → pedido, producto → escandallo, etc.). Cada call site que use `listProveedores()` o equivalentes debe filtrar `estado='activo'` explícitamente. Auditar todos los `listX()` actuales.
- [ ] **Backward compat con dialogos legacy**: las llamadas a `onImportSuccess?.()` deben seguir invalidándose después de la importación con borradores también.
- [ ] **Costes IA**: chat lateral puede multiplicar tokens. Limitar conversación a 8 turnos por archivo y mostrar warning al usuario si excede.
- [ ] **Memory `feedback_datos_completos_obligatorio`** está referenciada en `CLAUDE.md/MEMORY.md` pero el archivo físico no existe en `.claude/memory/feedback/`. Antes de Fase 4, hay que **leer su contenido completo** (preguntar al usuario o crearla a partir de la regla expresada en el prompt del PRP).

## Anti-Patrones

- NO crear un `MigracionIADialogProductos.tsx`, `…Proveedores.tsx`, etc. Un solo componente parametrizado.
- NO duplicar el catálogo de campos: `reglas-submodulos-catalogo.ts` es la fuente única.
- NO hardcodear los campos requeridos por entidad: usar `camposExigidos(submodulo, modo, personalizados)`.
- NO bypassear `bulkImport*`: nada de inserts directos desde el dialog.
- NO crear caminos de promoción a BD que no pasen por RLS.
- NO tocar la tab `Empresas` ni cambiar el flujo de creación de empresa: la migración es opt-in, post-creación.
- NO insertar registros activos incompletos "porque la IA dijo así" — siempre clasificar contra `camposExigidos`.
- NO confundir `estado='borrador'` (faltan campos) con `estado='archivado'` (oculto pero completo).

---

*PRP pendiente aprobación. No se ha modificado código.*
