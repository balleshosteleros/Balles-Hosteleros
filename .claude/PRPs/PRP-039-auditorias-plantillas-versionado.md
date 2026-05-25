# PRP-039: Auditorías — Editor de plantillas con versionado, vista de rellenado e importador histórico

> **Estado**: PENDIENTE
> **Fecha**: 2026-05-23
> **Proyecto**: Balles-Hosteleros
> **Módulo**: Calidad → Auditorías

---

## Objetivo

Construir el módulo **Calidad → Auditorías** como un sistema completo de auditorías internas multi-empresa, con tres bloques que conviven:

1. **Editor de plantillas** estilo Google Forms (secciones + preguntas con tipo y peso) con **versionado** y **clonación**: cuando se cambia una pregunta de una plantilla publicada, se crea una nueva versión y las auditorías anteriores conservan la versión con la que se rellenaron, sin perder el histórico.
2. **Vista de rellenado** para que un auditor (rol Calidad) abra una plantilla en su versión vigente, conteste las preguntas y observaciones, y al guardar se calcule automáticamente la **nota final** (escala 0–10, ponderable por pregunta).
3. **Carga del histórico** (operación interna one-shot, NO es feature del producto): script ejecutado una única vez por el desarrollador para meter los CSVs reales de Google Forms (4 plantillas + 17 auditorías de BACANAL y HABANA, años 2025 y 2026) como datos oficiales en Supabase, asignados todos a **Sofía Terrón** como auditora. Los clientes futuros del SaaS no tendrán importador — empezarán a usar el módulo desde cero creando sus propias plantillas y auditorías.

Toda la información persiste en Supabase como datos oficiales del negocio (no en archivos), con RLS multi-tenant por empresa.

## Por Qué

| Problema | Solución |
|----------|----------|
| Las auditorías se hacen en Google Forms externos al SaaS (uno por local-año). Cada año se duplica el form y se acumulan en Drive sin trazabilidad ni histórico consolidado dentro del sistema | Sistema nativo dentro del SaaS: una sola tabla de envíos consultable, filtrable y consolidable con el resto del módulo Calidad |
| Cuando alguien retoca una pregunta, lo hace sobre el form vivo y las respuestas viejas siguen apuntando al texto nuevo, distorsionando el histórico (ya pasó en HABANA 2026: cambiaron 3 preguntas, pero BACANAL 2026 conserva las antiguas — descompasados sin querer) | Versionado: cada cambio publicado crea una nueva versión de la plantilla, los envíos viejos siguen vinculados a su versión original |
| Para crear la auditoría de un año nuevo se duplica el form a mano, manteniendo el mismo texto que el anterior. No hay forma de hacer ediciones controladas | Clonación de plantilla: botón "Duplicar como nueva plantilla" o "Editar y publicar nueva versión" |
| Los informes de auditoría se entregaban a mano o por PDF impreso desde Drive, sin nota final consolidada por local ni ranking temporal | Cálculo de nota final automático + dashboards de evolución por local |
| Las 17 auditorías históricas de BACANAL/HABANA 2025-2026 se perderían si no las traemos | Importador de los CSVs reales que las inserta como datos oficiales en BD, con auditor = Sofía Terrón |
| El módulo Calidad → Auditorías existe como placeholder vacío (`CalidadAuditoriasView.tsx`) — pizarra en blanco | Aprovechar para arrancar con patrón limpio (feature-first, SubmoduleToolbar, ResizableColumnsProvider, RLS multi-tenant, ID secuencial inmutable) |

**Valor de negocio**:

- Trazabilidad completa de la calidad operativa de cada local mes a mes, año a año.
- Capacidad de comparar evolución de un local con otros, o un local consigo mismo en años anteriores, con la misma plantilla o con versiones distintas (el sistema sabe qué preguntas coinciden entre versiones).
- Base para alertas y rankings: "Bichos lleva 6 meses por debajo de 3", "HABANA mejoró un 24% en limpieza de cocina entre 2025 y 2026".
- Elimina dependencia de Google Forms para auditorías; el SaaS pasa a ser fuente única.

## Qué

### Criterios de Éxito

- [ ] Existe un submódulo en `/calidad/auditorias` con **dos pestañas/vistas**: `Plantillas` y `Auditorías realizadas`.
- [ ] La vista `Plantillas` lista todas las plantillas de la empresa actual con columnas: Nombre, Versión vigente, Nº secciones, Nº preguntas, Última edición, Estado (Borrador / Publicada / Archivada). CTA `+ Nueva plantilla` y, por fila, acción "Duplicar".
- [ ] Editor de plantilla estilo Google Forms: secciones plegables, drag-and-drop de preguntas, tipos de pregunta (escala 0–5 / sí-no / texto largo / opción única / opción múltiple), campo de **peso** por pregunta (default 1) y **obligatoria** sí/no. Cada sección puede tener un bloque de Observaciones (texto largo) intercalado.
- [ ] Editar una plantilla publicada NO modifica la versión publicada: cambia el borrador. Botón **"Publicar nueva versión"** convierte el borrador en versión `N+1`, deja la `N` como histórica y la `N+1` como vigente. Los envíos antiguos siguen apuntando a su versión original.
- [ ] Botón **"Duplicar"** crea una plantilla **nueva** (otro registro raíz, otra ID secuencial) con todas las secciones y preguntas clonadas. Mantiene trazabilidad vía `clonada_de_plantilla_id`.
- [ ] La vista `Auditorías realizadas` lista los envíos de **la empresa activa** (NO se muestra columna "Empresa" porque ya está en el switcher superior del layout) con columnas: Nº (secuencial inmutable), Plantilla, Versión, Local, Auditor, Fecha, Nota final, Estado (Borrador / Enviada). Filtros por plantilla, local, auditor, rango de fechas. CTA `+ Nueva auditoría` que pide elegir plantilla y local antes de abrir el rellenado.
- [ ] El selector de **Local** en `NuevaAuditoriaDialog` se comporta de forma adaptativa: si la empresa tiene **un solo local**, se auto-asigna y el selector se oculta (no estorba al usuario); si tiene **varios locales**, se muestra el dropdown obligatorio. Diseñado para futuro multi-local sin re-trabajar nada.
- [ ] La columna **Local** en la lista de auditorías queda **oculta por defecto** en empresas con un solo local, reactivable desde el botón de columnas. En empresas con varios locales se muestra siempre.
- [ ] **La empresa nunca aparece en ningún formulario, selector ni columna del módulo**. Ya está siempre visible en el switcher superior del layout. Aplica a la lista de auditorías, al diálogo de "Nueva auditoría", a la vista de rellenado y a las plantillas.
- [ ] Una auditoría **enviada** se puede **exportar a PDF** desde un botón en su detalle. El PDF incluye: cabecera con logo + paleta de la empresa (leída de `empresas.logo_url`/`color`/`color_secundario`), nombre del local, fecha, auditor, nota final destacada, y todas las secciones con sus preguntas + respuestas + observaciones. Usa print stylesheet propio (`@page`, oculta chrome del navegador, `break-inside: avoid` por sección). Patrón a replicar: `src/features/direccion/presentaciones/components/PrintView.tsx`.
- [ ] La vista de rellenado renderiza la versión vigente de la plantilla en formato fluido (igual estructura que Google Forms: secciones con preguntas + bloques de observaciones). Guardado en borrador con debounce; botón **"Enviar"** valida obligatorias y bloquea el envío para edición posterior (sólo lectura excepto rol admin).
- [ ] Al enviar, se calcula la **nota final** = `(suma de respuestas numéricas × peso de cada una) / (suma de pesos × valor_máximo_pregunta) × 10`. Se guarda como `nota_final` (numeric 4,2) en el envío.
- [ ] **Carga del histórico** ejecutada por el desarrollador como **script one-shot** (`scripts/seed-auditorias-historicas.ts` o server action invocada manualmente desde la terminal/dev tools): inserta las 4 plantillas (BACANAL/HABANA × 2025/2026) en BD con versionado correcto, y las 17 auditorías como envíos cerrados con sus respuestas, observaciones, auditor (Sofía Terrón) y nota final preservada del CSV original. **No expone UI en el módulo Calidad**: los clientes futuros del SaaS no tienen importador y empiezan con plantillas vacías que crean ellos mismos.
- [ ] La nota final calculada por el sistema cuadra (±0,01) con la `Puntuación` registrada por Google Forms en las 17 filas del CSV.
- [ ] El submódulo cumple el patrón base universal (memoria `feedback_configuracion_base_submodulo.md`): SubmoduleToolbar + ResizableColumnsProvider + TableColumnHeader + persistencia de columnas en `user_view_preferences`.
- [ ] Todas las tablas tienen RLS multi-tenant por `empresa_id`.
- [ ] `npm run typecheck` pasa; `npm run build` exitoso.
- [ ] Playwright smoke: (a) crear plantilla nueva → añadir 2 secciones y 4 preguntas → publicar; (b) crear auditoría con esa plantilla → rellenar → enviar → nota correcta; (c) editar plantilla, publicar v2 → la auditoría vieja sigue mostrando preguntas v1; (d) ejecutar importador en empresa de prueba → 17 envíos creados, notas cuadran.

### Comportamiento Esperado

**Happy path — Crear plantilla nueva desde cero:**

1. Sofía entra a `/calidad/auditorias` → pestaña `Plantillas` → `+ Nueva plantilla`.
2. Pantalla editor con el patrón Google Forms. Define nombre "Auditoría Interna 2026", descripción larga, y empieza a añadir secciones.
3. Cada sección tiene título, descripción opcional, y dentro añade preguntas. Para cada pregunta elige tipo (escala 0–5 / texto largo / sí-no / opción única / opción múltiple), si es obligatoria, su peso (default 1). Para escala puede personalizar etiquetas mín/máx ("Muy mal" / "Muy bien").
4. Puede añadir bloques de "Observaciones" entre secciones o al final de una sección.
5. Mientras edita, la plantilla está en **Borrador**. Se guarda con debounce.
6. Click en **Publicar** → diálogo de confirmación → plantilla pasa a estado Publicada, versión 1, vigente. Ya puede usarse en auditorías.

**Happy path — Clonar plantilla:**

1. En lista de Plantillas, fila "Auditoría Interna 2026", menú `…` → **Duplicar**.
2. Se crea una plantilla nueva "Auditoría Interna 2026 (copia)" con todas las secciones y preguntas clonadas, en Borrador, versión 1. `clonada_de_plantilla_id` apunta a la original.
3. Sofía la renombra "Auditoría Interna Cocina-only 2026", borra las secciones que no aplican, retoca preguntas, y publica.

**Happy path — Publicar nueva versión:**

1. En la plantilla publicada "Auditoría Interna 2026" v1, menú `…` → **Editar y publicar nueva versión**.
2. Sistema crea un borrador clonado de v1. Sofía retoca el texto de 3 preguntas (caso real HABANA 2026: P7, P24, P46).
3. Click en **Publicar v2** → confirmación → v1 queda como histórica, v2 vigente. Las auditorías que se habían rellenado antes con v1 siguen mostrando las preguntas v1 si se abren para consulta. Las nuevas auditorías abren v2.

**Happy path — Rellenar auditoría:**

1. Sofía entra a `/calidad/auditorias` → pestaña `Auditorías realizadas` → `+ Nueva auditoría`.
2. Diálogo: selecciona plantilla "Auditoría Interna 2026" (versión vigente v2), local "BACANAL" o "HABANA", fecha (default hoy).
3. Se crea envío en estado Borrador y se abre la vista de rellenado.
4. Sofía recorre las 9 secciones, marca cada pregunta (escala 0–5), rellena las observaciones libres. Hay guardado automático con debounce (no pierde nada si se cae internet).
5. Click en **Enviar** → valida que las obligatorias estén respondidas → calcula nota final → envío pasa a estado Enviada (sólo lectura).

**Happy path — Carga del histórico (operación interna del desarrollador, NO es flujo del producto):**

1. Desarrollador (Claude/Iván) ejecuta el script una vez: `tsx scripts/seed-auditorias-historicas.ts` (o equivalente vía server action invocada manualmente).
2. El script lee los 4 CSVs hardcodeados como recurso (`src/features/calidad/data/seed-auditorias-2025-2026/`) y crea:
   - Plantilla "Auditoría Interna" en BACANAL (v1 = la común usada en 2025/2026).
   - Plantilla "Auditoría Interna" en HABANA (v1 = la común; v2 = con P7/P24/P46 reformuladas para 2026).
   - 9 envíos en BACANAL (5×2025 + 4×2026) apuntando a v1.
   - 4 envíos HABANA 2025 apuntando a v1, 4 envíos HABANA 2026 apuntando a v2.
   - Para cada envío: 60 respuestas numéricas + 9 observaciones + nota final preservada del CSV.
3. Output en consola: "17 auditorías importadas. Nota media BACANAL 2025: 8,19 / BACANAL 2026: 8,43 / HABANA 2025: 7,47 / HABANA 2026: 8,54".
4. Idempotencia: el script comprueba si ya hay envíos para esas plantillas en cada empresa; si existen, aborta con mensaje claro y NO duplica. (Marca opcional: `empresas.auditorias_historico_importado = true` para registrar que se ejecutó.)

**Importante**: este flujo NO existe en la UI. Los clientes futuros del SaaS no ven ningún "importar histórico" — el módulo arranca limpio para ellos.

**Edge cases cubiertos:**

- Plantilla en Borrador no aparece en el selector de "Nueva auditoría" (solo Publicadas/vigentes).
- Editor de plantilla publicada: edita un borrador derivado, no la v1 directamente. Al cancelar, se descarta el borrador sin tocar la publicada.
- Si se intenta archivar una plantilla con auditorías rellenadas, se permite (archivar = no usarse en nuevas, las viejas siguen consultables).
- Auditoría en Borrador puede editarse y reabrirse; tras Enviar queda en sólo lectura (excepto rol admin que puede reabrir con `reabrir_envio()` server action).
- Pregunta tipo texto largo (Observaciones) NO suma a la nota final (peso 0 implícito).
- Si todas las preguntas numéricas valen 0 o no se respondieron → nota final = 0.
- Importador idempotente: si `empresas.auditorias_historico_importado` ya es `true`, devuelve error claro sin duplicar.
- CSV original con encoding UTF-8 leído como Latin-1 (`Â¿`, `Ã³`): el parser convierte al vuelo con `Buffer.from(csv, 'latin1').toString('utf8')`.
- Filas vacías en el CSV (HABANA 2026 tiene una fila intermedia vacía) se saltan.
- Email del auditor en el CSV se ignora (siempre Sofía Terrón).

---

## Contexto

### Referencias del código existente

**Punto de partida (vacío)**
- `src/app/(main)/calidad/auditorias/page.tsx` → renderiza `<CalidadAuditoriasView />`.
- `src/features/calidad/components/CalidadAuditoriasView.tsx` → placeholder con `<Card>` vacío. Se reemplaza por la nueva implementación con tabs `Plantillas` y `Auditorías realizadas`.
- `src/features/calidad/{actions,data,hooks,services,types}` → carpetas creadas pero vacías. Aquí van todos los nuevos archivos.

**Patrones obligatorios a seguir (memoria activa)**
- `.claude/memory/feedback_configuracion_base_submodulo.md` → patrón obligatorio: SubmoduleToolbar (sin `campos`/`ordenOpciones`) + ResizableColumnsProvider + TableColumnHeader. Referencia viva: `src/features/logistica/components/ProductosView.tsx`.
- `.claude/memory/feedback_barra_horizontal_1.md` → toolbar: `+ Nuevo` izquierda + Buscar + 3 iconos (columnas, IOActions, Settings) derecha.
- `.claude/memory/project_user_view_preferences.md` → SubmoduleToolbar auto-persiste visibilidad de columnas por usuario × empresa × `view_key`. Usar `view_key="calidad.auditorias.plantillas"` y `"calidad.auditorias.envios"`.
- `.claude/memory/project_id_secuencial_inmutable.md` → cada tabla con número secuencial usa `numero_counters` + triggers. Aplica a `auditoria_plantillas.numero` y `auditoria_envios.numero`.
- `.claude/memory/feedback_titulo_pagina.md` → el header del submódulo muestra "Auditorías" (nombre de la vista); el cuerpo NO repite título ni añade subtítulos.
- `.claude/memory/feedback_combobox_dentro_dialog.md` → para el selector de plantilla/local en el diálogo de "Nueva auditoría" usar dropdown nativo, no Radix Combobox + cmdk.

**Patrones de UI a replicar**
- `src/features/logistica/components/ProductosView.tsx` → estructura tipo y toolbar.
- `src/features/cocina/nuevas-recetas/` → si tiene editor con secciones y subitems, mirar el patrón de drag-and-drop.
- `src/shared/components/SubmoduleToolbar.tsx` → toolbar estándar.
- `src/shared/io/components/IOActions.tsx` → importar/exportar/imprimir.

**Locales (centros de la empresa)**
- `.claude/memory/project_locales_fichaje.md` → tabla `locales` por empresa. Cada auditoría se asocia a un `local_id` (un local de la empresa que se audita).

**Empleados y auditores**
- `.claude/memory/project_empleado_vs_usuario.md` → el auditor es un empleado de la empresa. La importación del histórico asume que Sofía Terrón ya existe como empleada en la BD (verificar; si no, crearla como parte del seed).

**Multi-tenant**
- `.claude/memory/feedback_cambios_multi_tenant.md` → todo cambio va al código compartido, no a una empresa concreta. El módulo se construye para todas las empresas; los datos viven en BD aislados por `empresa_id`.

**RLS y seguridad**
- Patrón Supabase RLS estándar del proyecto: políticas por `empresa_id` cruzando con `profiles.empresa_id` del usuario logueado.

---

## Modelo de datos (Supabase)

> Crear vía `mcp__supabase__apply_migration` en Fase 1, con confirmación previa del usuario (regla de seguridad CLAUDE.md).

### Tablas

```sql
-- 1) Plantillas raíz (una entidad por "tipo de auditoría"; sus versiones son entradas separadas)
create table auditoria_plantillas (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references empresas(id) on delete cascade,
  numero int not null,                            -- secuencial inmutable por empresa
  nombre text not null,
  descripcion text,
  clonada_de_plantilla_id uuid references auditoria_plantillas(id), -- trazabilidad de duplicación
  archivada boolean not null default false,
  created_at timestamptz not null default now(),
  created_by uuid references profiles(id),
  unique (empresa_id, numero)
);

-- 2) Versiones de una plantilla
create table auditoria_plantilla_versiones (
  id uuid primary key default gen_random_uuid(),
  plantilla_id uuid not null references auditoria_plantillas(id) on delete cascade,
  version int not null,                           -- 1, 2, 3...
  estado text not null check (estado in ('borrador','publicada')),
  vigente boolean not null default false,         -- solo una versión vigente por plantilla
  publicada_at timestamptz,
  publicada_por uuid references profiles(id),
  created_at timestamptz not null default now(),
  unique (plantilla_id, version)
);
create unique index auditoria_plantilla_una_vigente
  on auditoria_plantilla_versiones (plantilla_id) where vigente;

-- 3) Secciones (pertenecen a una versión concreta)
create table auditoria_secciones (
  id uuid primary key default gen_random_uuid(),
  version_id uuid not null references auditoria_plantilla_versiones(id) on delete cascade,
  orden int not null,
  titulo text not null,
  descripcion text
);

-- 4) Preguntas (pertenecen a una sección)
create table auditoria_preguntas (
  id uuid primary key default gen_random_uuid(),
  seccion_id uuid not null references auditoria_secciones(id) on delete cascade,
  orden int not null,
  numero_global int not null,                     -- 1..N dentro de la versión, para mostrar "1. ¿…?"
  tipo text not null check (tipo in ('escala','texto_largo','si_no','opcion_unica','opcion_multiple','observaciones')),
  texto text not null,
  obligatoria boolean not null default false,
  peso numeric(6,2) not null default 1,           -- 0 para Observaciones; >0 para puntuables
  escala_min int default 0,
  escala_max int default 5,
  etiqueta_min text default 'Muy mal',
  etiqueta_max text default 'Muy bien',
  opciones jsonb                                  -- para opcion_unica / opcion_multiple
);

-- 5) Envíos (instancias rellenadas)
create table auditoria_envios (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references empresas(id) on delete cascade,
  numero int not null,                            -- secuencial inmutable por empresa
  plantilla_id uuid not null references auditoria_plantillas(id),
  version_id uuid not null references auditoria_plantilla_versiones(id),
  local_id uuid not null references locales(id),
  auditor_empleado_id uuid not null references empleados(id),
  fecha date not null default current_date,
  estado text not null check (estado in ('borrador','enviada')) default 'borrador',
  nota_final numeric(4,2),                        -- calculada al enviar; preservada del CSV en importador
  enviada_at timestamptz,
  created_at timestamptz not null default now(),
  unique (empresa_id, numero)
);

-- 6) Respuestas
create table auditoria_respuestas (
  id uuid primary key default gen_random_uuid(),
  envio_id uuid not null references auditoria_envios(id) on delete cascade,
  pregunta_id uuid not null references auditoria_preguntas(id),
  valor_numero numeric(6,2),                      -- para escala / si_no (0|1)
  valor_texto text,                               -- para texto_largo / observaciones
  valor_opciones jsonb,                           -- para opcion_unica / opcion_multiple (array de strings)
  unique (envio_id, pregunta_id)
);

-- 7) Marca de importación del histórico (idempotencia)
alter table empresas add column if not exists auditorias_historico_importado boolean default false;
```

### Triggers / funciones

- `numero_counters` + trigger ya existentes (memoria `project_id_secuencial_inmutable.md`): aplicar a `auditoria_plantillas` y `auditoria_envios` con keys `'auditoria_plantilla'` y `'auditoria_envio'`.
- Trigger `forzar_una_vigente` sobre `auditoria_plantilla_versiones`: al insertar/actualizar con `vigente=true`, poner las demás a `false` para esa `plantilla_id`.

### RLS

```sql
-- Patrón estándar del proyecto: cruzar con profiles.empresa_id
alter table auditoria_plantillas enable row level security;
create policy "tenant access" on auditoria_plantillas
  using (empresa_id = (select empresa_id from profiles where id = auth.uid()));

-- ... idéntico patrón para auditoria_plantilla_versiones (via plantilla_id),
-- auditoria_secciones (via version_id), auditoria_preguntas (via seccion_id),
-- auditoria_envios, auditoria_respuestas (via envio_id).
```

### Tipos TypeScript

Generar tras la migración con `mcp__supabase__generate_typescript_types`. Definir además tipos de dominio en `src/features/calidad/types/auditorias.ts`:

```ts
export type AuditoriaPlantilla = { ... };
export type AuditoriaVersion = { ... };
export type AuditoriaSeccion = { ... };
export type AuditoriaPregunta = { tipo: 'escala'|'texto_largo'|'si_no'|'opcion_unica'|'opcion_multiple'|'observaciones'; ... };
export type AuditoriaEnvio = { estado: 'borrador'|'enviada'; ... };
export type AuditoriaRespuesta = { ... };
```

---

## UI / Componentes a crear

```
src/features/calidad/
├── actions/
│   ├── plantillas-actions.ts          // CRUD plantillas + versiones (publicar, clonar, archivar)
│   └── envios-actions.ts              // CRUD envíos + calcularNotaFinal + enviar
├── components/
│   ├── CalidadAuditoriasView.tsx      // Container con tabs Plantillas / Envíos
│   ├── PlantillasListView.tsx         // Tabla de plantillas con SubmoduleToolbar
│   ├── PlantillaEditor.tsx            // Editor estilo Google Forms
│   ├── SeccionEditor.tsx              // Sub-componente: una sección plegable
│   ├── PreguntaEditor.tsx             // Sub-componente: una pregunta con tipo, peso, obligatoria
│   ├── EnviosListView.tsx             // Tabla de auditorías realizadas con SubmoduleToolbar
│   ├── NuevaAuditoriaDialog.tsx       // Selector plantilla + local + fecha
│   ├── RellenadoView.tsx              // Vista de rellenado de una auditoría
│   ├── PreguntaRenderer.tsx           // Renderiza una pregunta según tipo
│   └── EnvioPdfView.tsx               // Vista print-only para exportar a PDF
├── data/
│   └── seed-auditorias-2025-2026/
│       ├── plantilla-comun.json       // 60 preguntas + 9 secciones de la plantilla común
│       ├── plantilla-habana-2026-diff.json // 3 preguntas reformuladas
│       ├── bacanal-2025.csv           // CSVs originales como recurso del importador
│       ├── bacanal-2026.csv
│       ├── habana-2025.csv
│       └── habana-2026.csv
├── hooks/
│   ├── usePlantillas.ts
│   ├── usePlantillaEditor.ts          // Estado del editor con drag-and-drop
│   └── useRellenadoEnvio.ts           // Estado del rellenado con autosave
└── types/
    └── auditorias.ts
```

### Funciones clave

```ts
// plantillas-actions.ts
export async function crearPlantilla(input: { nombre: string; descripcion?: string }): Promise<...>;
export async function publicarVersion(versionId: string): Promise<...>;
export async function clonarPlantilla(plantillaId: string): Promise<...>;
export async function crearBorradorDeVersion(versionId: string): Promise<{ nuevaVersionId: string }>;
export async function archivarPlantilla(plantillaId: string): Promise<...>;

// envios-actions.ts
export async function crearEnvio(input: { plantillaId: string; localId: string; fecha?: Date }): Promise<...>;
export async function guardarRespuesta(envioId: string, preguntaId: string, valor: ...): Promise<...>;
export async function enviarAuditoria(envioId: string): Promise<{ notaFinal: number }>;
export function calcularNotaFinal(respuestas: ..., preguntas: ...): number;

// importador-historico-actions.ts
export async function importarHistoricoAuditorias(empresaId: string): Promise<{
  plantillasCreadas: number;
  enviosCreados: number;
  notaMediaPorLocalAnio: Record<string, number>;
}>;
```

### Cálculo de nota final (fórmula)

```ts
function calcularNotaFinal(respuestas, preguntas) {
  // Solo preguntas con peso > 0 (escala, si_no, opcion_unica con valor numérico)
  const puntuables = preguntas.filter(p => p.peso > 0);
  let sumaPonderada = 0;
  let pesoMaximoTotal = 0;

  for (const p of puntuables) {
    const r = respuestas.find(x => x.pregunta_id === p.id);
    const valor = r?.valor_numero ?? 0;
    const max = p.tipo === 'escala' ? p.escala_max : 1;
    sumaPonderada += valor * p.peso;
    pesoMaximoTotal += max * p.peso;
  }

  if (pesoMaximoTotal === 0) return 0;
  return Math.round((sumaPonderada / pesoMaximoTotal) * 10 * 100) / 100; // 2 decimales
}

// Verificación con Google Forms: las 60 preguntas escala 0-5 todas con peso 1.
// Suma máxima = 60 × 5 = 300. Nota = suma / 300 × 10.
// Equivalente a la fórmula de Google Forms confirmada en los CSVs.
```

---

## Carga del histórico (script one-shot del desarrollador)

### Naturaleza de la operación

**NO es un feature del producto.** Es un script interno que ejecuto yo una única vez para mover el histórico de BACANAL/HABANA desde los CSVs de Google Forms a Supabase. Los clientes futuros del SaaS no tienen ni ven nada de esto — el módulo arranca limpio para ellos y crean sus plantillas desde cero.

Por ese motivo:
- No hay diálogo, ni botón en la UI, ni opción admin.
- El código vive en `scripts/seed-auditorias-historicas.ts` (fuera de `src/features/calidad/`), invocado vía `tsx` desde la terminal, no incluido en el bundle del cliente.
- Los archivos de seed (CSVs + JSONs) viven en `scripts/seed-data/auditorias/` (también fuera del feature).
- Tras ejecutarlo con éxito, el script + archivos de seed pueden eliminarse del repo (o quedarse como referencia). No afectan al producto.

### Recursos que necesita el script

Los 4 CSVs originales se colocan en `scripts/seed-data/auditorias/`:
- `bacanal-2025.csv`, `bacanal-2026.csv`, `habana-2025.csv`, `habana-2026.csv`.

Los archivos JSON (`plantilla-comun.json`, `plantilla-habana-2026-diff.json`) describen la estructura de la plantilla común (60 preguntas + 9 secciones + 9 bloques de observaciones) y el delta de HABANA 2026 (P7, P24, P46 con nuevo texto). Estos JSONs se construyen una sola vez a partir de la transcripción ya validada en esta conversación.

### Flujo del script

```
1. Verificar idempotencia: si ya existen envíos con auditor = Sofía Terrón y plantilla "Auditoría Interna" en BACANAL o HABANA, abortar con mensaje claro (no duplica nada).
2. Verificar (no crear) que Sofía Terrón existe como empleada en ambas empresas
   con los IDs ya documentados arriba. Si no, abortar.
3. Cargar plantilla-comun.json y crear:
   - auditoria_plantillas { empresa_id, nombre: 'Auditoría Interna', clonada_de: null }
   - auditoria_plantilla_versiones { plantilla_id, version: 1, vigente: false, estado: 'publicada' }
   - 9 secciones + 60 preguntas escala 0-5 + 9 bloques observaciones (texto_largo, peso 0)
4. Solo para empresa HABANA: cargar plantilla-habana-2026-diff.json y crear:
   - auditoria_plantilla_versiones { plantilla_id: <misma>, version: 2, vigente: true, estado: 'publicada' }
   - Clonar todas las secciones y preguntas de v1, sobrescribiendo el texto de P7, P24, P46.
   - Marcar v1 como vigente=false.
   Para empresa BACANAL: v1 es vigente.
5. Leer el CSV correspondiente (bacanal-2025.csv, bacanal-2026.csv, habana-2025.csv, habana-2026.csv):
   - Decodificar UTF-8 (CSV original llega como Latin-1 mal interpretado).
   - Saltar filas vacías.
   - Por cada fila:
     a. Parsear fecha (formato dd/mm/yyyy hh:mm:ss → ISO date).
     b. Crear auditoria_envios {
          empresa_id, plantilla_id, version_id (v1 para 2025/BACANAL2026, v2 para HABANA2026),
          local_id (BACANAL → dc78dbe5-b5c1-4ff5-a299-b7bb66c22b4a / HABANA → 9d1ab861-475f-4008-ba8e-4ef0928b4ac6),
          auditor_empleado_id (BACANAL → 65d193e2-28dc-43f4-b93a-4be069632c39 / HABANA → c672c5d2-9abc-4400-a51c-de03475d5c0b),
          fecha,
          estado: 'enviada',
          nota_final (parseFloat del CSV con coma decimal española → '7,90' → 7.90),
          enviada_at: fecha
        }
     c. Por cada columna 1..60 → auditoria_respuestas { envio_id, pregunta_id (mapeo por numero_global), valor_numero }
     d. Por cada columna de Observaciones (9 bloques) → auditoria_respuestas { envio_id, pregunta_id (la pregunta observaciones de esa sección), valor_texto }
6. Marcar empresas.auditorias_historico_importado = true.
7. Devolver resumen: { plantillasCreadas, enviosCreados, notaMediaPorLocalAnio }.
```

### Conteo esperado tras importar (verificación)

| Empresa | Plantillas | Versiones | Envíos |
|---|---|---|---|
| BACANAL | 1 | 1 (v1) | 9 (5×2025 + 4×2026) |
| HABANA | 1 | 2 (v1 + v2) | 8 (4×2025 v1 + 4×2026 v2) |

Total: 2 plantillas, 3 versiones, 17 envíos, ~1020 respuestas numéricas (17 × 60) + ~153 observaciones (17 × 9).

### Validación post-import

- Para cada envío: recalcular nota final con la fórmula y verificar que coincide (±0,01) con la `nota_final` preservada del CSV.
- Si algún envío diverge, log de aviso en `console` y `auditoria_envios.nota_final` queda como el valor del CSV (fuente de verdad), no se sobrescribe con el cálculo. (Permite detectar discrepancias sin romper el import.)

---

## Decisiones abiertas (confirmar antes de Fase 1)

1. ~~**Locales en BACANAL y HABANA**~~ ✅ **RESUELTO** (2026-05-23): Verificado en BD que cada empresa tiene 1 local. BACANAL → "Restaurante Bacanal" (`dc78dbe5-b5c1-4ff5-a299-b7bb66c22b4a`). HABANA → "Coctelería Habana" (`9d1ab861-475f-4008-ba8e-4ef0928b4ac6`). Todas las auditorías históricas se asignan al único local de su empresa. Sistema diseñado multi-local desde el inicio para no rehacer si en el futuro hay más.
2. ~~**Sofía Terrón en BD**~~ ✅ **RESUELTO** (2026-05-23): Verificado que ya existe como empleada en ambas empresas, departamento CALIDAD. BACANAL → id empleada `65d193e2-28dc-43f4-b93a-4be069632c39`. HABANA → id empleada `c672c5d2-9abc-4400-a51c-de03475d5c0b`. El importador la usa directamente; no la crea.
3. **Permisos de auditor**: ¿solo el rol Calidad puede crear auditorías nuevas? ¿O cualquier empleado con permiso explícito? Confirmar.
4. **Estado "Archivada" en plantillas**: ¿sirve para ocultar de la lista por defecto? ¿O directamente borrar (soft-delete con `archivada=true`)? Asumido: oculta de la lista por defecto, sigue consultable.
5. ~~**Ranking / dashboards**~~ ✅ **RESUELTO** (2026-05-23): Dashboards de evolución y rankings se dejan para un PRP posterior, cuando haya al menos 6 meses de auditorías en BD para que las gráficas tengan sentido. La v1 cubre registro + consulta + filtros básicos.
6. ~~**Importador**~~ ✅ **RESUELTO** (2026-05-23): No habrá importador en UI. La carga del histórico es un **script one-shot** que ejecuta el desarrollador una única vez (`npx tsx scripts/seed-auditorias-historicas.ts`). Los clientes futuros del SaaS no tienen ni ven esta funcionalidad — su módulo Calidad → Auditorías arranca vacío y crean sus propias plantillas.
7. ~~**Exportar auditorías**~~ ✅ **RESUELTO** (2026-05-23): Sí entra en v1. Botón "Exportar PDF" en el detalle de cualquier envío enviado. Implementado en Fase 5 con print stylesheet y branding de empresa.

---

## Fases de implementación

**Fase 0 — Confirmación previa (humano)**
- Revisar este PRP.
- Resolver Decisiones abiertas.
- OK explícito antes de la migración.

**Fase 1 — Modelo de datos en Supabase**
- Crear migración con las 6 tablas + RLS + triggers + numero_counters.
- `mcp__supabase__apply_migration` con confirmación.
- Generar tipos TypeScript.
- Definir tipos de dominio en `src/features/calidad/types/auditorias.ts`.
- Smoke: `mcp__supabase__list_tables` confirma las 6 tablas.

**Fase 2 — Editor de plantillas + CRUD**
- `plantillas-actions.ts` (server).
- `PlantillasListView` + toolbar estándar.
- `PlantillaEditor` + `SeccionEditor` + `PreguntaEditor` con drag-and-drop.
- Crear, editar borrador, publicar, clonar, publicar nueva versión, archivar.
- Smoke: crear plantilla con 2 secciones y 4 preguntas, publicar, clonar, editar copia, publicar v2.

**Fase 3 — Vista de auditorías y rellenado**
- `envios-actions.ts` (server) con `calcularNotaFinal`.
- `EnviosListView` + toolbar estándar.
- `NuevaAuditoriaDialog` (selector plantilla + local + fecha).
- `RellenadoView` + `PreguntaRenderer` con autosave.
- Validación de obligatorias y envío.
- Smoke: crear auditoría, rellenar, enviar, verificar nota.

**Fase 4 — Carga del histórico (script one-shot del desarrollador)**
- Construir `plantilla-comun.json` a partir de la transcripción de plantilla validada.
- Construir `plantilla-habana-2026-diff.json` con P7/P24/P46.
- Colocar los 4 CSVs en `scripts/seed-data/auditorias/` (fuera de `src/features/`).
- Escribir `scripts/seed-auditorias-historicas.ts` con la lógica del flujo (sección anterior). Usa el cliente Supabase con service-role key (lectura desde `.env.local`), no expone nada al bundle del cliente.
- Ejecutar el script: `npx tsx scripts/seed-auditorias-historicas.ts`.
- Verificar en BACANAL: 1 plantilla con v1, 9 envíos, notas cuadran (±0,01) con CSV.
- Verificar en HABANA: 1 plantilla con v1 y v2, 8 envíos (4 en v1, 4 en v2), notas cuadran.
- **No se entrega ningún archivo al bundle del cliente**: el script vive solo en el repo del equipo.

**Fase 5 — Exportar a PDF**
- `EnvioPdfView.tsx`: vista print-only que recibe un `envio_id`, carga el envío + respuestas + plantilla en su versión original + branding de empresa, y renderiza el informe.
- Print stylesheet: `@page A4`, `@media print` oculta el chrome del layout, `break-inside: avoid` por sección, números de página, footer con "Auditoría Interna — {empresa} — {fecha}".
- Botón `Exportar PDF` en el detalle del envío llama a `window.print()` con la ruta dedicada `/calidad/auditorias/[id]/imprimir`.
- Smoke: imprimir una de las 17 auditorías importadas → PDF multipágina sin barras, secciones no se cortan, nota final visible en cabecera.

**Fase 6 — QA**
- `npm run typecheck` + `npm run build`.
- Playwright smoke según criterios.
- Verificar RLS: crear usuario de empresa A, intentar leer plantillas/envíos de empresa B → denegado.

---

## Fuera de alcance (v1)

- Dashboards de evolución temporal (PRP posterior, cuando haya 6+ meses de auditorías en BD para que las gráficas tengan sentido).
- Alertas automáticas por preguntas críticas (PRP posterior).
- Recordatorios por email (Resend) de auditorías pendientes (PRP posterior).
- Adjuntar fotos a las respuestas (la plantilla actual no las usa; PRP posterior si se añade).
- Firma digital del auditor (PRP posterior).
- Auditorías programadas / recurrentes (PRP posterior).

---

## Preguntas para confirmar antes de empezar

1. ¿OK con el modelo de 6 tablas y la separación plantilla / versión / sección / pregunta / envío / respuesta?
2. ¿OK con la fórmula de nota final ponderable?
3. ¿OK con el flujo del importador y que solo se ejecute una vez por empresa?
4. Resolver Decisiones abiertas 1 y 2 (locales y Sofía Terrón existentes) antes de Fase 1.
5. ¿Aprobamos las 5 fases o quieres ajustar el orden?
