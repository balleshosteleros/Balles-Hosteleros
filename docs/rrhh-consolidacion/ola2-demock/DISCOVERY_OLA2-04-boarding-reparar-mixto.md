# DISCOVERY OLA2-04 - Boarding: reparar el mixto roto

Fecha: 2026-06-01
Repo: `Balles-Hosteleros`
Plan maestro: `docs/rrhh-consolidacion/ola2-demock/EXECUTION_PLAN_OLA2.md`
Clasificacion: **MIXTO con sesgo fuerte a mock** (tablas reales existen, pero la lectura las descarta y la escritura falla).
Verificacion: codigo y DDL leidos directamente hoy (no inferido de docs).

## Resumen ejecutivo

Boarding (Onboarding / Offboarding) tiene **tablas reales** (`plantillas_boarding`, `procesos_boarding`, migracion `010`) y **actions reales** (`boarding-actions.ts`), pero esta roto en tres ejes a la vez:

1. **Las actions escriben a columnas que NO existen en el DDL** -> los INSERT/UPDATE fallan en runtime. La UI es optimista (actualiza `useState` antes de oir a la action), asi que el fallo es **silencioso**: el usuario ve "creado" pero la BD no persiste nada.
2. **La lectura descarta a proposito la BD y pinta el mock.** El componente llama a las actions reales en `loadData`, comprueba si traen filas, y **en ambas ramas** (con datos o sin datos) renderiza el mock. La lectura real es codigo muerto.
3. **El id-space del empleado esta roto.** El dropdown de "nuevo proceso" se rellena con empleados mock (`data/rrhh.ts`, ids tipo `"h6"`), pero `procesos_boarding.empleado_id` es `uuid -> profiles(user_id)`. Los inserts (cuando lleguen a funcionar) guardan ids sin sentido.

A esto se suman enums divergentes y un CRUD parcial (varias acciones solo mutan `useState`, no persisten).

## Archivos implicados (verificados)

| Archivo | Lineas | Rol | Estado |
| --- | --- | --- | --- |
| `src/features/rrhh/components/boarding/BoardingView.tsx` | 669 | Unico componente; 3 vistas internas (listado / plantillas / detalle) | Lee mock; escritura optimista parcial |
| `src/features/rrhh/data/boarding.ts` | 173 | Mock de plantillas y procesos + tipos TS canonicos | Fuente de verdad de facto de la UI |
| `src/features/rrhh/actions/boarding-actions.ts` | 141 | Server actions reales (Supabase) | Escriben a columnas inexistentes |
| `src/features/rrhh/io/boarding.io.ts` | 40 | Import/Export (`ModuleIO`) | `fetchAll` lee solo mock (`getProcesosPorEmpresa`) |

## DDL real verificado (`supabase/migrations/010_features_restantes.sql`, lin. 380-408)

```sql
create table if not exists public.plantillas_boarding (
  id uuid primary key default gen_random_uuid(),
  empresa_id text not null,
  nombre text not null,
  tipo text not null default 'onboarding',
  tareas jsonb not null default '[]',
  created_at timestamptz not null default now()
);

create table if not exists public.procesos_boarding (
  id uuid primary key default gen_random_uuid(),
  empresa_id text not null,
  empleado_id uuid references profiles(user_id) on delete cascade,
  empleado_nombre text,
  tipo text not null default 'onboarding',
  estado text not null default 'activo',
  plantilla_id uuid references public.plantillas_boarding(id) on delete set null,
  plantilla_nombre text,
  fecha_inicio date default current_date,
  tareas jsonb not null default '[]',
  created_at timestamptz not null default now()
);

alter table public.plantillas_boarding enable row level security;
alter table public.procesos_boarding enable row level security;
create policy "plb_read" on public.plantillas_boarding for select to authenticated using (empresa_id in (select p.empresa_id from profiles p where p.user_id = auth.uid()));
create policy "plb_write" on public.plantillas_boarding for all to authenticated using (true) with check (true);
create policy "prb_read" on public.procesos_boarding for select to authenticated using (empresa_id in (select p.empresa_id from profiles p where p.user_id = auth.uid()));
create policy "prb_write" on public.procesos_boarding for all to authenticated using (true) with check (true);
```

Columnas reales:

- `plantillas_boarding`: `id, empresa_id, nombre, tipo, tareas, created_at`. **NO** tiene `created_by`.
- `procesos_boarding`: `id, empresa_id, empleado_id, empleado_nombre, tipo, estado, plantilla_id, plantilla_nombre, fecha_inicio, tareas, created_at`. **NO** tiene `created_by` ni `updated_at`.

> ADVERTENCIA: este DDL es la migracion versionada. El schema productivo puede diferir (regla del proyecto: verificar con Management API antes de migrar). El contrato OLA2-04 marca este punto como **VERIFICAR SCHEMA REAL**.

## Bugs verificados

### P0 - Escritura a columnas inexistentes (fallo silencioso en prod)

`boarding-actions.ts` inserta/actualiza columnas que el DDL `010` no declara:

- `createPlantilla` (lin. 51): `created_by: user?.id ?? null` -> columna inexistente en `plantillas_boarding`.
- `createProceso` (lin. 106): `created_by: user?.id ?? null` -> columna inexistente en `procesos_boarding`.
- `updateProcesoTareas` (lin. 131): `updated_at: new Date().toISOString()` -> columna inexistente en `procesos_boarding`.

Postgres rechaza el INSERT/UPDATE (`column "created_by" of relation ... does not exist`). Las actions hacen `throw error` y devuelven `{ ok: false }`, pero **la UI ya ha mutado `useState` antes** (patron optimista), de modo que el toast de error pasa desapercibido y los datos no se guardan. Es el bug mas grave: produce la ilusion de persistencia.

### P0 - La lectura real es codigo muerto (`BoardingView.loadData`, lin. 87-108)

```ts
const [pltRes, procRes] = await Promise.all([listPlantillasAction(), listProcesosAction()]);
if (pltRes.ok && pltRes.data.length > 0) {
  // DB has data but shape is flat; fall back to mock for rich nested data
  setPlantillas(getPlantillasPorEmpresa(empresaActual.id));
} else {
  setPlantillas(getPlantillasPorEmpresa(empresaActual.id));
}
if (procRes.ok && procRes.data.length > 0) {
  setProcesos(getProcesosPorEmpresa(empresaActual.id));
} else {
  setProcesos(getProcesosPorEmpresa(empresaActual.id));
}
```

Ambas ramas del `if` pintan el mock. Se invoca a la action real, se descarta su resultado y se renderiza `getPlantillasPorEmpresa` / `getProcesosPorEmpresa`. La BD nunca llega a pantalla. Falta el mapeo snake_case (BD) -> camelCase anidado (TS), y se "resolvio" con un fallback permanente al mock.

### P0 - ID-space empleado roto (mock string vs uuid)

- El dropdown de nuevo proceso usa `getEmpleadosPorEmpresa(empresaActual.id)` (`data/rrhh.ts`), cuyos ids son strings tipo `"h6"`, `"b3"` (verificado: `data/rrhh.ts` lin. 42-62).
- `procesos_boarding.empleado_id` es `uuid references profiles(user_id)`.
- `createProceso` envia `empleado_id: newEmpleadoId` (= `"h6"`) -> aunque el INSERT funcionara, guardaria un id imposible de resolver contra `profiles`.
- La columna `empleado_id` es **nullable**, asi que ni siquiera explota por FK si Supabase no castea; pero el dato queda sin sentido o se pierde.

Dependencia directa de **OLA2-01** (empleados reales como fuente unica): el selector debe emitir el `user_id` (uuid) real, no el id mock.

### P1 - Enums de estado divergentes

| Capa | Valores de estado |
| --- | --- |
| Modelo TS / UI (`data/boarding.ts`, `BoardingView`, `boarding.io.ts`) | `"activo" \| "finalizado" \| "archivado"` |
| Actions + DDL default (`boarding-actions.ts`, `010`) | `"activo" \| "en_progreso" \| "completado"` |

- `createProceso` fuerza `estado: "en_progreso"` (lin. 105); la UI nunca renderiza ese valor (su `estadoBadge` solo mapea `activo`/`finalizado`/`archivado`, lin. 60-68 -> acceso a `undefined`).
- `updateProcesoTareas` setea `"completado"` / `"en_progreso"` (lin. 130).
- Hay que **reconciliar un unico vocabulario** y mapearlo de forma estable en lectura y escritura.

### P1 - CRUD parcial (solo `useState`, sin persistencia)

Verificado en `BoardingView.tsx`:

- `toggleTarea` (lin. 194-202): llama a `updateProcesoTareasAction`, pero con `updated.id` que es un id mock (`proc-h1`, `proc-...`), no el uuid de BD -> el `update().eq("id", id)` no casa con ninguna fila aunque la columna existiera.
- `finalizarProceso` (lin. 204-208): solo `setProcesos`. **No persiste.**
- `archivarProceso` (lin. 210-213): solo `setProcesos`. **No persiste.** (Ademas el estado `archivado` no existe en la BD).
- `duplicarProceso` (lin. 215-225): solo `setProcesos`. **No persiste.**
- `guardarPlantilla` en modo edicion (lin. 249-251): solo `setPlantillas`. **No persiste** (no hay `updatePlantilla` action).
- `eliminarPlantilla` (lin. 262-265): solo `setPlantillas`. **No persiste** (no hay `deletePlantilla` action).
- `createPlantilla` / `createProceso`: si llaman a la action, pero fallan por el bug P0 de columnas.

### P1 - RLS write permisiva (multi-tenant roto en escritura)

`plb_write` y `prb_write` son `for all ... using (true) with check (true)`. Cualquier usuario autenticado puede escribir/leer filas de cualquier empresa via escritura directa. El READ ya filtra por `empresa_id` del profile; el WRITE no. Hallazgo transversal #3 del plan maestro.

## Contrato de datos: TS (UI) vs actions/BD

Modelo TS canonico (`data/boarding.ts`, verificado):

```ts
export type TipoBoarding = "onboarding" | "offboarding";
export type EstadoProceso = "activo" | "finalizado" | "archivado";

export interface TareaPlantilla { id: string; nombre: string; orden: number; }
export interface PlantillaBoarding { id: string; nombre: string; tipo: TipoBoarding; empresaId: string; tareas: TareaPlantilla[]; }

export interface TareaProceso { id: string; nombre: string; completada: boolean; fechaCompletado: string | null; orden: number; }
export interface ProcesoBoarding {
  id: string; empleadoId: string; tipo: TipoBoarding; estado: EstadoProceso;
  plantillaId: string; plantillaNombre: string; fechaInicio: string; empresaId: string;
  tareas: TareaProceso[];
}
```

Shape que esperan las actions (`boarding-actions.ts`, verificado) — **divergente**:

- `createPlantilla(input)`: `{ nombre, tipo, tareas: { titulo; descripcion?; orden }[] }` (tarea = `titulo`, no `nombre`).
- `createProceso(input)`: `{ empleado_nombre, empleado_id?, plantilla_id?, tipo, fecha_inicio, tareas: { titulo; completada }[] }` (tarea de proceso sin `orden` ni `fechaCompletado`).
- `updateProcesoTareas(id, tareas: { titulo; completada }[])`.

Disonancia clave en el JSONB `tareas`:

| Concepto | TS (UI) | Actions/BD JSONB |
| --- | --- | --- |
| Nombre de tarea | `nombre` | `titulo` |
| Orden | `orden` | (ausente) |
| Fecha completado | `fechaCompletado` | (ausente) |
| Id de tarea | `id` | (ausente) |

El mapeo bidireccional snake/JSONB <-> TS es parte del trabajo (Fase 3-4 del contrato).

## Integracion y oportunidades (verificado)

- **Alta de empleado NO crea proceso de boarding.** El nucleo canonico `src/features/rrhh/services/empleados-core.ts` (`altaUsuarioEmpleado`, lin. 102-190) crea en cascada `auth.user -> profile -> user_roles -> user_empresas -> empleado` y devuelve `{ ok, userId, empleadoId, tempPassword }`. **No toca boarding.** Oportunidad (opcional, decision de negocio): auto-crear un `proceso_boarding` de tipo onboarding al alta. Nota de id-space: `altaUsuarioEmpleado` devuelve `empleadoId` (= `empleados.id`) y `userId` (= `profiles.user_id`); `procesos_boarding.empleado_id` referencia **`profiles.user_id`**, asi que la integracion debe usar `userId`, no `empleadoId`.
- **Tareas tipo "Contrato firmado digitalmente" NO conectan con firmas.** En las plantillas mock existen tareas como "Contrato firmado digitalmente por el empleado" (`data/boarding.ts` lin. 49, 77, 94...), pero son checkbox manual; no hay enlace con `firmas-actions.ts`. Nota de id-space adicional: `crearFirma(formData)` (`firmas-actions.ts` lin. 199-234) referencia al empleado por **`empleados.id`** (no por `profiles.user_id`). Una eventual auto-marca de la tarea al completar la firma requiere resolver el puente `empleados.id` <-> `profiles.user_id`. Decision de negocio.
- **No confundir con `OnboardingGuard`.** El "onboarding" de `features/formacion` / `OnboardingGuard` (web-tour + localStorage) es OTRO concepto (formacion inicial), no el boarding RRHH. Lo trata OLA2-08, no esta task.

## Slug vs UUID de empresa

- `empresaActual.id` = slug (`"habana"`, `"bacanal"`); `empresaActual.dbId` = uuid real (verificado en `empresa-context.tsx` lin. 15, 181).
- Las actions actuales resuelven `empresaId` server-side con `getEmpresaActivaForUser` (no reciben el slug), lo cual es correcto. El DDL declara `empresa_id text`, asi que conviven texto y uuid; el contrato debe fijar que el `empresa_id` persistido sea el **uuid (`dbId`)** y que el READ filtre coherentemente (criterio global del plan).

## Conclusion

Boarding NO es "hacer real desde cero": ya tiene tablas, actions y modelo. Es una **reparacion quirurgica** en 5-6 fases: (1) migracion correctiva de columnas + enums + RLS, (2) unificar id-space empleado con OLA2-01, (3) leer BD en vez de mock con mapeo snake/JSONB -> TS, (4) completar el CRUD que hoy solo vive en `useState`, (5) endurecer RLS write a multi-tenant real, (6) opcional integracion alta/firma (decisiones de negocio).

Contrato ejecutable: `docs/rrhh-consolidacion/ola2-demock/Full-TASK-OLA2-04-boarding-reparar-mixto.md`.
