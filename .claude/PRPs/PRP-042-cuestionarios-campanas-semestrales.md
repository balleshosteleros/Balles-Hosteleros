# PRP-042: Cuestionarios — Campañas Semestrales con Reuniones 1:1

> **Estado**: PENDIENTE
> **Fecha**: 2026-05-26
> **Proyecto**: Balles-Hosteleros
> **Submódulo**: `/calidad/cuestionarios`

---

## Objetivo

Rediseñar el submódulo Calidad → Cuestionarios para que su unidad principal sea la **Campaña Semestral** (un cuestionario enviado a todos los empleados activos cada 6 meses) en lugar de cuestionarios sueltos, integrando dentro del propio módulo el flujo de reuniones 1:1 de la jefa de calidad y los puntos clave de seguimiento que hoy viven en una hoja de Google Sheets.

## Por Qué

| Problema | Solución |
|----------|----------|
| Los cuestionarios viven sueltos sin concepto de ciclo; no hay forma de ver "qué se hizo en Q1 2026 vs Q2 2026". | Campaña = ciclo semestral con periodo + cuestionario + agregados; la lista principal es histórico semestral, no lista plana. |
| Las reuniones 1:1 y sus notas viven en Google Sheets fuera del SaaS (LOCAL, EMPLEADO, REUNION Sí/No, NOTAS). | Cada empleado de una campaña tiene un panel con pestaña "Reunión" (fecha + estado + notas + puntos), todo dentro del software. |
| Los "puntos clave" extraídos de cada reunión se pierden en celdas de texto largo sin seguimiento. | Tabla `cuestionario_puntos` con estado de seguimiento + vista timeline filtrable por empleado/estado. |
| UI actual tiene 4 filtros, badges de estado, "Aprobados", "Nota corte" — ruido visual para un caso donde solo importa "¿Respondió? ¿Tuvimos la reunión?". | Detalle de campaña con SOLO 4 columnas (Empleado · Cuestionario ● · Reunión ● · Puntos clave) y 2 barras finas en header. |

**Valor de negocio**: Laura Sánchez (jefa de calidad) deja de trabajar en Google Sheets paralelo. La dirección tiene trazabilidad real semestre a semestre del clima/desempeño del equipo y de los compromisos que salen de cada reunión. Cada empresa cliente del SaaS hereda el flujo sin configurar nada.

## Qué

### Criterios de Éxito

- [ ] La vista principal `/calidad/cuestionarios` muestra una **lista de campañas** (una fila por semestre), no cuestionarios sueltos.
- [ ] Existe botón outline `📋 Plantillas` que abre sub-vista con los cuestionarios reutilizables (patrón Plantillas estándar de Balles con `← Volver a Cuestionarios`).
- [ ] Crear una nueva campaña abre un diálogo de 2 campos: cuestionario (combobox de plantillas) + periodo (selector semestre `2026-S1`, `2026-S2`...). Al guardar, se generan automáticamente `cuestionario_envios` para todos los empleados activos de la empresa.
- [ ] El detalle de campaña tiene **exactamente 4 columnas visibles** (Empleado · Cuestionario · Reunión · Puntos clave) y 2 barras finas de progreso en header (% Respondidos · % Reuniones).
- [ ] Click en fila abre **panel lateral** con dos pestañas: "Respuestas" (read-only) y "Reunión" (fecha + estado + textarea de notas + lista de puntos con checkbox de seguimiento).
- [ ] Existe **vista de Puntos** (timeline plano) accesible desde el header de la campaña, filtrable por empleado y por estado de seguimiento.
- [ ] Las 3 tablas nuevas tienen RLS con patrón `user_empresas` UNION `profiles` (multiempresa funciona en BACANAL y HABANA simultáneamente).
- [ ] El submódulo cumple `BARRA HORIZONTAL 1` + `SubmoduleToolbar` + `ResizableColumnsProvider` + `TableColumnHeader` (configuración base universal de submódulo).
- [ ] Header de la página dice "Cuestionarios"; el cuerpo **no repite** el título ni añade subtítulo descriptivo.
- [ ] El cuestionario y los empleados **no se duplican**: `cuestionario_envios.cuestionario_id` y `cuestionario_envios.empleado_id` son FKs vivas.
- [ ] Empresa activa vía cookie `bh_empresa_activa` (uso de `getEmpresaActivaForUser`).
- [ ] `npm run typecheck` y `npm run build` pasan sin errores.

### Comportamiento Esperado

**Happy Path (Laura Sánchez, jefa de calidad de HABANA):**

1. Entra en `/calidad/cuestionarios`. Ve la barra superior con `+ Nueva campaña` (izquierda) + buscador + `📋 Plantillas` (derecha) + 3 iconos (columnas, IOActions, Settings).
2. Pulsa `+ Nueva campaña`. Dialog con dos campos:
   - Cuestionario: combobox cargando plantillas (`Cuestionario Semestral General v2`, etc.).
   - Periodo: select `2026-S1` (1 ene – 30 jun) / `2026-S2` (1 jul – 31 dic).
3. Confirma. El sistema crea `cuestionario_campañas` + un `cuestionario_envios` por cada empleado activo de HABANA con `respuestas: null`, `reunion_estado: 'pendiente'`.
4. La fila aparece en la lista: `2026-S1 · Cuestionario Semestral General v2 · 0/24 respondidos · 0/24 reuniones`.
5. Click en la fila → entra al detalle. Header con barras `Respondidos 0%` · `Reuniones 0%`. Tabla con 24 empleados, todos en círculo vacío ○ en ambas columnas.
6. Cuando un empleado responde (desde su Mi Panel — fuera de alcance directo de este PRP pero el lookup ya queda preparado), el círculo pasa a ●.
7. Laura abre el panel lateral de "Juan Pérez": pestaña "Respuestas" muestra el cuestionario read-only. Pestaña "Reunión" → introduce fecha (`28/06/2026`), cambia estado a `Realizada`, escribe notas en el textarea, añade 2 puntos ("Quiere rotar a sala", "Pendiente formación APPCC"). Cada punto tiene checkbox de seguimiento.
8. Al cerrar el panel, la columna "Reunión" de Juan pasa a ●, y "Puntos clave" muestra "Quiere rotar a sala · +1 más".
9. Laura pulsa el botón "Puntos" en el header de la campaña → timeline filtrable. Filtra por estado "Pendiente" → ve solo los puntos abiertos.

**Edge cases:**
- Empleado dado de alta después de crear la campaña: opción "Sincronizar empleados" en menú `⋮` de la fila → añade los nuevos con envío en blanco.
- Empleado dado de baja: su envío queda intacto y visible (histórico).
- Una empresa puede tener **una campaña activa por periodo** (unique constraint `(empresa_id, periodo)`). Crear una segunda sobre el mismo periodo lanza error.

---

## Contexto

### Referencias del Codebase

| Recurso | Por qué |
|---|---|
| `src/features/calidad/inspecciones/` | Patrón canónico de feature con plantillas + envíos + RLS multiempresa. Replicar arquitectura. |
| `src/features/calidad/inspecciones/actions.ts` | Patrón `ctx()` con `getEmpresaActivaForUser`. Copiar literal. |
| `src/features/calidad/inspecciones/components/PlantillasListView.tsx` | Patrón sub-vista Plantillas con `← Volver` + `SubmoduleToolbar`. |
| `src/features/empresa/lib/empresa-server.ts` | `getEmpresaActivaForUser()` — empresa activa vía cookie `bh_empresa_activa`. |
| `src/shared/components/SubmoduleToolbar.tsx` | Toolbar canónico (BARRA HORIZONTAL 1). |
| `src/shared/components/ResizableColumns.tsx` | Provider de columnas redimensionables. |
| `src/shared/components/TableColumnHeader.tsx` | Header de columna redimensionable. |
| `src/features/calidad/data/cuestionarios.ts` | Tipos `Cuestionario`, `BloqueCuestionario`, `PreguntaCuestionario` ya existentes (data mock). Se mantienen para el editor; se persisten en BD ahora. |
| `src/features/calidad/components/cuestionarios/CuestionariosView.tsx` | Editor de cuestionario existente. Se reutiliza desde sub-vista Plantillas. **Se desacopla del "estado activo/borrador/finalizado/archivado"** — ahora una plantilla solo es plantilla. |
| `supabase/migrations/091_fix_rls_presentaciones_multiempresa.sql` | Plantilla RLS UNION `user_empresas` + `profiles`. |
| `src/features/calidad/components/CalidadInspeccionesView.tsx` | Patrón de vista con tabs internos. |
| `src/lib/seeds/inspector-email-plantillas.ts` | Si se decide seedar un cuestionario canónico inicial. |

### Arquitectura Propuesta (Feature-First)

```
src/features/calidad/cuestionarios/                # NUEVO directorio dedicado (hoy hay solo /components/ y /data/)
├── actions.ts                                     # Server actions: campañas, envíos, puntos, plantillas
├── types.ts                                       # Tipos DB-aware (Campaña, Envio, Punto)
├── public-data.ts                                 # (futuro) Lookup desde Mi Panel para responder
└── components/
    ├── CampañasListView.tsx                       # Vista principal: lista de campañas
    ├── PlantillasCuestionarioView.tsx             # Sub-vista Plantillas (reutiliza editor existente)
    ├── CampañaDetalleView.tsx                     # Detalle con tabla de 4 columnas + 2 barras
    ├── EmpleadoPanelLateral.tsx                   # Sheet con tabs Respuestas / Reunión
    ├── PuntosTimelineView.tsx                     # Timeline de puntos filtrable
    └── NuevaCampañaDialog.tsx                     # Dialog de creación

src/app/(main)/calidad/cuestionarios/
└── page.tsx                                       # Mantener; renderiza CampañasListView con tabs internos
```

**Decisión clave**: el editor de cuestionario actual (`CuestionariosView.tsx` → `DetalleCuestionario`) se reutiliza dentro de `PlantillasCuestionarioView.tsx` (sub-vista Plantillas). Se elimina el concepto de "estado activo/borrador/finalizado/archivado" en la plantilla — el ciclo de vida ahora vive en la campaña.

### Modelo de Datos

```sql
-- ─── 1. CAMPAÑAS ────────────────────────────────────────────────
CREATE TABLE public.cuestionario_campañas (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id      UUID NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  cuestionario_id UUID NOT NULL,                      -- FK lógica a la plantilla (ver nota *)
  periodo         TEXT NOT NULL,                      -- '2026-S1' | '2026-S2' (formato YYYY-S[12])
  periodo_inicio  DATE NOT NULL,
  periodo_fin     DATE NOT NULL,
  estado          TEXT NOT NULL DEFAULT 'activa',     -- 'activa' | 'cerrada' | 'archivada'
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by      UUID REFERENCES auth.users(id),

  CONSTRAINT cuestionario_campañas_periodo_chk
    CHECK (periodo ~ '^\d{4}-S[12]$'),
  CONSTRAINT cuestionario_campañas_estado_chk
    CHECK (estado IN ('activa','cerrada','archivada')),
  CONSTRAINT cuestionario_campañas_uniq_periodo
    UNIQUE (empresa_id, periodo)
);

CREATE INDEX cuestionario_campañas_empresa_idx ON public.cuestionario_campañas (empresa_id);
CREATE INDEX cuestionario_campañas_estado_idx  ON public.cuestionario_campañas (estado);

-- (*) Nota: cuestionario_id apunta a la plantilla. Si los cuestionarios actuales
--     siguen como mock en `data/cuestionarios.ts`, esta FK se queda lógica.
--     La Fase 1 decide entre: (a) crear tabla `cuestionario_plantillas` y FK real,
--     o (b) dejarlo como UUID libre apuntando al id de la plantilla en código.
--     Recomendación: opción (a) — ver "Decisiones Pendientes".

-- ─── 2. ENVÍOS (1 por empleado por campaña) ─────────────────────
CREATE TABLE public.cuestionario_envios (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaña_id       UUID NOT NULL REFERENCES public.cuestionario_campañas(id) ON DELETE CASCADE,
  empresa_id       UUID NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,  -- denormalizado para RLS sin JOIN
  empleado_id      UUID NOT NULL REFERENCES public.empleados(id) ON DELETE CASCADE,

  -- Respuestas del cuestionario
  respuestas       JSONB,                             -- { preguntaId: valor | valor[] } | null si no respondió
  respondido_at    TIMESTAMPTZ,
  puntuacion       INTEGER,                           -- nullable; calculada al responder
  nota_sobre       INTEGER,
  aprobado         BOOLEAN,

  -- Reunión 1:1
  reunion_fecha    DATE,
  reunion_estado   TEXT NOT NULL DEFAULT 'pendiente', -- 'pendiente' | 'realizada' | 'cancelada' | 'no_aplica'
  reunion_notas    TEXT,
  reunion_at       TIMESTAMPTZ,                       -- timestamp de la última edición de la reunión

  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT cuestionario_envios_reunion_estado_chk
    CHECK (reunion_estado IN ('pendiente','realizada','cancelada','no_aplica')),
  CONSTRAINT cuestionario_envios_uniq_empleado
    UNIQUE (campaña_id, empleado_id)
);

CREATE INDEX cuestionario_envios_campaña_idx  ON public.cuestionario_envios (campaña_id);
CREATE INDEX cuestionario_envios_empleado_idx ON public.cuestionario_envios (empleado_id);
CREATE INDEX cuestionario_envios_empresa_idx  ON public.cuestionario_envios (empresa_id);

-- ─── 3. PUNTOS CLAVE (extraídos de la reunión) ─────────────────
CREATE TABLE public.cuestionario_puntos (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  envio_id            UUID NOT NULL REFERENCES public.cuestionario_envios(id) ON DELETE CASCADE,
  empresa_id          UUID NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,  -- denormalizado para RLS
  texto               TEXT NOT NULL,
  estado_seguimiento  TEXT NOT NULL DEFAULT 'pendiente', -- 'pendiente' | 'en_curso' | 'cerrado'
  cerrado_at          TIMESTAMPTZ,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by          UUID REFERENCES auth.users(id),
  orden               INTEGER NOT NULL DEFAULT 0,

  CONSTRAINT cuestionario_puntos_estado_chk
    CHECK (estado_seguimiento IN ('pendiente','en_curso','cerrado'))
);

CREATE INDEX cuestionario_puntos_envio_idx   ON public.cuestionario_puntos (envio_id);
CREATE INDEX cuestionario_puntos_empresa_idx ON public.cuestionario_puntos (empresa_id);

-- ─── RLS (patrón canónico UNION user_empresas + profiles) ──────

ALTER TABLE public.cuestionario_campañas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cuestionario_envios   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cuestionario_puntos   ENABLE ROW LEVEL SECURITY;

-- CAMPAÑAS
CREATE POLICY "cuestionario_campañas_read" ON public.cuestionario_campañas
  FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM user_empresas ue WHERE ue.user_id = auth.uid() AND ue.empresa_id = cuestionario_campañas.empresa_id)
    OR EXISTS (SELECT 1 FROM profiles p   WHERE p.user_id  = auth.uid() AND p.empresa_id  = cuestionario_campañas.empresa_id)
  );

CREATE POLICY "cuestionario_campañas_write" ON public.cuestionario_campañas
  FOR ALL TO authenticated
  USING (
    EXISTS (SELECT 1 FROM user_empresas ue WHERE ue.user_id = auth.uid() AND ue.empresa_id = cuestionario_campañas.empresa_id)
    OR EXISTS (SELECT 1 FROM profiles p   WHERE p.user_id  = auth.uid() AND p.empresa_id  = cuestionario_campañas.empresa_id)
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM user_empresas ue WHERE ue.user_id = auth.uid() AND ue.empresa_id = cuestionario_campañas.empresa_id)
    OR EXISTS (SELECT 1 FROM profiles p   WHERE p.user_id  = auth.uid() AND p.empresa_id  = cuestionario_campañas.empresa_id)
  );

-- ENVÍOS (mismo patrón, columna empresa_id denormalizada)
CREATE POLICY "cuestionario_envios_read"  ON public.cuestionario_envios
  FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM user_empresas ue WHERE ue.user_id = auth.uid() AND ue.empresa_id = cuestionario_envios.empresa_id)
    OR EXISTS (SELECT 1 FROM profiles p   WHERE p.user_id  = auth.uid() AND p.empresa_id  = cuestionario_envios.empresa_id)
  );

CREATE POLICY "cuestionario_envios_write" ON public.cuestionario_envios
  FOR ALL TO authenticated
  USING (
    EXISTS (SELECT 1 FROM user_empresas ue WHERE ue.user_id = auth.uid() AND ue.empresa_id = cuestionario_envios.empresa_id)
    OR EXISTS (SELECT 1 FROM profiles p   WHERE p.user_id  = auth.uid() AND p.empresa_id  = cuestionario_envios.empresa_id)
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM user_empresas ue WHERE ue.user_id = auth.uid() AND ue.empresa_id = cuestionario_envios.empresa_id)
    OR EXISTS (SELECT 1 FROM profiles p   WHERE p.user_id  = auth.uid() AND p.empresa_id  = cuestionario_envios.empresa_id)
  );

-- PUNTOS (mismo patrón)
CREATE POLICY "cuestionario_puntos_read"  ON public.cuestionario_puntos
  FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM user_empresas ue WHERE ue.user_id = auth.uid() AND ue.empresa_id = cuestionario_puntos.empresa_id)
    OR EXISTS (SELECT 1 FROM profiles p   WHERE p.user_id  = auth.uid() AND p.empresa_id  = cuestionario_puntos.empresa_id)
  );

CREATE POLICY "cuestionario_puntos_write" ON public.cuestionario_puntos
  FOR ALL TO authenticated
  USING (
    EXISTS (SELECT 1 FROM user_empresas ue WHERE ue.user_id = auth.uid() AND ue.empresa_id = cuestionario_puntos.empresa_id)
    OR EXISTS (SELECT 1 FROM profiles p   WHERE p.user_id  = auth.uid() AND p.empresa_id  = cuestionario_puntos.empresa_id)
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM user_empresas ue WHERE ue.user_id = auth.uid() AND ue.empresa_id = cuestionario_puntos.empresa_id)
    OR EXISTS (SELECT 1 FROM profiles p   WHERE p.user_id  = auth.uid() AND p.empresa_id  = cuestionario_puntos.empresa_id)
  );
```

> **Sobre las plantillas de cuestionario**: existen hoy solo en mock (`src/features/calidad/data/cuestionarios.ts`). La Fase 1 incluye persistirlas en BD con una tabla `cuestionario_plantillas` (decisión recomendada — ver "Decisiones Pendientes" #1).

---

## Blueprint (Assembly Line)

> IMPORTANTE: Solo se definen FASES. Las subtareas se generan al entrar a cada fase con `/bucle-agentico` (mapear contexto → generar subtareas → ejecutar).

### Fase 1: Migración de BD + plantillas persistidas
**Objetivo**: Crear las 3 tablas nuevas (`cuestionario_campañas`, `cuestionario_envios`, `cuestionario_puntos`) con RLS canónico, y persistir el catálogo de plantillas de cuestionario en BD (`cuestionario_plantillas` + sus tablas hijas si se decide opción A — ver Decisiones Pendientes #1).
**Validación**:
- `mcp__supabase__list_tables` muestra las tablas con RLS habilitado.
- `mcp__supabase__execute_sql` con `SELECT * FROM cuestionario_campañas` desde sesión de cliente HABANA solo devuelve filas de HABANA; desde sesión multiempresa devuelve ambas.
- Constraints únicos: insertar dos campañas con mismo `(empresa_id, periodo)` falla.

### Fase 2: Tipos + Server Actions
**Objetivo**: Crear `src/features/calidad/cuestionarios/types.ts` (DB-aware) y `actions.ts` con: `listCampañas()`, `crearCampaña(cuestionarioId, periodo)` (incluye explosión a envíos), `getCampañaDetalle(id)`, `getEnvioCompleto(envioId)`, `updateReunion(envioId, payload)`, `crearPunto/updatePunto/deletePunto`, `listPuntos(filtros)`, `sincronizarEmpleados(campañaId)`. Validación Zod en todas las inputs.
**Validación**:
- Todas las actions tienen `"use server"` y usan `ctx()` con `getEmpresaActivaForUser`.
- `npm run typecheck` pasa.
- Llamada directa desde un test/playground crea campaña y envíos correctamente.

### Fase 3: UI Lista de Campañas + Sub-vista Plantillas
**Objetivo**: `CampañasListView.tsx` con `SubmoduleToolbar` (BARRA HORIZONTAL 1), `ResizableColumnsProvider`, `TableColumnHeader`, botón `+ Nueva campaña` (izquierda), botón outline `📋 Plantillas` (derecha). Columnas: Periodo · Cuestionario · % Respondidos · % Reuniones · Estado · Acciones. `NuevaCampañaDialog.tsx` con combobox de plantillas + selector de periodo. Sub-vista `PlantillasCuestionarioView.tsx` con `← Volver a Cuestionarios` y reutiliza editor existente desacoplado del estado.
**Validación**:
- Playwright screenshot muestra layout BARRA HORIZONTAL 1.
- Crear campaña genera N envíos = N empleados activos.
- Header de página dice "Cuestionarios"; cuerpo no repite título.

### Fase 4: UI Detalle de Campaña + Panel Lateral
**Objetivo**: `CampañaDetalleView.tsx` con header (nombre cuestionario + 2 barras finas Respondidos/Reuniones + botón `Puntos`) y tabla de 4 columnas (Empleado · Cuestionario ● · Reunión ● · Puntos clave). Click en fila abre `EmpleadoPanelLateral.tsx` (Sheet) con pestañas "Respuestas" (read-only) y "Reunión" (fecha + estado + textarea + lista de puntos con checkbox).
**Validación**:
- Playwright: marcar reunión como realizada actualiza el círculo de ○ a ●.
- Añadir un punto desde el panel lo persiste y aparece en la columna "Puntos clave" truncado.
- La barra fina del header se actualiza al cerrar el panel.

### Fase 5: UI Vista de Puntos (Timeline)
**Objetivo**: `PuntosTimelineView.tsx` — timeline de tarjetas pequeñas con (texto del punto · empleado · fecha · estado), filtrable por empleado y por estado. Botón "Puntos" en header del detalle de campaña abre esta vista (con campañaId pre-filtrado).
**Validación**:
- Filtrar por estado "Pendiente" oculta los cerrados.
- Filtrar por empleado muestra solo sus puntos.
- Click en una tarjeta abre el panel lateral del empleado en pestaña "Reunión".

### Fase 6: Decisiones de migración de datos legacy + Validación Final
**Objetivo**: Resolver el destino de los 3 cuestionarios mock actuales (opción según Decisiones Pendientes #2) y verificar end-to-end.
**Validación**:
- [ ] `npm run typecheck` pasa.
- [ ] `npm run build` exitoso.
- [ ] Playwright screenshot confirma UI en HABANA y BACANAL (multiempresa).
- [ ] Criterios de éxito todos marcados.
- [ ] No queda referencia a estados `activo/borrador/finalizado/archivado` en la plantilla — esos estados solo viven ahora en `cuestionario_campañas.estado`.

---

## Decisiones Pendientes (resolver antes de Fase 1)

1. **¿Persistir plantillas en BD o dejarlas mock?**
   - **Opción A (recomendada)**: crear tabla `cuestionario_plantillas` + `cuestionario_plantilla_bloques` + `cuestionario_plantilla_preguntas` + `cuestionario_plantilla_opciones` (espejo del modelo TS actual). RLS canónico. Permite que cada empresa tenga sus propias plantillas y que se editen sin redeploy. FK real desde `cuestionario_campañas.cuestionario_id`.
   - **Opción B**: mantener mock + sembrar plantillas canónicas vía `src/lib/seeds/cuestionario-plantillas.ts` propagado con `syncSeedsToAllEmpresas()`. Más rápido pero las empresas no pueden personalizar.
   - **Esperando decisión del usuario.**

2. **¿Qué hacer con los 3 cuestionarios mock actuales (`cuestionariosHabana`, `cuestionariosBacanal`)?**
   - **Opción A**: migrar a `cuestionario_plantillas` como plantillas seed.
   - **Opción B**: archivar (no migrar) y empezar desde cero.
   - **Recomendación**: Opción A si la mock contiene un cuestionario representativo del semestral; Opción B si son ejemplos genéricos. Confirmar con el usuario.

3. **¿Quién puede crear/editar campañas?**
   - **Recomendación**: rol "Calidad" o "Admin" (Laura Sánchez). Empleados solo ven sus propios envíos desde Mi Panel (fuera de alcance de este PRP). Ajustar permisos vía `empresa_roles` cuando se implemente.

4. **¿Cómo se define el periodo semestral?**
   - **Recomendación**: hardcodear S1 = 1 ene → 30 jun, S2 = 1 jul → 31 dic. No exponer fechas custom al usuario.

5. **¿La pestaña "Respuestas" se rellena ahora?**
   - El PRP entrega la lectura (read-only); la **escritura** (empleado respondiendo desde Mi Panel) queda fuera de alcance — ya existe `/mi-panel/cuestionarios/` que puede engancharse en una segunda iteración. Acordar si entra o no.

---

## Gotchas

- [ ] `cuestionario_envios.empresa_id` y `cuestionario_puntos.empresa_id` son **denormalizados** a propósito — evita JOIN en RLS y rinde mejor. Asegurar que se rellenan en la action (no confiar solo en triggers).
- [ ] Nombre de tabla con `ñ` (`cuestionario_campañas`): PostgreSQL lo admite pero requiere quotearlo en algunas tools. **Considerar renombrar a `cuestionario_campanas`** (sin ñ) por compatibilidad — confirmar con el usuario antes de Fase 1.
- [ ] `UNIQUE (campaña_id, empleado_id)` en envíos protege contra duplicados si se ejecuta "Sincronizar empleados" dos veces.
- [ ] Si un empleado se da de baja, **no borrar su envío**: `empleados` ya tiene soft-delete por estado; el `ON DELETE CASCADE` en la FK aplica solo si el row se borra físicamente.
- [ ] El editor de cuestionario actual (`CuestionariosView.tsx`) tiene campo `estado` con valores `borrador/activo/finalizado/archivado` — al desacoplarlo, **eliminar las referencias** en `data/cuestionarios.ts` y constantes asociadas, o mantenerlas como legacy si Opción 2.B.
- [ ] La cookie `bh_empresa_activa` requiere que el `getAppContext` use `getEmpresaActivaForUser`, NO `profile.empresa_id` directo (regla canónica).
- [ ] Si se elige Opción 1.A, la migración debe propagar plantillas iniciales con `syncSeedsToAllEmpresas()` a TODAS las empresas (regla canónica seeds).

## Anti-Patrones

- NO replicar el patrón de filtros pill (`Todos / Activos / Borradores / Finalizados / Archivados`) — eliminado por diseño minimalista.
- NO usar `empresa_id IN (SELECT FROM profiles ...)` sin el OR `user_empresas` — viola la regla RLS multiempresa.
- NO duplicar empleados (snapshot) en `cuestionario_envios` — usar FK viva a `empleados.id`.
- NO duplicar el cuestionario en cada envío — guardar `cuestionario_id` y resolver al renderizar.
- NO crear nuevos patrones de toolbar — usar `SubmoduleToolbar` tal cual.
- NO añadir badges de estado en plantilla — el estado vive en la campaña.
- NO meter dialog tipo combobox cmdk dentro de Dialog (rompe el typing — regla MEMORY.md). Usar dropdown nativo sin portal.
- NO mostrar nombres de locales en presentaciones/emails (regla canónica) — aplica si se añade futuro envío por email del cuestionario.

---

## 🧠 Aprendizajes (Self-Annealing)

> Esta sección crecerá con cada error encontrado durante la implementación.

*(vacío — se irá rellenando durante `/bucle-agentico`)*

---

*PRP pendiente aprobación. No se ha modificado código.*
