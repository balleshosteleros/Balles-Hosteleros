# PRP-038: Aperturas — Relleno con IA + Modo Presentación corporativa

> **Estado**: IMPLEMENTADO (typecheck + build OK; validación visual end-to-end pendiente)
> **Fecha**: 2026-05-23
> **Proyecto**: Balles-Hosteleros

---

## Objetivo

Dotar al módulo **Dirección → Aperturas** de dos capacidades nuevas que conviven en la misma vista de un estudio: (1) un botón **"Rellenar con IA"** por pestaña + un botón maestro **"Generar apertura completa"** en la cabecera, que aceptan prompt corto y/o documentos adjuntos (PDF, imagen, Word, Excel) y devuelven los campos del estudio rellenos como sugerencia editable, sin escribir en BD hasta que el usuario confirme; y (2) un **toggle Software ↔ Presentación** en la cabecera del estudio que renderiza las mismas pestañas como un dossier corporativo a pantalla completa (estilo Gamma/Canva), aplicando logo y paleta de `empresas`, navegable por slides o scroll, y exportable a PDF.

## Por Qué

| Problema | Solución |
|----------|----------|
| Rellenar a mano los ~12 sub-bloques de un estudio (Local, Marca, Gastronomía, Ocupación, Procedencia, Destinos, Amortización, Costes, Facturación) lleva varias horas por proyecto y bloquea al usuario en hoja en blanco | Botón "Rellenar con IA" por pestaña + maestro: el usuario describe el proyecto en una frase o sube el dossier que ya tiene en PDF/Word y la IA propone valores en todos los campos |
| Cuando el usuario sí tiene material (memoria del local, plano, ficha de traspaso, presentación PPT) lo está re-tecleando manualmente porque no hay forma de subirla al sistema | Gemini hace OCR + comprensión nativa (ya soportado en `src/lib/ia/gemini.ts` vía `attachments`) sin librerías nuevas |
| El estudio ya rellenado es un formulario denso, válido como software interno pero impresentable a un inversor, banco o socio | Modo Presentación: cada pestaña se rerenderiza como sección/slide con tipografía grande, hero por escenario, logo y paleta de la empresa, fotos del Local, paleta de Marca, KPIs de Escenarios — todo el dossier de inversión en una vista |
| Los usuarios exportan a PDF haciendo screenshots del navegador | Print stylesheet propio del modo Presentación → un "Imprimir / Guardar PDF" del navegador produce un dossier limpio multipágina |
| Cualquier cambio de imagen de marca exige tocar dos sitios | Modo Presentación lee logo y colores de `empresas` (regla activa: `project_imagen_de_marca.md`); cambian ahí, cambian en todos los dossieres automáticamente |

**Valor de negocio**:
- Reduce el tiempo de creación de un estudio de apertura de ~4-6 h a < 30 min (prompt + revisión).
- Convierte el módulo Aperturas en una herramienta de **venta a inversores y banca**, no sólo en una hoja de cálculo glorificada — el dossier ya no se hace fuera (Canva, PowerPoint) sino dentro del SaaS.
- Reutiliza la infra IA (Gemini + `geminiJSON`) y el patrón de importador IA ya consolidado en Logística y Contabilidad (`PRP-037`), sin nuevas dependencias.

## Qué

### Criterios de Éxito

- [ ] Cada pestaña del detalle de un estudio (`Datos`, `Concepto/Local`, `Concepto/Marca`, `Concepto/Gastronomía`, `Ocupación`, `Facturación`, `Costes`, `Inversión/Procedencia`, `Inversión/Destinos`, `Inversión/Amortización`) tiene un botón **"Rellenar con IA"** que abre un `RellenoIADialog` único.
- [ ] El diálogo acepta: (a) prompt corto en `<Textarea>`, (b) hasta N adjuntos (PDF, imagen, Word, Excel; ≤ 10 MB cada uno), o ambos a la vez.
- [ ] Tras "Generar", la IA devuelve un draft con la **forma exacta** del bloque de la pestaña (validado con Zod en server). Los campos que la IA rellena aparecen en el formulario con badge ámbar **"IA"** y fondo sutil ámbar/amber-50.
- [ ] Cada draft tiene controles **Aceptar pestaña** / **Aceptar todo** / **Descartar**; nada se persiste en BD hasta que se acepta.
- [ ] La cabecera del estudio tiene un botón **"Generar apertura completa"** (estilo destacado, `Sparkles`) que reutiliza el mismo diálogo pero con un prompt sistema multi-bloque y devuelve borradores para todas las pestañas en una sola pasada.
- [ ] La cabecera del estudio tiene un **toggle Software / Presentación** (segmented control). En modo Presentación el formulario se sustituye por un dossier full-screen, navegable con `←` / `→` y minimapa lateral.
- [ ] El modo Presentación lee `empresas.logo_url`, `empresas.color`, `empresas.color_secundario`, `empresas.color_texto` y los aplica como variables CSS (`--brand-primary`, `--brand-secondary`, `--brand-text`, `--brand-logo`).
- [ ] El modo Presentación renderiza al menos una **slide por bloque relevante** (Portada, Concepto, Local, Marca, Gastronomía, Ocupación, Escenarios, Inversión, Cierre); KPIs grandes en Escenarios; galería de fotos en Local; paleta y logo en Marca; carrusel de platos en Gastronomía; heatmap en Ocupación; gráficas en Facturación/Costes.
- [ ] **Imprimir** desde modo Presentación produce un PDF multipágina sin barras ni botones (print stylesheet propio).
- [ ] Cada llamada IA queda registrada en la tabla común `ia_uso_log` con `feature = 'aperturas.relleno'` o `'aperturas.generacion_completa'`.
- [ ] `npm run typecheck` pasa; `npm run build` exitoso.
- [ ] Playwright: (a) crear estudio → "Generar apertura completa" con prompt → confirmar todas las pestañas → datos en BD; (b) abrir estudio → toggle Presentación → navegar slides; (c) imprimir Presentación → PDF generado sin chrome.

### Comportamiento Esperado

**Happy path — Relleno por pestaña:**

1. Usuario abre `/direccion/aperturas` → selecciona un estudio existente o crea uno con sólo el nombre.
2. Entra a la pestaña `Concepto → Gastronomía`. Encuentra el botón **"Rellenar con IA"** (esquina superior derecha de la tarjeta principal).
3. Abre el diálogo. Escribe: *"Cocina mediterránea de mercado, ticket 35€, 12 platos, foco en pescado fresco"*. (Opcionalmente arrastra el PDF de la carta vieja.)
4. Click en *Generar*. Spinner ~5-15 s.
5. Diálogo se cierra y la pestaña Gastronomía ahora tiene `concepto`, `descripcion`, `estiloServicio`, `rangoPrecioMedio`, `numeroPlatosCarta`, y 8-12 `platos` rellenos. Todos con badge ámbar "IA".
6. Usuario edita un par de precios, descarta un plato.
7. Click en **Aceptar pestaña**. Los badges desaparecen, los valores quedan como propios; debounce de guardado normal a Supabase.

**Happy path — Apertura completa:**

1. En la cabecera del estudio (junto al nombre) el botón **"Generar apertura completa"** (Sparkles + texto, destacado).
2. Diálogo con tabs `Prompt | Documentos`. Usuario sube `Dossier_local_Chamberi.pdf` (12 páginas con plano, fotos, memoria descriptiva, traspaso, condiciones de alquiler).
3. Click *Generar*. El server hace **una** llamada Gemini multimodal con un prompt sistema que pide los **todos** los bloques del schema canónico (Local, Marca, Gastronomía, Ocupación, Datos básicos). Excluye bloques estrictamente numéricos (Costes / Facturación / Procedencia / Destinos / Amortización) que se incluyen sólo si la IA encuentra cifras explícitas.
4. UI muestra progreso por pestaña ("Local ✓ — Marca ✓ — Gastronomía…").
5. Al terminar, todas las pestañas tienen borradores IA (badges ámbar). El usuario navega y acepta una a una o **Aceptar todo** desde la cabecera.

**Happy path — Modo Presentación:**

1. Usuario edita estudio. Click en segmented control `Software | Presentación` → modo Presentación.
2. Full-screen oscuro. Logo y colores de la empresa activos. Slide 1 = portada: logo + nombre del proyecto + ciudad/zona.
3. Flechas `←/→` o scroll (decisión a tomar — ver Decisiones abiertas) avanzan slide a slide: Concepto, Local (galería), Marca (paleta + claim), Gastronomía (platos destacados), Ocupación (heatmap por escenario), Escenarios (KPI grandes), Inversión.
4. Botón flotante **Imprimir** abre el diálogo nativo del navegador con el print stylesheet activo.
5. `Esc` o click en `Software` vuelve al formulario.

**Edge cases cubiertos:**

- Sin `GEMINI_API_KEY` → toast claro al admin, ningún botón crashea (`GeminiKeyMissingError` ya tipado).
- Adjuntos > 10 MB cada uno o > 5 adjuntos → rechazar en cliente con mensaje claro.
- Prompt vacío y sin adjuntos → botón Generar deshabilitado.
- IA devuelve JSON inválido / mismatch contra Zod → server registra error en `ia_uso_log`, devuelve `{ ok:false, error }` y el draft queda vacío con un toast.
- Usuario descarta el draft → estado original intacto.
- Modo Presentación sin paleta en `empresas` → fallback a paleta por defecto (tokens del theme).
- Print en navegador que no respeta `@page` → degradación grácil; la slide se corta pero sigue legible.
- Estudio con foto principal o galería vacía → la slide de Local muestra placeholder con icono `ImagePlus`, no se rompe el layout.

---

## Contexto

### Referencias

**Datos y schema del estudio**
- `src/features/direccion/data/aperturas.ts` — todas las interfaces (`DatosProyecto`, `BloqueLocal`, `ImagenMarcaEstudio`, `PropuestaGastronomica`, `BloqueOcupacion`, `EstructuraCostes`, `EstructuraFacturacion`, `LineaProcedencia`, `LineaDestino`, `LineaAmortizacion`, `EstudioApertura`) + helpers `*Inicial()` que ya definen los defaults.
- `src/features/direccion/actions/estudios-apertura-actions.ts` — `updateEstudioApertura()` es la única vía de persistencia. El relleno IA se limita a cambiar el `EstudioApertura` en cliente; la persistencia se reutiliza tal cual.

**Vista actual**
- `src/features/direccion/components/AperturasView.tsx` (2502 LoC) — contiene cabecera + Tabs principales (`datos`, `concepto`, `facturacion`, `costes`, `escenarios`, `inversion`). `concepto` anida sub-tabs (`local`, `marca`, `gastronomia`). Aquí van los nuevos botones por pestaña + el toggle Software/Presentación + el botón "Generar apertura completa".
- `src/features/direccion/components/aperturas/{LocalTab,MarcaTab,GastronomiaTab,OcupacionTab,ProcedenciaTab,DestinoTab,AmortizacionTab}.tsx` — cada tab acepta `value` + `onChange`. El botón "Rellenar con IA" se monta en el chrome de cada tab, pero la lógica vive fuera (en el dialog y en el server action).

**Patrón IA a replicar (decisivo)**
- `src/features/contabilidad/actions/importador-ia-actions.ts` — patrón limpio de Schema + INSTRUCCION + `geminiJSON` con `attachments`. `analizarFacturasIA` / `analizarContactosIA` son los hermanos directos de las nuevas `analizarRellenoIA` / `generarAperturaCompletaIA`.
- `src/features/contabilidad/components/ImportadorIAContactosDialog.tsx` — patrón de UI (dropzone + revisión + commit). El `RellenoIADialog` lo simplifica: una sola fila (= un solo bloque), sin tabla editable.
- `src/features/contabilidad/components/ImportadorIAFacturasDialog.tsx` — confirma el flow client-side.
- `src/features/logistica/lib/importador-ia/extractor.ts` — `extraerDeArchivo(file)` ya soporta xlsx/csv/pdf/imagen y devuelve `PayloadExtraido`. Se reutiliza tal cual; sólo hay que añadir soporte para `.doc/.docx` (ver Gotchas) o tratarlos como binario pasado a Gemini.
- `src/features/logistica/types/importador-ia.ts` — `PayloadExtraido` (kind `tabla` | `binario`).

**Cliente Gemini**
- `src/lib/ia/gemini.ts` — `geminiJSON<T>(prompt, { responseSchema, attachments, systemInstruction, temperature })`. Soporta adjuntos `{ mimeType, base64 }` inline. Ya retorna `tokensInput/tokensOutput` para `ia_uso_log`.

**Imagen de marca (fuente de verdad)**
- `src/features/empresa/actions/empresas-actions.ts` — `getEmpresas()` proyecta `logo_url`. Para presentación necesitamos también `color`, `color_secundario`, `color_texto`.
- `src/features/empresa/actions/logo-actions.ts::getBrandConfig(empresaSlug)` — devuelve `{ logoUrl, colorPrimario, colorSecundario, colorTexto, ... }`. Reutilizable directo en el modo Presentación.
- `.claude/memory/project_imagen_de_marca.md` — regla activa: la fuente de verdad es `empresas.*`, no `empresa_logos`. El modo Presentación **debe** leer de `empresas`.

**Presentación corporativa (precedente interno)**
- `src/features/direccion/presentaciones/components/PresentarView.tsx` — patrón ya en uso de slides full-screen con `←/→`, `Esc`, contador `i/N`. Se reutiliza la mecánica (hook de teclado + chrome auto-hide), pero el contenido lo aporta cada pestaña del estudio.
- `src/features/direccion/presentaciones/components/PrintView.tsx` — patrón de print stylesheet (`@page`, oculta chrome, asegura `break-inside: avoid`). Plantilla para el "Imprimir / PDF" del nuevo modo.
- `src/features/direccion/presentaciones/components/SlideRenderer.tsx` — patrón de aplicar `branding` (logo + colores) como variables CSS en el contenedor.

**Auditoría IA**
- Tabla `ia_uso_log` (introducida en `PRP-037-logistica-importador-ia.md`). **Reutilizar**, no duplicar. Confirmar existencia con `mcp__supabase__list_tables` antes de tocar nada. Si no existe aún, esta feature **no** la crea — depende de que `PRP-037` haya ejecutado la migración. Si `PRP-037` no ha llegado a Fase 3, el bucle agéntico de este PRP se detiene y notifica.

**Reglas de proyecto activas a respetar**
- `.claude/memory/feedback_combobox_dentro_dialog.md` — si el dialog necesita selectores con búsqueda, dropdown nativo.
- `.claude/memory/feedback_titulo_pagina.md` — el header de página no se duplica dentro del cuerpo. El modo Presentación lleva su propio título (es otra vista).
- `.claude/memory/feedback_cambios_multi_tenant.md` — todo lo nuevo es código compartido entre empresas; nada se hardcodea para BACANAL ni HABANA.
- `.claude/memory/project_imagen_de_marca.md` — leer logo + colores de `empresas`, no de `empresa_logos`.

### Arquitectura Propuesta (Feature-First)

```
src/features/direccion/
├── components/
│   ├── AperturasView.tsx                       ── (modificado) integra botones IA + toggle modo
│   ├── aperturas/
│   │   ├── LocalTab.tsx                        ── (modificado) acepta props `iaDraft`, `onAcceptIA`, `onRellenarIA`
│   │   ├── MarcaTab.tsx                        ── idem
│   │   ├── GastronomiaTab.tsx                  ── idem
│   │   ├── OcupacionTab.tsx                    ── idem
│   │   ├── ProcedenciaTab.tsx                  ── idem
│   │   ├── DestinoTab.tsx                      ── idem
│   │   ├── AmortizacionTab.tsx                 ── idem
│   │   └── shared/
│   │       ├── BotonRellenarIA.tsx             ── botón uniforme con icono Sparkles
│   │       ├── BadgeSugerenciaIA.tsx           ── badge ámbar "IA" para campos pendientes
│   │       └── BarraConfirmarIA.tsx            ── footer flotante por pestaña (Aceptar / Descartar)
│   │
│   └── aperturas/ia/
│       ├── RellenoIADialog.tsx                 ── dialog único multimodo (pestaña sola | apertura completa)
│       ├── RellenoIADropzone.tsx               ── área multi-archivo (PDF/img/docx/xlsx)
│       └── RellenoIAProgreso.tsx               ── lista de pestañas con check/loader (modo "completa")
│
│   └── aperturas/presentacion/
│       ├── ModoPresentacion.tsx                ── contenedor full-screen + branding tokens + navegación
│       ├── SlidesAperturaRenderer.tsx          ── enruta cada pestaña a su componente slide
│       ├── PresentacionMinimapa.tsx            ── thumbnails laterales tipo PPT
│       ├── PresentacionPrintLayout.tsx         ── layout específico de impresión (print stylesheet)
│       └── slides/
│           ├── SlidePortada.tsx
│           ├── SlideConcepto.tsx
│           ├── SlideLocal.tsx                  ── galería de fotos + ubicación + características
│           ├── SlideMarca.tsx                  ── claim + paleta + tipografía + logo
│           ├── SlideGastronomia.tsx            ── platos destacados + categorías de venta
│           ├── SlideOcupacion.tsx              ── heatmap por escenario
│           ├── SlideEscenarios.tsx             ── KPIs grandes + gráficas (mismas que software)
│           ├── SlideInversion.tsx              ── procedencia/destinos/amortización resumido
│           └── SlideCierre.tsx                 ── llamada a acción / contacto
│
├── actions/
│   └── aperturas-ia-actions.ts                 ── server actions: analizarRellenoIA, generarAperturaCompletaIA
│
├── services/
│   └── aperturas-ia/
│       ├── prompts.ts                          ── prompts sistema por pestaña + maestro
│       ├── schemas.ts                          ── Schema (Gemini) + Zod por bloque del estudio
│       └── merge.ts                            ── helpers para mergear draft IA sobre EstudioApertura
│
└── types/
    └── aperturas-ia.ts                         ── DraftIAEstudio, EstadoBorradorPorBloque, ResultadoGeneracionCompleta
```

Reutiliza directo:
- `src/features/logistica/lib/importador-ia/extractor.ts::extraerDeArchivo` para PDF/imagen/Excel/CSV.
- `src/features/empresa/actions/logo-actions.ts::getBrandConfig` para tokens del modo Presentación.
- `src/features/direccion/actions/estudios-apertura-actions.ts::updateEstudioApertura` para la persistencia tras aceptar.
- Mecánica de slides + chrome auto-hide de `presentaciones/components/PresentarView.tsx`.

### Modelo de Datos

**Decisión: estado borrador IA vive en cliente, no en BD.**

Ventajas:
- No necesita migración nueva en `estudios_apertura`.
- El draft sólo es útil mientras el usuario está revisando; si cierra sin aceptar, el descarte es implícito.
- Cero riesgo de quedarnos con un campo `ia_draft jsonb` huérfano en producción.

Excepción: si el usuario refresca la pestaña a mitad de revisión perdería el borrador. Aceptable en Fase piloto. Si en pruebas se ve como bloqueante, en una Fase posterior añadir:

```sql
ALTER TABLE estudios_apertura
  ADD COLUMN IF NOT EXISTS ia_draft jsonb,
  ADD COLUMN IF NOT EXISTS ia_draft_at timestamptz;
```

…protegido por RLS existente (`empresa_id = current_empresa_id()`). **No** se introduce en este PRP; queda como decisión diferida (ver Decisiones abiertas).

**Reutilización (no creación) de `ia_uso_log`:**

```sql
-- Ya existe (creada por PRP-037). Confirmar con list_tables antes de cualquier paso.
-- Insertar con:
INSERT INTO ia_uso_log
  (empresa_id, user_id, feature, entidad_detectada, confianza,
   filas_detectadas, filas_importadas, modelo,
   tokens_input, tokens_output, archivo_nombre, archivo_tamano_bytes, error)
VALUES (..., 'aperturas.relleno' | 'aperturas.generacion_completa', ...);
```

`feature` discrimina origen. `entidad_detectada` se usa para el bloque (`local`, `marca`, `gastronomia`, …) o `apertura_completa`. `filas_detectadas`/`filas_importadas` se reusan como `bloques_propuestos`/`bloques_aceptados` (semántica laxa pero suficiente para coste y debug).

**Lectura de branding desde `empresas` (sin nuevas columnas):**

```text
empresas.logo_url        → CSS var --brand-logo
empresas.color           → CSS var --brand-primary
empresas.color_secundario → CSS var --brand-secondary
empresas.color_texto     → CSS var --brand-text
```

---

## Prompts Gemini — Estructura por bloque

Los prompts sistema viven en `services/aperturas-ia/prompts.ts`. **No se embeben en componentes ni en server actions**; se importan.

Cada prompt tiene la misma anatomía:

```text
ROL: Eres un consultor de aperturas de restaurantes en España.
TAREA: A partir del PROMPT del usuario y los DOCUMENTOS adjuntos (si los hay),
       devuelve un objeto JSON con la forma del schema {{NombreBloque}}.
REGLAS:
  - No inventes cifras si no hay base. Deja null/0 si no se infiere.
  - Idioma siempre español.
  - Direcciones: ciudad y código postal en formato español.
  - Importes en euros, decimal con punto.
  - Si el doc adjunto es un plano o foto, usa lo que veas (m², fachada, terraza).
  - Confianza implícita: prefiere null antes que rellenar mal.
ESQUEMA: <responseSchema>
SALIDA: SOLO el objeto JSON, sin texto envolvente.
```

Schemas por bloque (resumen):

| Bloque | Tab destino | Campos clave a inferir |
|---|---|---|
| `datos` | Datos | `nombre, ciudad, zona, poblacion, afluencia, tipoLocal, metrosCuadrados, ticketMedio, clientesEstimados, estacionalidad, competencia, observaciones` |
| `local` | Concepto → Local | `caracteristicas.* (tipoEstablecimiento, metrosUtiles, metrosTerraza, plazas, plantas, banos, acceso, estadoLocal, licenciaActividad, salidaHumos, alquilerMensual, traspaso, duracionContrato, observaciones)` + `ubicacion (direccion, ciudad, codigoPostal, pais, lat?, lng?)` |
| `marca` | Concepto → Marca | `claim, descripcion, publicoObjetivo, valores[], tipografiaTitulares, tipografiaCuerpo, paleta[{nombre, hex}]` |
| `gastronomia` | Concepto → Gastronomía | `concepto, descripcion, estiloServicio, rangoPrecioMedio, numeroPlatosCarta, platos[{nombre, descripcion, precio, categoria}], categoriasVenta[{nombre, porcentaje}]` |
| `ocupacion` | Ocupación | 3 escenarios fijos con `matriz[dia][franja]` 0..100; pide a la IA estimación realista por escenario |
| `costes` | Costes | `{generales, personal, producto, marketing}.partidas[{nombre, fijo, variablePct}]` — sólo si la IA encuentra cifras concretas en los docs; si sólo hay prompt verbal, **dejar vacío** (no improvisar costes) |
| `facturacion` | Facturación | `{franjas, acuerdos, eventos, tienda}.partidas[]` — mismo criterio que costes |
| `procedencia` / `destinos` / `amortizacion` | Inversión | Líneas con `fecha, importe, concepto, ...` — sólo si están en docs |

Prompt **maestro** (apertura completa): combina todos los bloques en un solo `responseSchema` con `type: OBJECT, properties: { datos, local, marca, gastronomia, ocupacion }` y deja los bloques numéricos opcionales y vacíos por defecto. Si el usuario marca explícitamente "incluir cifras" en el dialog, se añaden costes/facturación.

---

## Modo Presentación — Decisiones de diseño

**Navegación propuesta**: **Slides con `←/→` + minimapa lateral** (estilo PPT/Keynote).
- Más natural para audiencia inversora (paginado claro).
- Mejor para `window.print()` → cada slide = 1 página.
- Scroll cinematográfico se descarta como primario: rompe el paginado para PDF y obliga a Intersection Observer + animaciones que no aportan valor en un dossier financiero.

**Tokens de branding**: en el `<div>` raíz del modo Presentación:

```tsx
<div
  style={{
    "--brand-primary": brand.color ?? "#1d4ed8",
    "--brand-secondary": brand.colorSecundario ?? "#0f172a",
    "--brand-text": brand.colorTexto ?? "#ffffff",
    "--brand-logo": `url(${brand.logoUrl ?? ""})`,
  } as React.CSSProperties}
>
```

Las slides usan `bg-[var(--brand-primary)]`, `text-[var(--brand-text)]`, etc.

**Print stylesheet** (`PresentacionPrintLayout.tsx`):

```css
@media print {
  @page { size: A4 landscape; margin: 0; }
  body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .slide { page-break-after: always; break-inside: avoid; }
  .no-print { display: none !important; }
}
```

**Ruta vs toggle**: ver Decisiones abiertas.

---

## Blueprint (Assembly Line)

> IMPORTANTE: Solo definir FASES. Las subtareas se generan al entrar a cada fase
> siguiendo el bucle agéntico (mapear contexto → generar subtareas → ejecutar).

### Fase 0: Verificación de dependencias
**Objetivo**: Confirmar que `ia_uso_log` existe (creada por PRP-037), que `GEMINI_API_KEY` está en `.env`, y que `extraerDeArchivo` admite `pdf, png, jpg, webp, xlsx, csv`. Si `.doc/.docx` no está cubierto, decidir si se añade mammoth o se rechaza con mensaje claro.
**Validación**: `mcp__supabase__list_tables` muestra `ia_uso_log`; tres llamadas manuales a `extraerDeArchivo` (pdf, imagen, xlsx) devuelven `PayloadExtraido` válido.

### Fase 1: Tipos, schemas Zod y prompts
**Objetivo**: Crear `types/aperturas-ia.ts`, `services/aperturas-ia/schemas.ts` (Schema Gemini + Zod por bloque) y `services/aperturas-ia/prompts.ts` (instrucciones sistema). Los Zod deben validar lo que devuelve Gemini y rechazar campos extra.
**Validación**: `npm run typecheck` pasa; tests manuales con JSON sintético validan/rechazan correctamente cada bloque.

### Fase 2: Server actions IA
**Objetivo**: `actions/aperturas-ia-actions.ts` expone:
- `analizarRellenoIA({ bloque, prompt, attachments, estudioActual })` → devuelve `{ ok, draft, tokens }`
- `generarAperturaCompletaIA({ prompt, attachments, estudioActual })` → devuelve `{ ok, drafts: Record<bloque, draft>, tokens }`
Ambas registran en `ia_uso_log` con `feature` correcto y normalizan el resultado contra el Zod del bloque.
**Validación**: invocar las actions con un prompt real ("restaurante asiático en Chamberí") devuelve un draft que valida el Zod, y se inserta una fila en `ia_uso_log`.

### Fase 3: UI compartida — Dialog + Badge + Barra de confirmación
**Objetivo**: Construir `RellenoIADialog`, `RellenoIADropzone`, `RellenoIAProgreso`, `BotonRellenarIA`, `BadgeSugerenciaIA`, `BarraConfirmarIA`. El dialog acepta props `modo: "bloque" | "completa"` y `bloque?: BloqueKey`. Sin guardado a BD; sólo emite `onDraft(draft)`.
**Validación**: render en una página dummy con un onDraft que `console.log` el resultado; el dialog abre, sube archivo, llama a la action, muestra spinner, cierra, no rompe layout.

### Fase 4: Piloto en una pestaña (Gastronomía)
**Objetivo**: Cablear el flow completo **sólo** en `GastronomiaTab.tsx`. Mantener todas las demás tabs intactas para acotar riesgo. La tab acepta `iaDraft?: Partial<PropuestaGastronomica>` y renderiza badges en los campos que vienen del draft. `AperturasView` mantiene el draft en `useState` por bloque y lo pasa hacia abajo. `BarraConfirmarIA` con `Aceptar pestaña` y `Descartar`.
**Validación**: prompt → draft → editar manualmente un plato → Aceptar → estudio en BD tiene los datos. Descartar → estudio no cambia. Playwright captura screenshot del estado "draft con badges ámbar".

### Fase 5: Escalar a las demás pestañas
**Objetivo**: Replicar el patrón en `DatosTab` (inline en AperturasView), `LocalTab`, `MarcaTab`, `OcupacionTab`, y las tres de Inversión. **Costes y Facturación** se conectan pero el prompt deja claro que no inventa cifras; sólo rellena si los docs las traen.
**Validación**: cada tab abre el dialog, recibe draft válido, acepta y persiste. `npm run typecheck` pasa.

### Fase 6: Botón maestro "Generar apertura completa"
**Objetivo**: En cabecera del estudio. Mismo dialog en modo `completa`. Server action devuelve todos los drafts en una llamada. UI muestra `RellenoIAProgreso` (lista de bloques con check/loader) durante la generación. Botones globales "Aceptar todo" / "Descartar todo" en cabecera.
**Validación**: prompt único + dossier PDF → todas las pestañas con borradores → Aceptar todo → persistencia completa.

### Fase 7: Modo Presentación — esqueleto + branding tokens
**Objetivo**: `ModoPresentacion` full-screen, toggle Software/Presentación en cabecera, lectura de branding de `empresas` vía `getBrandConfig`, contenedor con variables CSS aplicadas, slide `Portada` funcionando con logo + nombre + ciudad. Navegación `←/→` + `Esc` reutilizando hook de `PresentarView`.
**Validación**: toggle entra/sale del modo; logo y colores visibles; teclas navegan slide vacía + portada.

### Fase 8: Modo Presentación — slides por bloque
**Objetivo**: Implementar las slides restantes (`Concepto`, `Local`, `Marca`, `Gastronomía`, `Ocupación`, `Escenarios`, `Inversión`, `Cierre`). Reutilizar componentes de gráficas existentes (`recharts` ya está en AperturasView). Galería del Local con grid; paleta de Marca con swatches; platos de Gastronomía en grid 3x3; heatmap de Ocupación copiado del software.
**Validación**: cada slide renderiza con datos reales de un estudio Bacanal; layout responsive entre 1280x720 y 1920x1080; no hay overflow horizontal.

### Fase 9: Minimapa + impresión
**Objetivo**: `PresentacionMinimapa` lateral con thumbnails (puede ser texto del título por slide en Fase 9; thumbnails reales en una iteración futura). `PresentacionPrintLayout` con `@media print` que oculta chrome, fuerza `page-break-after: always`, `print-color-adjust: exact`. Botón "Imprimir / PDF" llama a `window.print()`.
**Validación**: `Cmd+P` desde modo Presentación abre el diálogo de impresión; PDF resultante tiene 1 slide por página, sin chrome, con colores correctos.

### Fase 10: Validación final + Playwright
**Objetivo**: Sistema end-to-end con datos reales.
**Validación**:
- [ ] `npm run typecheck` pasa
- [ ] `npm run build` exitoso
- [ ] Playwright: crear estudio → "Generar apertura completa" con prompt → Aceptar todo → datos en BD
- [ ] Playwright: estudio con datos → toggle Presentación → navegar 8 slides con `→` → screenshot por slide
- [ ] Playwright: `window.print()` (o `page.pdf()`) genera dossier sin chrome
- [ ] `ia_uso_log` registra al menos 2 filas con `feature` correcto
- [ ] Todos los criterios de éxito de la sección **Qué** cumplidos

---

## Decisiones abiertas (confirmar antes de implementar)

1. **Modo Presentación: ruta separada o toggle en la misma página?**
   Propuesta: **toggle en la misma página** (`/direccion/aperturas/{id}` con `?modo=presentacion`), porque el mismo estado del estudio alimenta ambas vistas y evita un round-trip de carga. La ruta `/direccion/aperturas/{id}/presentacion` se reserva para una futura **vista pública** (sin login, con `share_slug` ya existente). Confirmar.

2. **Navegación: slides con `←/→` o scroll cinematográfico?**
   Propuesta: **slides** (PPT-style). Razones en sección Decisiones de diseño. Confirmar antes de Fase 7.

3. **Adjuntos `.doc/.docx`: aceptar con conversión o rechazar?**
   `mammoth` (sólo .docx) añade ~250 KB. Alternativa: pedir al usuario que exporte a PDF. Propuesta: **rechazar .doc/.docx en Fase 4-5** con mensaje "Convierte a PDF, por favor"; reevaluar si los testers lo piden mucho.

4. **Borrador IA: cliente-only o columna `ia_draft jsonb`?**
   Propuesta: **cliente-only** (sección Modelo de Datos). Si en piloto se ve que perder el draft al refrescar es bloqueante, abrir PRP-039.

5. **Costes/Facturación con IA: opt-in o por defecto?**
   Propuesta: **opt-in** mediante un checkbox "Incluir estimación de costes y facturación" en el dialog del modo `completa`. Por defecto **off** para evitar inventarse cifras que luego suenan a las del propio modelo.

6. **Generación de imágenes IA (logos, hero de marca):** fuera de scope de este PRP. Si se quiere, abrir PRP independiente reutilizando el skill `image-generation`.

---

## Riesgos

- **Alucinaciones IA en cifras financieras**: mitigado restringiendo Costes/Facturación a opt-in y dejando los Zod aceptando null/0 por defecto. Cada campo IA lleva badge ámbar — el usuario sabe que es sugerencia.
- **Coste por llamada Gemini**: una apertura completa con dossier PDF de 12 páginas puede mover ~30-80k tokens input. Mitigación: usar `gemini-2.5-flash` (default ya en `gemini.ts`), no `pro`. `ia_uso_log` permite monitorizar coste real por empresa.
- **Tamaño de adjuntos**: cap duro de 10 MB por archivo + máx 5 archivos en cliente. Sin estos límites un PDF de 200 páginas puede tumbar la function.
- **Latencia percibida**: una generación completa puede tardar 15-40 s. `RellenoIAProgreso` simula progreso por bloque (aunque la llamada sea única, el server emite eventos via streaming opcional; sin streaming, alterna mensajes "Procesando Local / Marca / Gastronomía…" para no parecer colgado).
- **Accesibilidad del modo Presentación**: contrastes condicionados por la paleta del cliente (alguno puede tener `color = #ffffff`). Fase 7 valida ratio AA mínimo y si no se cumple aplica `--brand-text` con fallback.
- **Print colors**: Safari y Chrome necesitan `print-color-adjust: exact` (incluido). Firefox respeta menos. Documentar como limitación.
- **`empresas.color_secundario` / `color_texto` no siempre rellenos**: fallback a valores neutros del theme.
- **Concurrencia con autosave del estudio**: mientras hay un draft IA pendiente, NO se debe persistir (no llamar `scheduleSave`). La persistencia se dispara sólo al Aceptar. Asegurar en Fase 4.

---

## Aprendizajes (Self-Annealing / Neural Network)

> Esta sección CRECE con cada error encontrado durante la implementación.
> El conocimiento persiste para futuros PRPs. El mismo error NUNCA ocurre dos veces.

### 2026-05-23: Archivos `"use server"` solo pueden exportar funciones async
- **Error**: `A "use server" file can only export async functions, found object`. Aparecía al abrir `/direccion/aperturas` aunque `tsc` y `next build` pasaran limpios.
- **Causa**: en `aperturas-ia-actions.ts` re-exporté `BLOQUE_IA_LABELS` (objeto) para que la UI lo importara con un único import. Next.js rechaza cualquier export que no sea función async en un archivo con `"use server"`.
- **Fix**: la UI importa `BLOQUE_IA_LABELS` y demás constantes/tipos directamente desde `types/aperturas-ia.ts`. La server action sólo exporta funciones async.
- **Aplicar en**: cualquier futura server action — nunca re-exportar tipos/constantes/objetos desde un archivo `"use server"`. Si la UI necesita ambas cosas, hacer dos imports.

### 2026-05-23: Gemini devuelve hex en variantes fuera de spec (alpha, rgb, sin #)
- **Error**: `La IA devolvió datos con forma inesperada: marca.paleta.0.hex: hex inválido`. La regex Zod sólo aceptaba `#RGB` / `#RRGGBB`, pero la IA devolvió valores como `#FFAABBCC` (con alpha), `FFAABB` (sin #) o `rgb(255,170,187)`.
- **Fix**: helper `normalizarHex(raw)` en la server action que recupera todas esas variantes a `#rrggbb` canónico antes del Zod parse. Si no es recuperable, se omite ese color en vez de tirar todo el draft. La regex Zod queda estricta — la flexibilidad vive en el sanitizador.
- **Aplicar en**: cualquier campo `hex` que la IA pueda devolver. Patrón general: para datos formateados que el modelo puede "inventarse" en variantes, sanea antes del Zod en vez de relajar el schema.

### 2026-05-23: `Schema` de Gemini necesita anotación dentro de `Object.fromEntries`
- **Error**: TS2322 al construir `matrizProps` para el schema de Ocupación, mezclando `SchemaType.OBJECT` y `SchemaType.NUMBER`.
- **Fix**: anotar `Record<string, Schema>` explícitamente en el resultado de `Object.fromEntries` y cada item con `as Schema`.
- **Aplicar en**: cualquier construcción dinámica de `responseSchema` con variantes de SchemaType.

---

## Gotchas

- [ ] **`ia_uso_log` ya existe (PRP-037)**: NO ejecutar otra migración. Antes de empezar, `mcp__supabase__list_tables` para confirmar. Si no existe, este PRP **bloquea** hasta que PRP-037 ejecute su Fase 3.
- [ ] **Gemini `responseSchema` no soporta `oneOf` discriminado robustamente**: el `responseSchema` del modo "completa" se modela como `OBJECT` con cada bloque como propiedad opcional, NO como `anyOf`. La validación discriminada se hace en server con Zod.
- [ ] **Autosave vs draft IA**: `AperturasView` tiene `scheduleSave` con debounce 500 ms. Mientras hay un borrador IA activo en una pestaña, **suprimir** el scheduleSave para ese bloque. Re-activar al aceptar/descartar.
- [ ] **Refresh de la pestaña pierde el draft** (cliente-only): aceptable en piloto. Si bloquea UX, abrir PRP-039 con columna `ia_draft jsonb`.
- [ ] **Adjuntos en cliente → base64 → server action**: tope práctico ~4-5 MB por archivo para no reventar el límite de body de Next.js. Validar tamaño antes de leer.
- [ ] **`.doc/.docx` no soportados nativamente por Gemini**: rechazar con mensaje claro (ver Decisiones abiertas 3).
- [ ] **Modo Presentación dentro de `<Tabs>` de AperturasView**: si se monta como hijo del Tabs, la salida full-screen entra en conflicto con scroll del layout. Renderizar el modo Presentación con `createPortal` a `document.body` (como hace `PresentarView`), no como hijo del flujo normal.
- [ ] **`window.print()` con `Suspense` o lazy components**: asegurar que todas las slides están en el DOM (no `mounted={index===i}`) cuando se imprime. Para print: renderizar todas con `display: block`; para pantalla: sólo la actual visible.
- [ ] **Branding `color` puede venir como hex `#fff` o como hsl(...)**: normalizar a hex en `getBrandConfig` (o aceptar ambos en el `style={{...}}`).
- [ ] **`fotos` del Local con signed URLs caducan en 1h**: el modo Presentación llama a `firmaUrlsLocal` en el load del estudio (ya lo hace `rowToEstudio`). Si la sesión presenta más de 1 h, recargar.
- [ ] **No usar emojis** ni en UI ni en código (regla global).
- [ ] **No crear archivos .md de documentación adicional** fuera de este PRP.
- [ ] **No tocar `empresa_logos`** (regla `project_imagen_de_marca.md`): leer SIEMPRE de `empresas`.
- [ ] **No instalar dependencias nuevas** sin pedir permiso. Stack permitido aquí: `@google/generative-ai` (ya), `xlsx` (ya), `recharts` (ya), `lucide-react` (ya). `mammoth` para .docx requiere aprobación explícita.

## Anti-Patrones

- NO persistir el draft IA en BD sin haber probado el flujo cliente-only primero.
- NO crear una server action distinta por cada pestaña — se reutiliza `analizarRellenoIA({ bloque, ... })` con un switch sobre el bloque.
- NO duplicar la lógica de slides de `presentaciones/` — reutilizar el patrón (hook de teclado, chrome auto-hide).
- NO leer logo/colores de `empresa_logos` ni de localStorage — siempre `empresas` vía `getBrandConfig`.
- NO meter formularios dentro de slides del modo Presentación (es de sólo lectura). Para editar se vuelve al modo Software.
- NO mostrar badges "IA" sobre valores ya aceptados — sólo durante revisión.
- NO inventar valores por defecto en Costes/Facturación si la IA no encuentra cifras (mantener los `crearCostesIniciales()` actuales).
- NO bloquear la UI durante la llamada IA — siempre cancelable (`AbortController` en el dialog).
- NO emitir nuevos `revalidatePath` agresivos: el estudio se persiste vía `updateEstudioApertura` igual que hoy.
- NO ignorar `confianza` cuando Gemini la devuelva — pintar el badge en ámbar más fuerte si `< 0.5`.

---

*PRP pendiente aprobación. No se ha modificado código.*