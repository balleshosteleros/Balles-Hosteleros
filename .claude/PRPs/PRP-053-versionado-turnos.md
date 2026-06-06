# PRP-053: Versionado de turnos en RRHH

> **Estado**: IMPLEMENTADO (fases 1-4) — pendiente QA visual del usuario
> **Fecha**: 2026-06-06
> **Proyecto**: Balles-Hosteleros

---

## Objetivo

Convertir cada turno en una "familia" con historial de versiones: editar el horario de un turno ya NO sobrescribe el pasado, sino que crea una **nueva versión** que parte de la anterior. Al crear la versión, un asistente pregunta a qué empleados aplicarla (individual o "a todos los que tienen este turno") y desde qué fecha; la nueva versión queda como **versión oficial** (la última), de modo que cualquier asignación futura coge siempre esa.

**Fuera de alcance (explícito):** el motor de tiempo teórico, saldo y estadísticas NO se construye aquí (no existe aún en el código). Este PRP cubre únicamente: versionado + asignación fechada + asistente + versión oficial.

## Por Qué

| Problema | Solución |
|----------|----------|
| Editar el horario de un turno pisa el pasado: los cuadrantes y fichajes ya cerrados quedan reescritos con un horario que no era el real en esa fecha. | Cada edición de horario crea una versión nueva fechada; las versiones anteriores se conservan intactas como histórico. |
| No hay forma de cambiar el horario "a partir de una fecha" ni de elegir a quién afecta. | Asistente que pide empleados (individual/masivo) + fecha de vigencia y aplica el nuevo horario solo desde esa fecha. |
| El aviso amarillo actual ("modificar el horario afectará al tiempo teórico…") es un parche que asusta sin resolver nada. | Se sustituye por el asistente de versión, que hace la operación segura y explícita. |

**Valor de negocio**: integridad histórica de horarios (clave para nóminas, inspecciones de trabajo y disputas), y capacidad de planificar cambios de horario futuros sin romper el pasado. Base imprescindible sobre la que más adelante se montará el motor de tiempo teórico.

## Qué

### Criterios de Éxito
- [ ] En "Editar turno" los **tramos horarios están capados** (no editables): el horario no se puede cambiar desde la edición normal. Nombre, código y color sí se editan en sitio sin crear versión.
- [ ] Existe un botón abajo en el modal: **"Crear nueva versión de turno"**. Solo por esa vía se cambia el horario.
- [ ] Al crear versión, la nueva **hereda nombre/código/color/cuadrante** de la oficial; lo único que se redefine son los tramos. El nombre se mantiene (la familia es la misma).
- [ ] Crear versión NO modifica filas históricas: inserta una versión nueva que parte de la anterior, la nueva pasa a oficial y la anterior deja de serlo.
- [ ] El asistente pide: (a) empleados a aplicar — lista de los activos que ya tienen ese turno, con selección individual y opción "a todos"; (b) fecha de vigencia — hoy por defecto, admite pasada o futura.
- [ ] **Restricción de fecha (doble)**: al asignar un empleado a una versión, la fecha NO puede ser anterior a la `vigente_desde` de esa versión, NI puede solapar otra versión ya vigente del mismo empleado en ese periodo. Si la fecha incumple cualquiera de las dos, no se permite (validación en server y aviso en UI).
- [ ] Hay un **histórico de versiones** consultable por familia: cada versión con su horario y su fecha de inicio de vigencia.
- [ ] La asignación de cada empleado queda fechada (`vigente_desde`) apuntando a la versión elegida; varias asignaciones del mismo empleado coexisten con fechas distintas (historial), sin solape.
- [ ] La versión más reciente de la familia es la "oficial"; toda asignación nueva por defecto usa esa versión.
- [ ] El aviso amarillo de `TurnosSection` queda reemplazado por el flujo de versión/asistente.
- [ ] Multi-empresa intacto: RLS por `empresa_id` con union `user_empresas` ∪ `profiles`; nada filtra solo por empresa principal.
- [ ] UI en sentence case (sin uppercase salvo siglas), patrón de avisos/guardado del proyecto.
- [ ] `npm run typecheck` y `npm run build` pasan.

### Comportamiento Esperado

**Happy path — cambiar el horario de un turno desde una fecha:**
1. El responsable abre "Editar turno" en `/rrhh/horarios` (sección Turnos). Los tramos se muestran en **solo lectura** (capados).
2. Para cambiar el horario pulsa el botón **"Crear nueva versión de turno"** (abajo del modal).
3. Se abre el **asistente de versión**: hereda nombre/código/color y deja editar SOLO los tramos del nuevo horario.
4. Paso A — Empleados: muestra los empleados activos que tienen ese turno (vía asignación directa). Permite marcar individualmente o "Aplicar a todos".
5. Paso B — Fecha: campo de fecha con hoy por defecto; admite pasada o futura. Texto de ayuda: "El nuevo horario se aplicará a los empleados elegidos a partir de esta fecha." Se valida en el acto la doble restricción (no antes del inicio de la versión, no solapar otra versión vigente del empleado); si falla, se bloquea con aviso.
6. Al confirmar: se inserta una nueva versión del turno (misma familia, nuevos tramos), pasa a ser la oficial, la anterior deja de serlo, y se crean las asignaciones fechadas de los empleados elegidos con `vigente_desde = fecha`.
7. La lista de turnos sigue mostrando una fila por familia con el horario de la versión oficial; las versiones anteriores quedan como histórico consultable.

**Caso — crear turno nuevo:** sin cambios de flujo más allá de nacer con su primera versión oficial.

**Caso — asignar empleados sin tocar horario:** se mantiene el comportamiento actual (asignación directa), pero la asignación nace apuntando a la versión oficial vigente con `vigente_desde = hoy` por defecto.

**Caso — versión aplicada a un solo empleado (aislamiento por empleado):** si A y B comparten el turno en v1 y se crea v2 marcando SOLO a A, entonces A pasa a v2 desde la fecha elegida (v1 le queda como histórico) y B **permanece en v1 sin cambio alguno**. La versión es por-empleado vía `rrhh_turno_empleados`; v2 se convierte en la oficial de la familia (afecta solo a asignaciones nuevas y a la fila mostrada en la lista), pero NO altera las asignaciones existentes de empleados no marcados. El histórico permite ver qué empleado está en qué versión.

---

## Contexto

### Referencias
- `src/features/rrhh/actions/turnos-actions.ts` — acciones actuales (`listTurnos`, `createTurno`, `updateTurno`, `deleteTurno`, `getEmpleadosDirectosPorTurno`, `setEmpleadosDirectosTurno`). Aquí va la lógica de versionado y asignación fechada.
- `src/features/rrhh/components/horarios/TurnosSection.tsx` — modal editar/crear; el bloque amarillo `turnoEditando && (...)` (líneas ~431-439) es lo que se reemplaza por el asistente.
- `src/features/rrhh/data/horarios.ts` — tipos `Turno`, `TurnoTramo`, `TurnoTono`, helpers `formatTurnoHorario`, `calcularDuracionTurno`. Hay que extender el tipo `Turno` con campos de versión.
- `supabase/migrations/20260526230000_rrhh_horarios_snapshot.sql` — definición viva de `rrhh_turnos` (id text PK, RLS union user_empresas ∪ profiles). Patrón de RLS a replicar.
- `supabase/migrations/20260515150000_rrhh_patrones.sql` — patrón de tablas RRHH con snapshot de creador (`creado_por_nombre`), trigger `updated_at` y RLS. Referencia de estilo de migración.
- PRP-039 (auditorías versionado) — precedente de versionado de plantillas en este mismo repo; revisar para coherencia de nomenclatura.
- Memoria `project_turno_asignacion_directa.md` — `rrhh_turno_empleados` es la vía de asignación directa; la columna Empleados suma directo + patrón.

### Estado actual del modelo (verificado en BD)
```
rrhh_turnos:
  id text PK, empresa_id uuid, nombre text, codigo text, tramos jsonb,
  color text, cuadrante_id text (nullable), activo bool, centro text,
  departamento text, created_at, updated_at
  RLS: union user_empresas ∪ profiles por empresa_id

rrhh_turno_empleados:
  id uuid PK, empresa_id uuid, turno_id text, empleado_id uuid, created_at
  (SIN fecha de vigencia actualmente; UNIQUE(turno_id, empleado_id) usado por upsert)
```
- IDs de turno se generan client-side como text (`makeTurnoId`). Hay que mantener ese tipo text.
- `rrhh_turno_empleados` existe en BD pero NO tiene migración versionada en el repo (creada ad-hoc). La migración de este PRP debe ser idempotente (`create table if not exists` / `add column if not exists`) para no chocar.

### Modelo de Datos propuesto

Decisión de arquitectura: **familia + versiones** sin tabla nueva de familia (la familia es un `familia_id` text compartido). Cada fila de `rrhh_turnos` pasa a ser una *versión*; comparten `familia_id`. Esto minimiza el blast radius (descansos, patrones y la UI siguen referenciando turnos por su id de fila, que ahora es el id de versión oficial cuando corresponda).

```sql
-- rrhh_turnos: convertir cada fila en una "versión" de una familia
alter table public.rrhh_turnos
  add column if not exists familia_id  text,
  add column if not exists version     integer not null default 1,
  add column if not exists es_oficial  boolean not null default true,
  add column if not exists vigente_desde date;   -- fecha desde la que aplica esta versión

-- backfill: cada turno existente es su propia familia, versión 1, oficial
update public.rrhh_turnos set familia_id = id where familia_id is null;
alter table public.rrhh_turnos alter column familia_id set not null;

-- una sola versión oficial por familia
create unique index if not exists uq_rrhh_turnos_familia_oficial
  on public.rrhh_turnos(familia_id) where es_oficial;

create index if not exists idx_rrhh_turnos_familia
  on public.rrhh_turnos(familia_id);

-- rrhh_turno_empleados: asignación fechada
alter table public.rrhh_turno_empleados
  add column if not exists vigente_desde date not null default current_date,
  add column if not exists asignado_por_user_id uuid references auth.users(id) on delete set null;
-- la PK/UNIQUE pasa a contemplar la fecha para permitir historial:
--   un empleado puede tener (turno_id, empleado_id, vigente_desde) distintos.
-- Reemplazar el UNIQUE(turno_id, empleado_id) por UNIQUE(turno_id, empleado_id, vigente_desde).
```
Notas:
- `familia_id` agrupa versiones; el id de cada fila sigue siendo la versión concreta.
- `es_oficial` marca la última versión (la que toman las asignaciones nuevas). Índice único parcial garantiza exactamente una oficial por familia.
- `vigente_desde` en `rrhh_turnos` documenta desde cuándo rige esa versión; en `rrhh_turno_empleados` fecha la asignación de cada empleado.
- RLS: replicar exactamente el patrón existente de `rrhh_turnos` (union user_empresas ∪ profiles) en las columnas/índices nuevos; `rrhh_turno_empleados` debe tener RLS por `empresa_id` (verificar y crear si falta, ya que no hay migración).

### Arquitectura de código (Feature-First, sobre lo existente)
```
src/features/rrhh/
├── actions/turnos-actions.ts        # +crearVersionTurno, +getVersionesTurno,
│                                     #  +asignarTurnoFechado (con validación doble fecha);
│                                     #  ajustar rowToTurno
├── components/horarios/
│   ├── TurnosSection.tsx            # tramos capados en edición; quitar aviso amarillo;
│   │                                #  botón "Crear nueva versión de turno"; histórico
│   ├── AsistenteVersionTurno.tsx    # NUEVO: editar tramos + empleados + fecha validada
│   └── HistorialVersionesTurno.tsx  # NUEVO: lista de versiones (horario + vigente_desde)
└── data/horarios.ts                 # extender Turno con familiaId/version/esOficial/vigenteDesde
```

---

## Blueprint (Assembly Line)

> Solo fases. Las subtareas se generan al entrar a cada fase (bucle agéntico).

### Fase 1: Esquema de versionado en BD
**Objetivo**: `rrhh_turnos` soporta familias/versiones y `rrhh_turno_empleados` soporta asignación fechada, con RLS y backfill correctos, sin romper datos existentes.
**Validación**: migración idempotente aplicada; cada turno existente queda como familia propia, versión 1, oficial; índice único parcial de oficial activo; RLS verificada con un usuario multi-empresa.

### Fase 2: Acciones de servidor (versionado + asignación fechada) — COMPLETADA ✅
**Objetivo**: nuevas server actions para crear versión (parte de la oficial, la nueva pasa a oficial, la anterior deja de serlo), listar versiones de una familia, y asignar empleados con `vigente_desde`. `updateTurno` deja de pisar tramos del pasado.
**Validación**: typecheck verde; prueba manual vía acción: crear versión deja exactamente una oficial, conserva la anterior, y crea asignaciones fechadas para los empleados elegidos.

**Hecho (2026-06-06):**
- Función SQL atómica `rrhh_crear_version_turno` (`20260606180100_*.sql`): flip oficial + insert versión (hereda nombre/código/color/depto/centro, cambia tramos) + asignaciones fechadas, con validación doble de fecha. SECURITY INVOKER (respeta RLS).
- `data/horarios.ts`: `Turno` extendido con `familiaId`, `version`, `esOficial`, `vigenteDesde`.
- `turnos-actions.ts`: `rowToTurno` mapea campos nuevos; `listTurnos` filtra `es_oficial=true` (una fila por familia); `createTurno` fija `familia_id=id`, v1, oficial, vigente_desde (arregla el NOT NULL); `updateTurno` IGNORA `tramos` (horario capado); nuevas `crearVersionTurno` (vía RPC) y `getVersionesTurno` (histórico desc).
- Verificado en BD (transacciones con rollback): v2 creada y oficial, v1 conservada no-oficial, exactamente una oficial; validación de fecha rechaza fecha anterior/solapada. `npm run typecheck` exit 0.

### Fase 3: Asistente de versión (UI), histórico y limpieza del aviso — COMPLETADA ✅
**Objetivo**: en "Editar turno" los tramos quedan capados (solo lectura) y aparece el botón "Crear nueva versión de turno" que abre `AsistenteVersionTurno` (editar tramos nuevos → paso empleados con "aplicar a todos" → paso fecha con hoy por defecto y validación de la doble restricción). Se añade vista de **histórico de versiones** de la familia (horario + fecha de inicio). Se elimina el bloque amarillo. Sentence case y patrón de guardado del proyecto.

**Hecho (2026-06-06):**
- Nuevo `AsistenteVersionTurno.tsx` con dos componentes: `AsistenteVersionTurno` (editar horario nuevo + fecha con hoy por defecto + empleados con "aplicar a todos"/"quitar todos"; muestra el error de validación de fecha que devuelve el servidor) y `HistorialVersionesTurno` (lista versiones desc con badge "Vigente" en la oficial y "Desde {fecha}").
- `TurnosSection.tsx`: eliminado el aviso amarillo; al editar, los tramos quedan `disabled` (solo lectura), sin botón añadir/quitar; nota de bloqueo + botones "Crear nueva versión de turno" y "Ver versiones"; render de los dos diálogos nuevos cableados a `empleadosCombinadosPorTurno` y `refrescar`. Icono `AlertTriangle` retirado, `History` añadido.

### Fase 4: Validación Final — COMPLETADA ✅
- `npm run typecheck` exit 0 (tras Fase 2 y tras Fase 3).
- `npm run build` exit 0 (build de producción completo).
- RPC verificada en BD con transacciones revertidas (creación de versión, flip de oficial, validación de fecha).
- **Pendiente**: QA visual por el usuario en `/rrhh/horarios` (capado, asistente, histórico).

### Fase 4: Validación Final
**Objetivo**: sistema funcionando end-to-end multi-empresa.
**Validación**:
- [ ] `npm run typecheck` pasa
- [ ] `npm run build` exitoso
- [ ] Playwright screenshot del asistente y de la lista tras crear versión
- [ ] Versiones anteriores consultables / no pisadas
- [ ] Criterios de éxito cumplidos

---

## 🧠 Aprendizajes (Self-Annealing)

**Fase 1 (2026-06-06) — COMPLETADA:**
- BD viva verificada vía MCP antes de migrar. Ambas tablas (`rrhh_turnos`, `rrhh_turno_empleados`) **ya tenían RLS correcta** con union `user_empresas` ∪ `profiles` → no se tocó seguridad.
- **Decisión revisada vs PRP original**: NO se reemplaza `UNIQUE(turno_id, empleado_id)`. Cada versión es una fila con `id` (=`turno_id`) distinto, así que el historial entre versiones funciona sin tocar la unicidad, y el upsert de `setEmpleadosDirectosTurno` (`onConflict turno_id,empleado_id`) sigue válido. `vigente_desde` entra solo como dato. Más seguro, cero rotura.
- Migración aplicada (`20260606170000_rrhh_turnos_versionado.sql`): 43 turnos → familia propia v1 oficial; 0 doble-oficial; backfill `vigente_desde = created_at::date` OK.
- **Discrepancia preexistente detectada (NO tocada)**: `rrhh_turnos` en BD viva **no tiene `cuadrante_id`**, pero `turnos-actions.ts` (`rowToTurno`, `createTurno`) lo referencia. Ajena a este PRP; reportada al usuario. Revisar aparte si `createTurno` está fallando en runtime.

---

## Gotchas

- [x] **Decisión confirmada**: el horario solo se cambia creando una versión nueva. En "Editar turno" los tramos están **capados** (solo lectura); nombre/código/color se editan en sitio sin versionar. El cambio de horario se dispara EXCLUSIVAMENTE con el botón "Crear nueva versión de turno". La nueva versión hereda todo menos los tramos.
- [x] **Restricción de fecha confirmada (doble)**: al asignar empleado a una versión, validar que la fecha (1) no sea anterior a `vigente_desde` de la versión y (2) no solape otra versión ya vigente del mismo empleado. Validar en server (fuente de verdad) y reflejar en UI.
- [ ] `rrhh_turnos.id` es **text** generado client-side, no uuid. Las versiones nuevas necesitan id text propio (reutilizar `makeTurnoId`) y compartir `familia_id`.
- [ ] `rrhh_turno_empleados` NO tiene migración en el repo: la migración debe ser idempotente y, de paso, dejar versionada la tabla (RLS incluida) si falta.
- [x] **Resuelto en Fase 1**: se MANTIENE `UNIQUE(turno_id, empleado_id)` (no se añade `vigente_desde` a la clave). El historial vive en versiones (turno_id distintos), así que el upsert de `setEmpleadosDirectosTurno` sigue intacto.
- [ ] Descansos (`rrhh_descansos.turnos` jsonb) y patrones referencian turnos por id. Si las asignaciones futuras deben apuntar a la versión oficial, decidir si esas referencias siguen al `familia_id` o al id de versión (proponer: seguir referenciando por id de versión oficial; no romper datos existentes).
- [ ] El índice único parcial `where es_oficial` exige que toda operación que cree versión marque la anterior `es_oficial = false` en la misma transacción.
- [ ] Mantener RLS con union `user_empresas` ∪ `profiles`; no copiar el patrón "solo profiles" de `rrhh_patrones` (ese filtra solo principal).

## Anti-Patrones

- NO sobrescribir tramos históricos en `updateTurno`.
- NO crear una tabla de familia separada si `familia_id` text resuelve el agrupamiento (KISS).
- NO usar uppercase en la UI salvo siglas; respetar el patrón de avisos/guardado.
- NO construir tiempo teórico/saldo/estadísticas (fuera de alcance).
- NO filtrar por empresa principal en RLS (rompe multi-empresa).
- NO ignorar errores de TypeScript ni hardcodear ids.

---

*PRP pendiente aprobación. No se ha modificado código.*
