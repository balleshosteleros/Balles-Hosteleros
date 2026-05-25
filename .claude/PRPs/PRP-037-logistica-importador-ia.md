# PRP-037: Logística — Importador IA universal

> **Estado**: PENDIENTE
> **Fecha**: 2026-05-21
> **Proyecto**: Balles-Hosteleros

---

## Objetivo

Construir un **importador único con IA** en el módulo de Logística que acepta cualquier archivo del usuario (Excel, CSV, PDF, imagen de albarán, lista pegada como texto) y, sin pedirle plantilla, detecta automáticamente si son proveedores, productos de compra, productos de venta, escandallos o líneas de albarán, mapea las columnas reales contra el esquema interno y devuelve una preview editable antes del insert masivo en BD.

## Por Qué

| Problema | Solución |
|----------|----------|
| Los parsers actuales (`parser-productos.ts`, `parser-proveedores.ts`, `parser-escandallos.ts`) solo aciertan si el archivo tiene cabeceras concretas (`nombre`, `precio compra`, `dias reparto`…). Cualquier desviación → "no se encontraron registros" | Pasar el archivo a Gemini con `responseSchema` para que mapee columnas libres al schema canónico, sin importar idioma, mayúsculas o nombre alternativo |
| Hay tres botones distintos de import (`ImportExportButton`, `ImportExportButtons` de productos, ingestión por PDF) y cada uno usa un flujo distinto | Un único `ImportadorIADialog` reutilizable en Proveedores, Productos (compra y venta), Escandallos y Albaranes |
| Los albaranes en PDF ya tienen un edge function (`analizar-albaran`) pero los productos / proveedores en PDF o foto no se pueden importar | Extender el patrón OCR + Gemini a las cuatro entidades de logística |
| El usuario tiene que pre-clasificar a mano qué entidad está subiendo (proveedor vs producto vs escandallo) | El modelo deduce el tipo de entidad mirando las columnas / contenido; el usuario sólo confirma |

**Valor de negocio**: elimina la fricción de "tienes que rellenar la plantilla", que es la principal barrera de alta de datos de los restaurantes nuevos onboardados. Reduce el tiempo de carga inicial del módulo logística de ~4-6 horas (limpieza manual de Excel del proveedor) a < 10 minutos (subir el archivo original tal cual).

## Qué

### Criterios de Éxito

- [ ] Existe un único componente `ImportadorIADialog` invocable desde Proveedores, Productos (compra/venta), Escandallos y Albaranes
- [ ] El usuario puede subir **.xlsx, .xls, .csv, .pdf, .png, .jpg** sin elegir el tipo de entidad
- [ ] La IA detecta el tipo de entidad con confianza > 0.7 o pide al usuario que elija manualmente
- [ ] La preview muestra: tipo de entidad detectado, filas válidas, filas con warnings, filas descartadas + motivo
- [ ] El usuario puede editar inline los valores antes de confirmar el insert
- [ ] El insert reutiliza las server actions `bulkImport*` existentes (no crear caminos paralelos a BD)
- [ ] Cada llamada a IA queda registrada en `ia_uso_log` con tokens y coste estimado
- [ ] `npm run typecheck` pasa, `npm run build` exitoso
- [ ] Playwright: subir Excel real de Makro como proveedor → preview con N filas → confirmar → registros aparecen en BD

### Comportamiento Esperado

**Happy path:**

1. En `/logistica/productos` (o cualquier vista logística) el usuario hace click en el botón "Importar con IA" (sustituye al menú dropdown actual de Import/Export → Importar).
2. Se abre `ImportadorIADialog` con drop-zone único.
3. Usuario arrastra `Makro_Pedido_Mayo.xlsx`.
4. Frontend extrae texto/celdas (xlsx → JSON; PDF → texto vía pdf-lib; imagen → base64 a Gemini).
5. Server action `analizarImportacionIA()` llama a Gemini con prompt: "Clasifica esto como proveedores | productos_compra | productos_venta | escandallos | albaran. Devuelve los registros canónicos según el schema." `responseSchema` discriminado por tipo.
6. Frontend recibe `{ tipo, confianza, registros[], warnings[] }` y muestra tabla editable con badge de tipo detectado.
7. Si `confianza < 0.7` → muestra selector "¿Es X o Y?" antes de la tabla.
8. Usuario revisa, edita campos con error, descarta filas, y confirma.
9. Se invoca la `bulkImport*` correspondiente y se cierra el dialog con toast de éxito.

**Edge cases cubiertos:**

- Archivo no reconocido → mostrar "No detecté un formato útil. Tipos soportados: …" sin tirar exception
- Archivo > 5MB o > 2000 filas → procesar en chunks por el server, no por el cliente
- Gemini sin API key → mensaje claro al admin (`GeminiKeyMissingError` ya existe)
- Detecta proveedor nuevo dentro de un albarán → ofrecer "crear proveedor X además del albarán" en la misma preview

---

## Contexto

### Referencias

- `src/features/logistica/services/parser-productos.ts` — parser manual actual (se conserva como fallback offline)
- `src/features/logistica/services/parser-proveedores.ts` — idem
- `src/features/logistica/services/parser-escandallos.ts` — idem
- `src/features/logistica/services/parser-excel.ts` — `readSheet`, `getField`, helpers que se reutilizan para extraer celdas antes de pasar a IA
- `src/features/logistica/services/ingest-from-pdfs/parse-excel-escandallos.ts` — referencia de parser específico de Excel "FICHAS TECNICAS"
- `src/features/logistica/components/ImportExportButton.tsx` — botón actual con dropdown Import/Export
- `src/features/logistica/components/productos/ImportExportButtons.tsx` — flujo preview→confirmar de productos (patrón UX a replicar)
- `src/features/logistica/actions/producto-actions.ts` — `bulkImportProductos`
- `src/features/logistica/actions/proveedores-actions.ts` — `bulkImportProveedores` (verificar nombre exacto)
- `src/features/logistica/actions/escandallos-actions.ts` — `bulkImportEscandallos`
- `src/features/logistica/actions/albaranes-actions.ts` — alta de albaranes (ya con OCR vía edge function `analizar-albaran`)
- `src/lib/ia/gemini.ts` — `geminiJSON<T>()` con `responseSchema` (estandar del proyecto)
- `src/features/direccion/presentaciones/services/ia-presentacion.ts` — patrón de uso de Gemini con structured output
- `src/features/gestoria/modelos/services/categorizacion-ia.ts` — segundo patrón de uso de Gemini con clasificación
- `src/features/logistica/types/import.ts` — `ProveedorImport`, `ProductoImport`, `EscandalloImport`, `ImportResult`, `ImportError`
- `.claude/PRPs/PRP-024-auditoria-tecnica-logistica-agora-pos.md` — auditoría previa de logística (criterios Zod + Fail-Safe)
- `.claude/PRPs/PRP-ARCH-001-logistica.md` — arquitectura target de la feature
- `.claude/memory/feedback_configuracion_base_submodulo.md` — patrón obligatorio de SubmoduleToolbar + ResizableColumnsProvider
- `.claude/memory/project_id_secuencial_inmutable.md` — al hacer bulk insert respetar `numero_counters` por empresa

### Arquitectura Propuesta (Feature-First)

```
src/features/logistica/
├── components/
│   └── importador-ia/
│       ├── ImportadorIADialog.tsx          ── dialog único drop-zone + preview
│       ├── ImportadorIADropzone.tsx        ── área de drag-and-drop multi-formato
│       ├── ImportadorIATipoSelector.tsx    ── fallback cuando confianza baja
│       ├── ImportadorIAPreviewTable.tsx    ── tabla editable por tipo de entidad
│       └── ImportadorIAResumen.tsx         ── footer con conteos OK/warning/error
│
├── services/
│   └── importador-ia/
│       ├── extract-file-content.ts         ── xlsx→JSON, pdf→texto, img→base64
│       ├── prompts.ts                      ── prompts de clasificación + extracción
│       └── schemas.ts                      ── Zod + Gemini Schema discriminados
│
├── actions/
│   └── importador-ia-actions.ts            ── server actions: analizarImportacionIA, confirmarImportacionIA
│
└── types/
    └── importador-ia.ts                    ── EntidadDetectada, ResultadoAnalisisIA
```

Reutiliza:
- `actions/producto-actions.ts::bulkImportProductos`
- `actions/proveedores-actions.ts::bulkImportProveedores`
- `actions/escandallos-actions.ts::bulkImportEscandallos`
- `actions/albaranes-actions.ts::crearAlbaran` + edge function `analizar-albaran` para PDFs de albarán

### Modelo de Datos

No requiere tablas nuevas para el flujo principal. Se reutilizan `productos`, `proveedores`, `ft_*` y `albaranes`.

Sí se añade tabla de auditoría de uso (para coste IA y trazabilidad):

```sql
-- Auditoría de cada llamada al importador IA
CREATE TABLE IF NOT EXISTS ia_uso_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id UUID NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id),
  feature TEXT NOT NULL,                    -- 'logistica.importador'
  entidad_detectada TEXT,                   -- 'proveedores' | 'productos_compra' | ...
  confianza NUMERIC(3,2),
  filas_detectadas INT,
  filas_importadas INT,
  modelo TEXT NOT NULL,
  tokens_input INT,
  tokens_output INT,
  archivo_nombre TEXT,
  archivo_tamano_bytes INT,
  error TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE ia_uso_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ia_uso_log_select_propia_empresa" ON ia_uso_log
  FOR SELECT USING (empresa_id = current_empresa_id());

CREATE POLICY "ia_uso_log_insert_propia_empresa" ON ia_uso_log
  FOR INSERT WITH CHECK (empresa_id = current_empresa_id());
```

> Nota: la tabla puede acabar siendo cross-feature (también gestoria, presentaciones, etc.). En Fase 1 se crea sólo si no existe ya; revisar migraciones previas antes de duplicar.

---

## Blueprint (Assembly Line)

> IMPORTANTE: Solo definir FASES. Las subtareas se generan al entrar a cada fase
> siguiendo el bucle agéntico.

### Fase 1: Tipos, schemas y extracción de contenido
**Objetivo**: Tener `types/importador-ia.ts` + `services/importador-ia/extract-file-content.ts` + `services/importador-ia/schemas.ts` listos para alimentar a Gemini. Decidir cómo se transforma cada formato (xlsx → JSON, csv → JSON, pdf → texto, imagen → base64 inline).
**Validación**: `npm run typecheck` pasa; tests unitarios manuales con un xlsx, un csv y un pdf devuelven la estructura intermedia esperada.

### Fase 2: Server action analizadora con Gemini
**Objetivo**: `actions/importador-ia-actions.ts::analizarImportacionIA(payload)` llama a `geminiJSON` con `responseSchema` discriminado (`tipo: 'proveedores' | 'productos_compra' | 'productos_venta' | 'escandallos' | 'albaran'`) y devuelve `{ tipo, confianza, registros, warnings }`. Registra en `ia_uso_log`.
**Validación**: invocar la action desde un script de prueba con un xlsx real de proveedores devuelve `tipo: 'proveedores'` con confianza > 0.7 y al menos 1 registro válido.

### Fase 3: Auditoría `ia_uso_log` (migración Supabase)
**Objetivo**: Crear tabla `ia_uso_log` con RLS si no existe. Confirmar previamente con `list_tables` que no la creó otro PRP.
**Validación**: `list_tables` muestra la tabla; `get_advisors` no marca security warnings; insert manual con `execute_sql` funciona bajo RLS.

### Fase 4: Componentes UI del importador
**Objetivo**: Construir `ImportadorIADialog`, `ImportadorIADropzone`, `ImportadorIATipoSelector`, `ImportadorIAPreviewTable`, `ImportadorIAResumen` siguiendo el estándar de UI del proyecto (Dialog shadcn + Tailwind, sin emojis, sin DropdownMenu adicional dentro de la toolbar).
**Validación**: render en Storybook ad-hoc o página dummy; estados loading / éxito / error / confianza baja se ven correctos.

### Fase 5: Server action confirmadora
**Objetivo**: `confirmarImportacionIA(tipo, registros)` enruta a la `bulkImport*` adecuada según `tipo`. Maneja errores parciales (insertados + fallidos) y devuelve `ImportResult`.
**Validación**: tras confirmar, los datos aparecen en la tabla destino con `numero_secuencial` correcto por empresa; las filas marcadas como descartadas no se insertan.

### Fase 6: Wiring en las vistas
**Objetivo**: Sustituir/añadir el botón "Importar con IA" en `ProveedoresView`, `ProductosView` (compra y venta), pestaña Escandallos y `PedidosView` (sección albaranes). Mantener el flujo manual antiguo escondido como "Importar con plantilla (avanzado)".
**Validación**: cada vista abre el dialog; al confirmar refresca la tabla principal (revalidatePath o invalidate de TanStack Query).

### Fase 7: Validación final y Playwright
**Objetivo**: Sistema funcionando end-to-end con archivos reales (Makro, Mahou, ficha técnica Bacanal).
**Validación**:
- [ ] `npm run typecheck` pasa
- [ ] `npm run build` exitoso
- [ ] Playwright: subir xlsx → preview → confirmar → registros en BD
- [ ] Playwright: subir PDF albarán → detecta `tipo: 'albaran'` → confirma → albarán creado
- [ ] `ia_uso_log` registra cada intento con tokens
- [ ] Criterios de éxito de la sección Qué cumplidos

---

## Aprendizajes (Self-Annealing / Neural Network)

> Esta sección CRECE con cada error encontrado durante la implementación.
> El conocimiento persiste para futuros PRPs. El mismo error NUNCA ocurre dos veces.

_(vacío — se rellenará durante `/bucle-agentico`)_

---

## Gotchas

- [ ] **Gemini structured output con `oneOf` discriminado**: `@google/generative-ai` Schema soporta `anyOf` pero no siempre `discriminator`. Validar el shape devuelto con Zod en server después del parse.
- [ ] **Archivos grandes**: `xlsx` en cliente puede congelar el navegador con > 5 MB. Procesar en el server action (recibir el File en FormData) si supera umbral.
- [ ] **PDFs escaneados (imagen)**: `pdf-lib` extrae texto sólo si es PDF nativo. Para PDFs escaneados → tratar como imagen y pasar a Gemini Vision (modelo `gemini-2.5-flash` ya soporta multimodal).
- [ ] **Coste IA**: limitar tamaño del prompt; truncar a primeras N=500 filas si el archivo es enorme y procesar en chunks.
- [ ] **RLS y `current_empresa_id()`**: la auditoría se inserta desde server action; el contexto de empresa debe venir del helper `lib/supabase-context.ts`, no del cliente.
- [ ] **No duplicar tablas**: antes de crear `ia_uso_log` ejecutar `mcp__supabase__list_tables` — puede que ya exista de otro PRP (`PRP-014` grabar reuniones, `PRP-026` presentaciones).
- [ ] **`numero_secuencial` en bulk insert**: respetar el trigger por empresa (`project_id_secuencial_inmutable.md`); no asignar números desde el cliente.
- [ ] **Combobox dentro de Dialog**: si la preview editable necesita selector de proveedor, usar dropdown nativo (regla `feedback_combobox_dentro_dialog.md`).
- [ ] **Login Google ya estable**: nada relacionado con auth aquí — sólo respetar el contexto de empresa actual al insertar.
- [ ] **No tocar DNS / no nuevas dependencias sin permiso**: `@google/generative-ai` ya está en `package.json`; no añadir `openai` ni otros SDKs.

## Anti-Patrones

- NO crear un parser nuevo por entidad — todos pasan por `analizarImportacionIA` con `tipo` discriminado.
- NO insertar en BD desde el cliente — siempre vía server action.
- NO ignorar `confianza` baja — si < 0.7, exigir confirmación humana del tipo.
- NO hardcodear modelo Gemini en el componente — usar `process.env.GEMINI_MODEL` con fallback (ya implementado en `gemini.ts`).
- NO duplicar lógica de `bulkImport*` — reutilizar las server actions existentes.
- NO eliminar los parsers manuales — quedan como fallback determinista para usuarios que prefieran plantilla.
- NO añadir emojis ni en UI ni en código (regla global del proyecto).
- NO crear archivos .md de documentación adicional fuera de este PRP.

---

*PRP pendiente aprobación. No se ha modificado código.*
