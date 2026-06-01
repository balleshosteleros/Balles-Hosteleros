# DISCOVERY OLA2-05 - Calendarios: festivos nuevos + ausencias read-only

Fecha: 2026-06-01
Repo: `Balles-Hosteleros`
Plan origen: `docs/rrhh-consolidacion/ola2-demock/EXECUTION_PLAN_OLA2.md` (fila OLA2-05, lin 62)
Task: OLA2-05 (calendarios: crear `festivos`; ausencias = proyeccion read-only de `solicitudes_personal`; config desde `tipos_ausencia`)

## Metodo

Verificacion con el codigo y el SQL como verdad (no con la documentacion ni con el brief):

- Lectura de las 4 vistas: `src/features/rrhh/components/calendarios/CalendariosRRHHView.tsx` (109 lin), `CalendarioConfig.tsx` (272 lin), `CalendarioLaboral.tsx` (452 lin), `CalendarioAusencias.tsx` (486 lin).
- Lectura del mock de datos y del IO: `src/features/rrhh/data/calendarios.ts` (234 lin), `src/features/rrhh/io/calendarios.io.ts` (39 lin).
- Lectura de la fuente REAL de ausencias (server actions): `src/features/mi-panel/actions/mi-panel-actions.ts` (1373 lin); foco en `crearSolicitudPersonal` (lin 668-851), `listarSolicitudesEmpresa` (lin 874-897), `aprobarSolicitud`/`rechazarSolicitud` (lin 899-970 / 1170-1219), `mapSolicitud` (lin 561-576), `getMiCalendarioMes` (lin 481-557).
- Lectura del consumidor RRHH ya real de solicitudes: `src/features/rrhh/components/solicitudes/SolicitudesView.tsx` (usa `listarSolicitudesEmpresa`, `aprobarSolicitud`, `rechazarSolicitud`).
- Lectura de tipos/labels canonicos: `src/features/mi-panel/types/index.ts` (lin 1-65): enums `SolicitudSubtipo`, `SUBTIPO_LABEL`, `ESTADO_LABEL`.
- Lectura del consumidor festivo lado empleado: `src/features/mi-panel/components/CalendarioPersonal.tsx` (lin 177 usa `getFestivoEnFecha`).
- Lectura del shape de empresa activa: `src/features/empresa/contexts/empresa-context.tsx` (lin 13-22, 180-181): `Empresa.id` = slug, `Empresa.dbId` = UUID real.
- Lectura de migraciones reales: `supabase/migrations/050_mi_panel_solicitudes.sql`, `085_horarios_tipos_ausencia_y_fichaje.sql`, `20260514120000_tipos_ausencia_sesame_alignment.sql`, `20260526160000_solicitudes_personal_baja_contrato.sql`.
- Comprobacion de inexistencia de tabla de festivos: `grep -rilE 'festivos|calendario_laboral' supabase/migrations/` -> unico match es `085_*` (solo por el comentario del seed; NO hay `CREATE TABLE festivos` ni `calendario_laboral`). 145 migraciones totales; la ultima funcional es `20260527090100_firmas_tokens_unique_hash.sql`.
- Localizacion de ficheros con `wsl -d Ubuntu bash -c "find/grep ..."` (NON-login; Glob no recorre la ruta UNC en tiempo razonable).

## Estado real (resumen)

La feature **Calendarios RRHH** es, en su capa de datos, **mock puro**: todo se sirve sincrono desde `data/calendarios.ts` con `getXPorEmpresa(slug)`, y los botones "Registrar..." y la config solo mutan `useState` local (sin persistencia). Pero el modelo de negocio que pintan **3 de las 5 pestanas ya es REAL** en otra tabla. El gap se parte en tres bloques con tratamientos distintos:

### 1. Ausencias (Vacaciones / Bajas medicas / Justificadas) -> YA SON REALES en `solicitudes_personal`

- Estas 3 pestanas son una **re-presentacion en calendario** de datos que ya viven en `public.solicitudes_personal` (migracion 050, ampliada por 20260526160000) y que ya gestiona RRHH desde `SolicitudesView` y el empleado desde `mi-panel`.
- **NO se debe crear ninguna tabla** para estas 3 pestanas. Calendarios debe **LEER** `solicitudes_personal` (familia `tipo = 'ausencia'`) y pintarla.
- Mapeo pestana -> `subtipo` (enum real en `mi-panel/types/index.ts`, respaldado por el CHECK de 050+20260526160000):
  - **Vacaciones** -> `subtipo = 'vacaciones'`
  - **Bajas medicas** -> `subtipo = 'baja_medica'`
  - **Justificadas** -> `subtipo = 'permiso'` (NO existe un subtipo `justificada`; el unico subtipo de ausencia con semantica de "permiso justificado" es `permiso`. `baja_contrato` es un concepto propio con reglas de preaviso y NO pertenece a estas pestanas).
- Estados reales: `pendiente | aprobada | rechazada | anulada` (`ESTADO_LABEL`). El mock usa estados ad-hoc por pestana (`activa`/`finalizada` en bajas, etc.) que **no existen** en la tabla y deben normalizarse al enum real.
- **El backend de creacion/aprobacion YA EXISTE** y es reutilizable tal cual:
  - `crearSolicitudPersonal(input: NuevaSolicitudInput)` (valida subtipos, limites anuales via `tipos_ausencia.limite_dias`, baja_contrato con preaviso).
  - `listarSolicitudesEmpresa(filtro: "pendientes" | "todas")` (scoped por empresa via `profiles` server-side).
  - `aprobarSolicitud(id, notas?)` / `rechazarSolicitud(id, notas?)` (con push PWA y email en baja_contrato).
  - `mapSolicitud(row)` -> `SolicitudPersonal` (camelCase).

### 2. Festivos -> UNICO gap real sin tabla

- `grep festivo|calendario_laboral` sobre las migraciones devuelve **0 tablas**. No hay persistencia de festivos en ningun sitio.
- Hoy los festivos viven 100% hardcodeados en `data/calendarios.ts` (`HABANA_FESTIVOS`, `BACANAL_FESTIVOS`), tipados como `Festivo { id; fecha; nombre; tipo: "nacional"|"autonomico"|"local"; centro; region? }`, mas la constante `REGIONES_ESPANA` (19 CCAA) y la funcion **pura** `getFestivoEnFecha(empresaId, fechaISO): { tipo: "festivo"|"vispera"; festivo } | null` (deriva festivo directo o vispera = dia anterior a un festivo).
- Es el **gap limpio** de esta task: crear tabla `festivos` por `empresa_id` (decidir si tambien por `local_id`) con `fecha / nombre / tipo / region`, y exponer `listar/crear/eliminar`. La funcion `getFestivoEnFecha` (logica de vispera) se **conserva en cliente**, pero pasa a alimentarse de datos reales.
- **Consumidores de `getFestivoEnFecha` (2 ademas del mock)** — al hacerlo real, todos pasan a festivos reales:
  - `src/features/rrhh/components/calendarios/CalendarioLaboral.tsx` (varias vistas; lin 88, 275, 349, 425).
  - `src/features/rrhh/components/calendarios/CalendarioAusencias.tsx` (`FestivoMarker`, lin 248).
  - `src/features/mi-panel/components/CalendarioPersonal.tsx` (lin 177) — **lado EMPLEADO**. Importante: el empleado ya pinta festivos hoy desde el mock; al migrar, debe seguir viendo festivos (ahora reales) sin romperse. Hoy llama con `empresaActual.id` (slug).

### 3. Config (`CalendarioConfig`) -> YA respaldada por `tipos_ausencia`

- La tabla real `public.tipos_ausencia` (085, alineada a Sesame por 20260514120000) ya modela lo que `CalendarioConfig`/`getConfigCalendario` simulan: `requiere_aprobacion`, `requiere_justificante`, `descuenta_jornada`, `refleja_calendario`, `color`, `categoria`, `orden`, `activo`, y ademas `limite_dias`, `conteo_dias` (`naturales|laborables`), `remunerada`.
- **Correccion al discovery base:** la migracion `20260514120000_tipos_ausencia_sesame_alignment.sql` hace `DELETE FROM tipos_ausencia` y **re-seedea solo 2 filas** por empresa: **"Baja medica"** (remunerada, sin limite) y **"Ausencia justificada"** (no remunerada). El seed de 7 filas de 085 (que incluia una fila "Festivo" categoria "Festivos") **ya NO existe**. Implicacion doble:
  - No hay fila `tipos_ausencia` para "Vacaciones" ni "Festivo" tras 20260514120000; el catalogo real de tipos es minimo. `crearSolicitudPersonal` busca el tipo por `ilike '%keyword%'` (keyword: baja/vacacion/permiso) y tolera ausencia de fila (limite = null).
  - La pestana **Festivos NO tiene** respaldo en `tipos_ausencia`: refuerza que festivos necesita su **tabla propia** (bloque 2), no una fila de catalogo.
- `CalendarioConfig` debe **leer/escribir `tipos_ausencia`** en lugar de mutar `useState`. **Coordinar con OLA2-14**, que tambien toca esta tabla (Horarios).

### 4. Turnos (pestana "Laboral") -> riesgo de TERCERA duplicacion

- La pestana Laboral pinta `TurnoLaboral` (mock en `data/calendarios.ts`), via `CalendarioLaboral({ empresaId })` -> `getTurnosPorEmpresa(slug)`.
- Ya existe `rrhh_turnos` (modulo Horarios real; snapshot en `20260526230000_rrhh_horarios_snapshot.sql`). Conectar la pestana Laboral a una tabla propia seria la **tercera** representacion de turnos. **Coordinar con OLA2-14**; lo probable es **delegar** esta pestana al modulo Horarios real o dejarla fuera de OLA2-05 (decision D7).

## Hallazgos criticos (accionables)

- **H1 — Ausencias NO necesitan tabla.** Vacaciones/Bajas/Justificadas son proyeccion read-only (o write reutilizando `crearSolicitudPersonal`) de `solicitudes_personal`. Crear una tabla aqui duplicaria el modelo y partiria el flujo aprobacion/push/email ya existente. Mapeo: vacaciones/baja_medica/permiso.
- **H2 — Festivos es el unico gap de persistencia.** Tabla `festivos` por `empresa_id` (RLS estilo `tipos_ausencia`/`solicitudes_personal`). `getFestivoEnFecha` (vispera) se mantiene en cliente.
- **H3 — Slug vs UUID (bug presente).** `CalendariosRRHHView` pasa `empresaActual.id` (slug, p.ej. `"habana"`) a TODO. Cualquier query real (festivos, solicitudes, tipos_ausencia) necesita `empresaActual.dbId` (UUID) o derivar el UUID server-side. Igual ocurre en `CalendarioPersonal.tsx` (lin 177, pasa slug a `getFestivoEnFecha`).
- **H4 — Config ya tiene tabla, pero re-seedeada a 2 filas.** `tipos_ausencia` existe y es la fuente; tras 20260514120000 solo hay 2 tipos. La UI de config debe leer/escribir ahi, coordinando con OLA2-14 para no pisar cambios.
- **H5 — Estados del mock no son reales.** Bajas usan `activa`/`finalizada`; festivos usan `tipo` como "estado". Al de-mockear ausencias hay que normalizar al enum real `pendiente|aprobada|rechazada|anulada` y derivar la presentacion (color/badge) de ahi.
- **H6 — Consumidor empleado de festivos.** `CalendarioPersonal.tsx` comparte `getFestivoEnFecha`; al volverlo real cambia tambien la vista del empleado. Hay que mantener su contrato (sigue mostrando festivos, ahora reales).

## Schemas reales verificados

### `public.solicitudes_personal` (050 + 20260526160000) — fuente de las 3 pestanas de ausencia

| Columna | Tipo | Constraint / Default | Notas |
| --- | --- | --- | --- |
| `id` | `uuid` | PK `gen_random_uuid()` | |
| `empresa_id` | `uuid` | NOT NULL, FK -> `empresas(id)` CASCADE | usar UUID, no slug |
| `user_id` | `uuid` | NOT NULL, FK -> `auth.users(id)` CASCADE | empleado solicitante |
| `empleado_nombre` | `text` | NOT NULL default `''` | denormalizado |
| `tipo` | `text` | NOT NULL, CHECK `in ('ausencia','trabajo')` | calendarios filtra `= 'ausencia'` |
| `subtipo` | `text` | NOT NULL, CHECK `in ('baja_medica','vacaciones','permiso','baja_contrato','horas_extras','dia_trabajado')` | mapeo de pestanas: vacaciones/baja_medica/permiso |
| `fecha_inicio` | `date` | NOT NULL | |
| `fecha_fin` | `date` | nullable; CHECK `fecha_fin is null or >= fecha_inicio` | rango para pintar el calendario |
| `horas` | `numeric(5,2)` | nullable | solo familia trabajo |
| `motivo` | `text` | NOT NULL default `''` | |
| `estado` | `text` | NOT NULL default `'pendiente'`, CHECK `in ('pendiente','aprobada','rechazada','anulada')` | enum real (sustituye a activa/finalizada del mock) |
| `revisado_por` | `uuid` | FK -> `auth.users(id)` SET NULL | |
| `revisado_at` | `timestamptz` | nullable | |
| `notas_revision` | `text` | nullable | |
| `created_at` / `updated_at` | `timestamptz` | NOT NULL default `now()` (trigger updated_at) | |

**RLS real de 050:** `solicitudes_personal_read` (SELECT: empresa del usuario via `profiles`), `..._insert_own` (insert con `user_id = auth.uid()`), `..._update_own_pending` (el usuario edita solo las suyas pendientes), `..._manage` (FOR ALL: cualquier usuario del tenant gestiona — sin gating por rol; ver D5/decisiones). Multi-tenant correcto por `empresa_id`.

### `public.tipos_ausencia` (085 + 20260514120000) — fuente de la config

| Columna | Tipo | Default / Constraint | Notas |
| --- | --- | --- | --- |
| `id` | `uuid` | PK | |
| `empresa_id` | `uuid` | NOT NULL, FK -> `empresas(id)` CASCADE | |
| `nombre` | `text` | NOT NULL; UNIQUE `(empresa_id, lower(nombre))` | |
| `descripcion` | `text` | nullable | |
| `categoria` | `text` | NOT NULL default `'Otros'` | |
| `color` | `text` | NOT NULL default `'bg-slate-500'` | clase Tailwind |
| `requiere_aprobacion` | `boolean` | NOT NULL default `true` | |
| `requiere_justificante` | `boolean` | NOT NULL default `false` | |
| `descuenta_jornada` | `boolean` | NOT NULL default `true` | |
| `refleja_calendario` | `boolean` | NOT NULL default `true` | |
| `limite_dias` | `integer` | nullable; CHECK `null or > 0` | anadido en 20260514120000; usado por `crearSolicitudPersonal` |
| `conteo_dias` | `text` | NOT NULL default `'naturales'`; CHECK `in ('naturales','laborables')` | anadido en 20260514120000 |
| `remunerada` | `boolean` | NOT NULL default `false` | anadido en 20260514120000 |
| `orden` | `integer` | NOT NULL default `0` | |
| `activo` | `boolean` | NOT NULL default `true` | |
| `created_at` / `updated_at` | `timestamptz` | NOT NULL default `now()` (trigger) | |

**RLS real de 085:** `tipos_ausencia_read` (SELECT empresa del usuario) y `tipos_ausencia_write` (FOR ALL mismo predicado). **Seed efectivo tras 20260514120000:** solo 2 filas por empresa ("Baja medica", "Ausencia justificada").

### `public.festivos` — NO EXISTE (gap a crear en esta task)

`grep` confirma 0 tablas de festivos. El DDL propuesto esta en el Full-TASK (seccion "Modelo de datos propuesto").

## Recomendacion

**D5: read-only en esta task.** Las 3 pestanas de ausencia deben ser **lectura** (proyeccion en calendario de `solicitudes_personal`), no alta. Justificacion: el alta ya tiene un flujo completo y delicado (validacion de limites anuales, preaviso de baja_contrato, push PWA, emails, RLS de "solo el propio usuario inserta sus pendientes"). RRHH ya crea/aprueba desde `SolicitudesView`; duplicar el alta en calendarios arriesga inconsistencias y rompe el predicado RLS `insert_own`. Si mas adelante se quiere "Registrar..." desde el calendario, hacerlo en una task posterior reutilizando `crearSolicitudPersonal` (no reimplementando). Los botones "Registrar..." actuales deben quedar como placeholder honesto o enlace a `SolicitudesView`. La **unica escritura** real de OLA2-05 es **festivos** (CRUD nuevo) y, si entra, la **config** sobre `tipos_ausencia`.

## VERIFICAR SCHEMA REAL antes de migrar

El SQL versionado puede no reflejar el prod real (regla del proyecto: no inferir del codigo). Antes de crear `festivos` o tocar `tipos_ausencia`, confirmar via **Management API / SQL en prod**:
- `solicitudes_personal`: tipos de `empresa_id`/`user_id` (uuid), el CHECK vigente de `subtipo` (que incluya `baja_contrato`) y de `estado`.
- `tipos_ausencia`: que existen `limite_dias`, `conteo_dias`, `remunerada` y cuantas filas hay realmente por empresa (esperado: 2 tras 20260514120000).
- Que NO existe ya una tabla `festivos`/`calendario_laboral` creada fuera de migraciones.
