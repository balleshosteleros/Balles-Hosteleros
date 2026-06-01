# Full-TASK-OLA2-05 - Calendarios: festivos y ausencias

## Estado

PLANIFICADO (Ola 2, 2026-06-01). No implementado.
Discovery en `DISCOVERY_OLA2-05-calendarios-festivos-y-ausencias.md` (estado real verificado contra codigo + SQL, no contra documentacion).

Resumen del estado real (corrige el supuesto de "todo es mock que hay que respaldar con tablas"): la feature Calendarios es mock en su capa de datos, pero **3 de las 5 pestanas (Vacaciones, Bajas medicas, Justificadas) ya son datos REALES** en `public.solicitudes_personal` y solo necesitan **lectura/proyeccion**; la **config** ya tiene tabla real (`tipos_ausencia`); y **Festivos es el unico gap de persistencia sin tabla**. La pestana Laboral (turnos) se coordina/delega con OLA2-14.

## Objetivo

Que la feature Calendarios RRHH deje de servir datos mock y muestre datos reales por tenant (UUID): (1) **crear** la tabla `festivos` por `empresa_id` con su CRUD y RLS multi-tenant, alimentando `getFestivoEnFecha` (logica de vispera) desde BD para todos sus consumidores (RRHH y empleado); (2) pintar las pestanas **Vacaciones / Bajas medicas / Justificadas como proyeccion read-only** de `public.solicitudes_personal` (familia `ausencia`), sin crear tablas ni duplicar el modelo; (3) conectar `CalendarioConfig` a la tabla real `tipos_ausencia` (lectura/escritura), coordinando con OLA2-14; (4) coordinar la pestana **Laboral** con OLA2-14 para evitar una tercera duplicacion de turnos. Todo respetando RLS por `empresa_id` y eliminando el uso del slug como clave de datos reales.

## Estimacion de complejidad

**Media.**

- Backend: medio. Una tabla nueva (`festivos`) con RLS + CRUD (`listarFestivos`/`crearFestivo`/`eliminarFestivo`). Las ausencias reutilizan actions existentes (`listarSolicitudesEmpresa`); a lo sumo un proyector a ViewModel de calendario. La config reutiliza `tipos_ausencia` (get/set).
- Frontend: medio-alto. De-mockear 4 vistas, mapear `solicitudes_personal` -> items de calendario (normalizando estados), cablear festivos reales en `FestivoMarker` (RRHH + empleado), y conectar la config.
- Decision/coordinacion: relevante. D5 (read-only vs write) y D7 (turnos) condicionan scope; coordinacion con OLA2-14 sobre `tipos_ausencia` y turnos.
- Migracion: una (crear `festivos` + RLS), idempotente y verificada.

## Criterio de corte

Las pestanas Vacaciones/Bajas/Justificadas muestran datos reales de `solicitudes_personal` (por UUID de empresa, estados normalizados al enum real) y dejan de leer `data/calendarios.ts`; existe la tabla `festivos` con RLS multi-tenant y CRUD real, y `getFestivoEnFecha` se alimenta de BD en RRHH **y** en `CalendarioPersonal` (empleado); `CalendarioConfig` lee/escribe `tipos_ausencia` real (coordinado con OLA2-14); la pestana Laboral queda resuelta segun D7 (mantenida con dato real o delegada a Horarios); ningun punto pasa `empresaActual.id` (slug) a una query real; `data/calendarios.ts` deja de ser fuente funcional (conservando solo `getFestivoEnFecha`/`REGIONES_ESPANA`/tipos si se reutilizan). Cierre alineado con la fila "OLA2-05" del `EXECUTION_PLAN_OLA2.md`.

## Modo operativo

- taskId: **OLA2-05**
- taskMode: **code**
- reviewMode: **standard**
- sourcePlan: `docs/rrhh-consolidacion/ola2-demock/EXECUTION_PLAN_OLA2.md`
- dependsOn: coordinacion con **OLA2-14** (Horarios: turnos `rrhh_turnos` y tabla `tipos_ausencia`). No es bloqueo duro para festivos/ausencias, pero la pestana Laboral y la config deben alinearse para no pisar cambios.

## Contexto previo obligatorio

Leer antes de ejecutar:

1. `docs/rrhh-consolidacion/ola2-demock/DISCOVERY_OLA2-05-calendarios-festivos-y-ausencias.md` (este discovery; mapeo de pestanas, schemas y hallazgos criticos).
2. `src/features/rrhh/components/calendarios/CalendariosRRHHView.tsx` (orquestador de tabs; pasa el slug `empresaActual.id` a todo — hay que migrar a `dbId`/UUID).
3. `src/features/rrhh/components/calendarios/CalendarioAusencias.tsx` (vista generica de las 3 pestanas + `FestivoMarker`, lin 246-296).
4. `src/features/rrhh/components/calendarios/CalendarioConfig.tsx` (config mock a conectar con `tipos_ausencia`; bloque festivos lin 70-162).
5. `src/features/rrhh/components/calendarios/CalendarioLaboral.tsx` (pestana turnos; coordina/delega con OLA2-14).
6. `src/features/rrhh/data/calendarios.ts` (mock + tipos `Festivo`/`Vacacion`/`BajaMedica`/`Justificada`, `REGIONES_ESPANA`, y la funcion pura `getFestivoEnFecha` a conservar).
7. `src/features/mi-panel/actions/mi-panel-actions.ts` (fuente real de ausencias: `crearSolicitudPersonal` 668-851, `listarSolicitudesEmpresa` 874-897, `aprobar/rechazarSolicitud`, `mapSolicitud`, `getMiCalendarioMes`).
8. `src/features/mi-panel/types/index.ts` (enums `SolicitudSubtipo`, `SUBTIPO_LABEL`, `ESTADO_LABEL`; verdad del mapeo y los estados).
9. `src/features/rrhh/components/solicitudes/SolicitudesView.tsx` (consumidor RRHH real de solicitudes; patron de labels/estados a reutilizar, no reinventar).
10. `src/features/mi-panel/components/CalendarioPersonal.tsx` (consumidor empleado de `getFestivoEnFecha`, lin 177; no romper su contrato al volverlo real).
11. `src/features/empresa/contexts/empresa-context.tsx` (lin 13-22: `id` = slug, `dbId` = UUID; de aqui sale la correccion del slug).
12. Migraciones: `supabase/migrations/050_mi_panel_solicitudes.sql`, `085_horarios_tipos_ausencia_y_fichaje.sql`, `20260514120000_tipos_ausencia_sesame_alignment.sql`, `20260526160000_solicitudes_personal_baja_contrato.sql`.
13. `EXECUTION_PLAN_OLA2.md` (criterios globales: UUID en actions, RLS real, placeholder honesto, no reintroducir mock; D5 y D7).

## Scope IN

- **Tabla `festivos`** nueva por `empresa_id` (RLS estilo `tipos_ausencia`) + migracion idempotente y verificada. Seed opcional de los festivos nacionales/CCAA actuales del mock (best-effort, no obligatorio).
- **CRUD de festivos** como server actions scoped por UUID: `listarFestivos`, `crearFestivo`, `eliminarFestivo` (firmas en "Interfaces publicas propuestas").
- **Cablear `getFestivoEnFecha` a datos reales**: conservar la logica pura de vispera, pero alimentarla de la tabla `festivos` (via fetch + cache de festivos del tenant, o variante async). Actualizar sus 3 consumidores: `CalendarioLaboral`, `CalendarioAusencias` (`FestivoMarker`) y `CalendarioPersonal` (empleado).
- **De-mockear Vacaciones/Bajas/Justificadas como read-only** sobre `solicitudes_personal`: leer via `listarSolicitudesEmpresa("todas")` (o un proyector dedicado), filtrar `tipo = 'ausencia'` y por `subtipo` (vacaciones / baja_medica / permiso), mapear a los `items` que ya consume `CalendarioAusencias`, normalizando `estado` al enum real.
- **Conectar `CalendarioConfig` a `tipos_ausencia`**: leer la config real (requiere_aprobacion/justificante, descuenta_jornada, refleja_calendario, color, limite_dias, conteo_dias, remunerada) y persistir cambios. La gestion de festivos del bloque de config opera sobre la tabla `festivos`. Coordinar con OLA2-14.
- **Resolver la pestana Laboral segun D7**: o se delega a Horarios (`rrhh_turnos`) reutilizando su lectura real, o se conecta a dato real coordinado con OLA2-14, o se deja explicitamente fuera de OLA2-05 con placeholder honesto. No crear una tercera tabla de turnos.
- **Corregir slug -> UUID**: la UI deja de pasar `empresaActual.id` a datos reales; usa `empresaActual.dbId` (o el UUID derivado server-side por las actions). Incluye `CalendarioPersonal.tsx`.
- Retirar `data/calendarios.ts` como fuente funcional de las pestanas migradas (conservar `getFestivoEnFecha`, `REGIONES_ESPANA` y los tipos que se reutilicen, reubicandolos a un lugar neutral del feature si conviene).

## Scope OUT

- **NO crear tablas para Vacaciones/Bajas/Justificadas.** Son `solicitudes_personal` ya existente; duplicar el modelo esta prohibido.
- **NO reimplementar el alta de solicitudes** en calendarios (validacion de limites, preaviso de baja_contrato, push, emails ya existen en `crearSolicitudPersonal`). Si entra "Registrar..." (ver D5), se reutiliza esa action; por defecto las pestanas son read-only y los botones quedan como placeholder/enlace a `SolicitudesView`.
- **NO crear una tercera tabla de turnos.** La pestana Laboral se delega/coordina con OLA2-14 (`rrhh_turnos`).
- **NO duplicar el catalogo de tipos** (`tipos_ausencia` ya existe). No crear una tabla paralela de "tipos de solicitud" desde calendarios.
- **NO romper el lado empleado** (`mi-panel`): `getMiCalendarioMes` y `CalendarioPersonal` siguen funcionando; solo cambia el origen de festivos (mock -> real) conservando el contrato.
- **NO endurecer la RLS de `solicitudes_personal` por rol** en esta task (es otra decision; ver D5). Solo se anade la RLS de `festivos`.
- **NO calcular metricas nuevas** (ocupacion, dias consumidos por empleado) mas alla de lo que ya deriva la vista.

## Restricciones

- Las queries reales reciben/derivan el **UUID de empresa** (`empresaActual.dbId` o derivado server-side), nunca el slug. La UI deja de usar `empresaActual.id` como clave de datos reales (incluye `CalendarioPersonal`).
- RLS multi-tenant real por `empresa_id` en `festivos` (estilo `tipos_ausencia`/`solicitudes_personal`). No usar `using(true) with check(true)`.
- Reutilizar las server actions de solicitudes existentes; **no** reescribir el flujo de alta/aprobacion ni los enums (`SolicitudSubtipo`, `ESTADO_LABEL` son la verdad).
- Normalizar la presentacion al **enum real** de estados (`pendiente|aprobada|rechazada|anulada`); retirar los estados ad-hoc del mock (`activa`/`finalizada`).
- Migracion de `festivos` idempotente (`create table if not exists`, `drop policy if exists` + `create policy`) y **verificada contra prod** (Management API) antes de aplicar.
- No reintroducir `data/rrhh.ts` ni `data/calendarios.ts` como fuente funcional (criterio global Ola 1/2).
- Flujos de lectura/escritura conservan try/catch, error legible (`toast`) y degradan a vacio con aviso si la BD falla (no a mock).
- Validacion por ejecutor: `npm run typecheck` y `npm run build` via WSL (`wsl -d Ubuntu bash -c`, NON-login). El agente de arquitectura NO commitea ni buildea.
- Commits terminan en `_FernandoClaude` (criterio del `EXECUTION_PLAN_OLA2.md`); push directo a `main` tras typecheck+build verdes (lo ejecuta Fernando).
- No versionar peppers/SMTP/claves/service-role.

## Validacion requerida

1. `npm run typecheck` verde (WSL).
2. `npm run build` verde (WSL).
3. Smoke funcional controlado (dev local):
   - Crear/aprobar una solicitud de **vacaciones** desde `SolicitudesView` (o `mi-panel`) -> aparece pintada en la pestana **Vacaciones** del calendario en el rango de fechas correcto y con el estado real.
   - Idem para **baja_medica** -> pestana **Bajas medicas**; y **permiso** -> pestana **Justificadas**.
   - Crear un **festivo local** desde la config -> persiste tras recargar y se marca en el calendario RRHH (icono festivo) **y** la **vispera** aparece en el dia anterior; el mismo festivo aparece en `CalendarioPersonal` del empleado.
   - Eliminar un festivo -> desaparece de ambos lados (no "revive" el mock).
   - Cambiar config en `tipos_ausencia` (p.ej. `requiere_justificante`) -> persiste tras recargar.
   - Switcher de empresa (habana/bacanal) -> festivos y ausencias cambian de tenant (no mezclan, no muestran mock).
4. Verificacion BD (Management API / SQL): el festivo creado existe en `public.festivos` con `empresa_id` = UUID correcto; las ausencias pintadas corresponden a filas reales de `solicitudes_personal`.
5. RLS: un usuario de otra empresa no ve ni edita los festivos ajenos; las ausencias respetan la RLS ya vigente de `solicitudes_personal`.

## Dependencias

- **Bloqueantes:** ninguna dura. Festivos (tabla nueva) y ausencias (tabla ya existente) pueden arrancar de inmediato ("Ola B").
- **Coordinacion (OLA2-14, Horarios):**
  - `tipos_ausencia`: ambas tasks la tocan (config aqui; Horarios alla). Acordar quien define el contrato de lectura/escritura para no pisar cambios.
  - Turnos: la pestana Laboral no debe crear una tercera representacion de `rrhh_turnos`. Definir delegacion o fuera-de-alcance (D7) antes de tocar `CalendarioLaboral`.
- **Coordinacion suave OLA2-01** (empleados reales): si las ausencias muestran nombre/departamento, alinear con la fuente unica de empleados; no es prerrequisito (la solicitud ya trae `empleado_nombre` denormalizado).
- **Decisiones de negocio:** D5 (read-only vs write) y D7 (turnos) — ver seccion.

## Inputs

- Tabla real `public.solicitudes_personal` (schema en discovery) — fuente de las 3 pestanas de ausencia.
- Tabla real `public.tipos_ausencia` (schema en discovery) — fuente de la config.
- Server actions reales: `listarSolicitudesEmpresa`, `crearSolicitudPersonal`, `aprobarSolicitud`, `rechazarSolicitud`, `mapSolicitud` (`mi-panel-actions.ts`).
- Enums/labels: `SolicitudSubtipo`, `SUBTIPO_LABEL`, `ESTADO_LABEL` (`mi-panel/types/index.ts`).
- Funcion pura `getFestivoEnFecha` + `REGIONES_ESPANA` + tipo `Festivo` (`data/calendarios.ts`) — a conservar/reubicar.
- Empresa activa por UUID: `empresaActual.dbId` (cliente) o derivacion server-side (patron de `mi-panel-actions::getContext`).

## Outputs esperados

- Migracion `supabase/migrations/<timestamp>_festivos.sql`: tabla `public.festivos` + indices + RLS multi-tenant + trigger updated_at (DDL en "Modelo de datos propuesto").
- Server actions de festivos: `listarFestivos`, `crearFestivo`, `eliminarFestivo` (ubicacion sugerida: `src/features/rrhh/actions/festivos-actions.ts`).
- `getFestivoEnFecha` alimentado por datos reales del tenant; sus 3 consumidores (RRHH x2 + empleado) muestran festivos reales.
- Vacaciones/Bajas/Justificadas pintadas read-only desde `solicitudes_personal` (proyector fila -> item de calendario, estados normalizados). Ubicacion del proyector: feature `rrhh` (p.ej. `src/features/rrhh/lib/ausencias-calendario-map.ts`).
- `CalendarioConfig` conectado a `tipos_ausencia` (get/set), coordinado con OLA2-14.
- Pestana Laboral resuelta segun D7 (delegada/conectada/placeholder honesto).
- `data/calendarios.ts` retirado como fuente funcional (solo `getFestivoEnFecha`/`REGIONES_ESPANA`/tipos si se reutilizan, reubicados si conviene).
- Documentacion de cierre y, si aplica, registro de blindaje.

## Riesgos conocidos

- **R1 Duplicacion de modelo de ausencias** -> si se cae en crear tabla para vacaciones/bajas/justificadas, se rompe el flujo unico (aprobacion/push/email) y se desincroniza con `SolicitudesView`/`mi-panel`. Mitigacion: read-only sobre `solicitudes_personal`; D5 por defecto en read-only.
- **R2 Slug residual** -> cualquier query real que reciba el slug (`"habana"`) devuelve 0 filas en silencio. Mitigacion: auditar que toda la cadena usa `dbId`/UUID; incluir `CalendarioPersonal` (lin 177).
- **R3 Mapeo de subtipo erroneo** -> "Justificadas" no tiene subtipo propio; el unico encaje es `permiso`. Confundirlo con `baja_contrato` mezclaria bajas voluntarias en la pestana equivocada. Mitigacion: mapeo explicito vacaciones/baja_medica/permiso; `baja_contrato` y familia `trabajo` excluidos.
- **R4 Estados del mock no reales** -> `activa`/`finalizada` no existen en BD; pintarlos romperia colores/badges. Mitigacion: derivar presentacion del enum real.
- **R5 `getFestivoEnFecha` sincrono vs async** -> hoy es puro y sincrono; volverlo real puede forzar fetch async y tocar la firma usada por 3 vistas. Mitigacion: cargar los festivos del tenant una vez (cache/contexto) y mantener `getFestivoEnFecha` puro sobre ese array, o introducir una variante async controlada en los 3 consumidores.
- **R6 Colision con OLA2-14 en `tipos_ausencia`** -> ambas tasks escriben la misma tabla. Mitigacion: acordar contrato/owner del get/set antes de implementar.
- **R7 Tercera duplicacion de turnos** -> conectar Laboral a una tabla nueva duplicaria `rrhh_turnos`. Mitigacion: D7 (delegar a Horarios o fuera de alcance).
- **R8 Empleado pierde festivos** -> al de-mockear, `CalendarioPersonal` podria quedarse sin festivos si no se cablea su fuente real. Mitigacion: incluir el empleado en el smoke y en el cableado de `getFestivoEnFecha`.
- **R9 Schema prod != SQL** -> verificar con Management API antes de migrar/tocar (CHECK de subtipo/estado, columnas nuevas de `tipos_ausencia`, inexistencia de `festivos`).

## Modelo de datos propuesto

**Solo se crea UNA tabla: `festivos`.** Las ausencias **NO crean tabla** (leen `public.solicitudes_personal`); la config **NO crea tabla** (usa `public.tipos_ausencia`). **VERIFICAR SCHEMA REAL via Management API** antes de migrar (el SQL versionado puede no reflejar prod; regla del proyecto).

### `public.festivos` (NUEVA)

DDL propuesto (idempotente; ajustar tras verificar prod). Decision abierta sobre granularidad por local (ver nota):

```sql
create table if not exists public.festivos (
  id          uuid primary key default gen_random_uuid(),
  empresa_id  uuid not null references public.empresas(id) on delete cascade,
  -- local_id uuid references public.locales(id) on delete cascade,  -- OPCIONAL: ver decision de granularidad
  fecha       date not null,
  nombre      text not null,
  tipo        text not null default 'local'
                check (tipo in ('nacional','autonomico','local')),
  region      text,                       -- CCAA (libre o validable contra REGIONES_ESPANA en TS)
  activo      boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  created_by  uuid
);

create index if not exists idx_festivos_empresa_fecha
  on public.festivos (empresa_id, fecha);

-- Evita duplicar el mismo festivo (mismo dia+nombre) en la misma empresa:
create unique index if not exists uniq_festivos_empresa_fecha_nombre
  on public.festivos (empresa_id, fecha, lower(nombre));

alter table public.festivos enable row level security;

drop policy if exists festivos_read on public.festivos;
create policy festivos_read on public.festivos for select to authenticated
using (
  empresa_id in (select p.empresa_id from public.profiles p where p.user_id = auth.uid())
);

drop policy if exists festivos_write on public.festivos;
create policy festivos_write on public.festivos for all to authenticated
using (
  empresa_id in (select p.empresa_id from public.profiles p where p.user_id = auth.uid())
)
with check (
  empresa_id in (select p.empresa_id from public.profiles p where p.user_id = auth.uid())
);

drop trigger if exists trg_festivos_updated_at on public.festivos;
create trigger trg_festivos_updated_at
  before update on public.festivos
  for each row execute function public.set_updated_at();
```

Nota de granularidad (decision menor, anotar): el mock distingue `centro` (Habana/Bacanal = empresa) pero NO por local. Si los festivos locales pueden variar por local dentro de la misma empresa, anadir `local_id` (nullable: null = aplica a toda la empresa). Por simetria con el resto de RRHH (por `empresa_id`), por defecto **solo `empresa_id`**; elevar la decision si negocio requiere por-local.

### Ausencias: SIN TABLA (leen `public.solicitudes_personal`)

Se documenta que NO se crea tabla. La proyeccion a calendario filtra `tipo = 'ausencia'` y mapea `subtipo`:
- pestana Vacaciones -> `subtipo = 'vacaciones'`
- pestana Bajas medicas -> `subtipo = 'baja_medica'`
- pestana Justificadas -> `subtipo = 'permiso'`

(Schema completo de `solicitudes_personal` y su RLS en el discovery. Estados reales: `pendiente|aprobada|rechazada|anulada`.)

### Config: SIN TABLA (usa `public.tipos_ausencia`)

`CalendarioConfig` lee/escribe `tipos_ausencia` (schema y RLS en el discovery). **Coordinar con OLA2-14.** Tras 20260514120000 el catalogo real tiene solo 2 filas por empresa (Baja medica, Ausencia justificada); la UI no debe asumir el seed antiguo de 7 filas.

## Interfaces publicas propuestas

### Festivos (NUEVAS) — `src/features/rrhh/actions/festivos-actions.ts`

```ts
export interface FestivoRow {
  id: string;
  empresaId: string;
  fecha: string;          // YYYY-MM-DD
  nombre: string;
  tipo: "nacional" | "autonomico" | "local";
  region: string | null;
  activo: boolean;
}

export interface NuevoFestivoInput {
  fecha: string;
  nombre: string;
  tipo: "nacional" | "autonomico" | "local";
  region?: string | null;   // requerido si tipo != 'nacional'
}

// UUID de empresa derivado server-side (patron getContext); NO recibe slug.
export async function listarFestivos(): Promise<{ ok: boolean; data: FestivoRow[]; error?: string }>;
export async function crearFestivo(input: NuevoFestivoInput): Promise<{ ok: boolean; data?: FestivoRow; error?: string }>;
export async function eliminarFestivo(id: string): Promise<{ ok: boolean; error?: string }>;
```

### Festivo en fecha (CONSERVAR logica de vispera, alimentar de BD)

```ts
// data/calendarios.ts (a reubicar): se conserva la firma pura sobre un array ya cargado.
export function getFestivoEnFecha(
  festivos: FestivoRow[] | Festivo[],
  fechaISO: string,
): { tipo: "festivo" | "vispera"; festivo: FestivoRow | Festivo } | null;
// Nota: hoy la firma es getFestivoEnFecha(empresaId: string, fechaISO) y resuelve el array via mock.
// Al de-mockear, recibe el array real del tenant (cargado una vez por contexto/cache) para no
// convertir la funcion en async. Adaptar sus 3 consumidores en consecuencia.
```

### Ausencias read-only (proyeccion de solicitudes_personal)

```ts
// Reutiliza la action existente (NO se reinventa):
//   listarSolicitudesEmpresa("todas"): { ok; data: SolicitudPersonal[]; error? }
// Proyector puro fila -> item de calendario, por modalidad.
// src/features/rrhh/lib/ausencias-calendario-map.ts
export type ModalidadAusencia = "vacaciones" | "bajas" | "justificadas";

const MODALIDAD_TO_SUBTIPO: Record<ModalidadAusencia, "vacaciones" | "baja_medica" | "permiso"> = {
  vacaciones: "vacaciones",
  bajas: "baja_medica",
  justificadas: "permiso",
};

// Devuelve los items que CalendarioAusencias ya consume (id, empleadoNombre, departamento,
// fechaInicio, fechaFin?, estado, detalle?, tipo?), filtrando tipo='ausencia' + subtipo,
// con estado normalizado al enum real (ESTADO_LABEL).
export function proyectarAusenciasCalendario(
  solicitudes: SolicitudPersonal[],
  modalidad: ModalidadAusencia,
): AusenciaItem[];
```

### Config (get/set sobre tipos_ausencia)

```ts
// Reutilizar/coordinar con OLA2-14. Si OLA2-05 expone su propio acceso:
// src/features/rrhh/actions/tipos-ausencia-actions.ts  (o el que defina OLA2-14)
export async function getConfigAusencias(): Promise<{ ok: boolean; data: TipoAusenciaRow[]; error?: string }>;
export async function setConfigAusencia(
  id: string,
  patch: Partial<Pick<TipoAusenciaRow,
    "requiereAprobacion" | "requiereJustificante" | "descuentaJornada" |
    "reflejaCalendario" | "color" | "limiteDias" | "conteoDias" | "remunerada">>,
): Promise<{ ok: boolean; error?: string }>;
// La forma exacta debe acordarse con OLA2-14 para no duplicar el contrato de tipos_ausencia.
```

## Flujo operativo esperado (fases)

1. **Fase 0 - Verificacion de schema (prod).** Confirmar via Management API: CHECK vigente de `solicitudes_personal.subtipo`/`.estado`; columnas `limite_dias`/`conteo_dias`/`remunerada` y nº de filas reales de `tipos_ausencia` por empresa; **inexistencia** de `festivos`/`calendario_laboral`. Anotar divergencias con el SQL.
2. **Fase 1 - Coordinacion con OLA2-14.** Cerrar D7 (turnos: delegar/fuera de alcance) y el contrato de `tipos_ausencia` (owner del get/set). Sin esto, no tocar `CalendarioLaboral` ni la persistencia de config.
3. **Fase 2 - Tabla `festivos` + RLS + CRUD.** Migracion idempotente verificada; `festivos-actions.ts` (`listar/crear/eliminar`) scoped por UUID. Seed opcional de festivos del mock.
4. **Fase 3 - Festivos reales en cliente.** Cargar festivos del tenant (contexto/cache), adaptar `getFestivoEnFecha` para operar sobre el array real, y cablear los 3 consumidores (`CalendarioLaboral`, `CalendarioAusencias::FestivoMarker`, `CalendarioPersonal`). Conectar el bloque de festivos de `CalendarioConfig` al CRUD real.
5. **Fase 4 - Ausencias read-only.** Implementar `proyectarAusenciasCalendario` y reescribir `CalendariosRRHHView` para alimentar Vacaciones/Bajas/Justificadas desde `listarSolicitudesEmpresa("todas")` (UUID), normalizando estados. Botones "Registrar..." -> placeholder honesto o enlace a `SolicitudesView` (salvo que D5 = write).
6. **Fase 5 - Config sobre `tipos_ausencia`.** Conectar `CalendarioConfig` (get/set) segun el contrato acordado en Fase 1.
7. **Fase 6 - Pestana Laboral (segun D7).** Delegar a Horarios (`rrhh_turnos`) o dejar fuera de alcance con placeholder honesto. No crear tabla de turnos.
8. **Fase 7 - Slug -> UUID + retirada de mock.** Auditar que ningun punto pasa `empresaActual.id` a datos reales (incluido `CalendarioPersonal`); retirar `data/calendarios.ts` como fuente funcional (reubicar `getFestivoEnFecha`/`REGIONES_ESPANA`/tipos si se reutilizan).
9. **Fase 8 - Validacion.** `typecheck` + `build` (WSL) + smoke RRHH<->empleado<->`SolicitudesView` + verificacion BD + RLS cross-tenant.

## Decisiones de negocio pendientes

- **D5 (ausencias: read-only vs escritura).** Las pestanas Vacaciones/Bajas/Justificadas, ¿son **read-only** (proyeccion de `solicitudes_personal`) o el boton "Registrar..." debe **crear** una solicitud reusando `crearSolicitudPersonal`? **Recomendacion (discovery): read-only en OLA2-05.** El alta ya tiene flujo completo y delicado (limites anuales, preaviso de baja_contrato, push, emails, RLS `insert_own`); duplicarlo en calendarios arriesga inconsistencias. Si se quiere alta desde el calendario, hacerlo en task posterior reutilizando la action existente (no reimplementando). Mientras, "Registrar..." = placeholder honesto o enlace a `SolicitudesView`.
- **D7 (pestana Laboral: mantener o delegar).** ¿La pestana Laboral de calendarios se **mantiene** (conectada a dato real coordinado con OLA2-14) o se **delega** al modulo Horarios real (`rrhh_turnos`)? **Recomendacion:** delegar/enlazar a Horarios para evitar la tercera representacion de turnos; si se mantiene en calendarios, debe leer `rrhh_turnos` (no una tabla nueva). Afecta OLA2-05 y OLA2-14.
- **D5-bis (granularidad de festivos por local).** ¿`festivos` se modela solo por `empresa_id` o tambien por `local_id` (festivos locales que varian entre locales de la misma empresa)? Recomendacion: solo `empresa_id` por simetria; anadir `local_id` solo si negocio lo exige.

(Estas decisiones no las toma el agente; se elevan al responsable. El nucleo de OLA2-05 -festivos reales + ausencias read-only- no depende de D7 ni de D5-bis; D5 solo cambia si los botones "Registrar..." escriben.)

## Paths del proyecto

- Orquestador de tabs (de-mockear, slug->UUID): `src/features/rrhh/components/calendarios/CalendariosRRHHView.tsx`
- Vista generica de ausencias + `FestivoMarker`: `src/features/rrhh/components/calendarios/CalendarioAusencias.tsx`
- Config (conectar a `tipos_ausencia` + CRUD festivos): `src/features/rrhh/components/calendarios/CalendarioConfig.tsx`
- Pestana turnos (D7 / coordinar OLA2-14): `src/features/rrhh/components/calendarios/CalendarioLaboral.tsx`
- Mock + `getFestivoEnFecha` + `REGIONES_ESPANA` (retirar como fuente; conservar utilidades): `src/features/rrhh/data/calendarios.ts`
- IO de vacaciones (hoy sobre mock; revisar coherencia): `src/features/rrhh/io/calendarios.io.ts`
- Fuente REAL de ausencias (reutilizar): `src/features/mi-panel/actions/mi-panel-actions.ts`
- Enums/labels (verdad): `src/features/mi-panel/types/index.ts`
- Consumidor RRHH real de solicitudes (patron): `src/features/rrhh/components/solicitudes/SolicitudesView.tsx`
- Consumidor empleado de festivos (no romper): `src/features/mi-panel/components/CalendarioPersonal.tsx`
- Empresa activa (slug vs UUID): `src/features/empresa/contexts/empresa-context.tsx`
- Actions nuevas (propuestas): `src/features/rrhh/actions/festivos-actions.ts`
- Proyector nuevo (propuesto): `src/features/rrhh/lib/ausencias-calendario-map.ts`
- Migracion nueva (propuesta): `supabase/migrations/<timestamp>_festivos.sql`
- Migraciones de referencia: `supabase/migrations/050_mi_panel_solicitudes.sql`, `085_horarios_tipos_ausencia_y_fichaje.sql`, `20260514120000_tipos_ausencia_sesame_alignment.sql`, `20260526160000_solicitudes_personal_baja_contrato.sql`

## Agentes recomendados

- **create-supabase-table-rls-base**: para crear `festivos` (tabla + RLS multi-tenant por `empresa_id`) con el patron del proyecto.
- **generate-data-access-layer** / patron de server actions: para `festivos-actions.ts` (CRUD) y el proyector de ausencias.
- **review-rls-multi-tenant**: validar la RLS de `festivos` (read/write scoped) antes de cerrar; confirmar que ausencias respetan la RLS ya vigente de `solicitudes_personal`.
- **detect-overarchitecture**: chequeo explicito de que NO se crean tablas para ausencias ni una tercera de turnos (riesgo central de esta task).
- **golden-path-review** o **review-repo-coherence**: revision final (sin mock funcional, sin slug en datos reales, empleado sigue viendo festivos).
- Ejecutor humano (Fernando): `typecheck`/`build` por WSL, smoke con switcher de empresa y verificacion BD via Management API.

## Checklist de cierre

- [ ] Fase 0: schema verificado en prod (CHECK subtipo/estado de `solicitudes_personal`; columnas de `tipos_ausencia`; inexistencia de `festivos`).
- [ ] D7 cerrada (turnos) y contrato de `tipos_ausencia` acordado con OLA2-14.
- [ ] Migracion `festivos` aplicada (idempotente) con RLS multi-tenant verificada.
- [ ] `festivos-actions.ts` (`listar/crear/eliminar`) scoped por UUID; sin slug.
- [ ] `getFestivoEnFecha` alimentado de BD; 3 consumidores (RRHH x2 + empleado) muestran festivos reales y vispera.
- [ ] Vacaciones/Bajas/Justificadas pintadas read-only desde `solicitudes_personal`; mapeo vacaciones/baja_medica/permiso; estados normalizados.
- [ ] Botones "Registrar..." resueltos segun D5 (placeholder/enlace si read-only).
- [ ] `CalendarioConfig` lee/escribe `tipos_ausencia` real (coordinado).
- [ ] Pestana Laboral resuelta segun D7 (sin tercera tabla de turnos).
- [ ] Ningun punto pasa `empresaActual.id` (slug) a una query real (incluido `CalendarioPersonal`).
- [ ] `data/calendarios.ts` retirado como fuente funcional; utilidades reubicadas/conservadas.
- [ ] `npm run typecheck` verde (WSL).
- [ ] `npm run build` verde (WSL).
- [ ] Smoke: solicitud aprobada aparece en la pestana correcta; festivo creado/eliminado coherente en RRHH y empleado; switcher de empresa no mezcla ni muestra mock.
- [ ] RLS cross-tenant verificada (otra empresa no ve/edita festivos ajenos; ausencias respetan RLS vigente).
- [ ] Estado de blindaje declarado (documentado / no aplica / pendiente) segun `docs/dev/ERRORES.md`.
- [ ] Commit `..._FernandoClaude` + push a `main` tras validacion (lo ejecuta Fernando).

## Siguiente paso sugerido

Confirmar **D5 (read-only)** y **D7 (turnos)** con el responsable y ejecutar la **Fase 0** (verificacion de schema en prod) + **Fase 1** (coordinacion con OLA2-14). Hecho eso, abordar Fases 2-4 (tabla `festivos` + CRUD + festivos reales en cliente + ausencias read-only), que son el nucleo de valor y no dependen de D7. Es una task de "Ola B" de riesgo medio: el unico gap de tabla es `festivos`; el resto es de-mock sobre modelos reales ya existentes.

## Ruta canonica

docs/rrhh-consolidacion/ola2-demock/Full-TASK-OLA2-05-calendarios-festivos-y-ausencias.md
