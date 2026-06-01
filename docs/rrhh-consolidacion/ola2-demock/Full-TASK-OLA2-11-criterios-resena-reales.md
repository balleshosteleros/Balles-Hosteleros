# Full-TASK-OLA2-11 - Criterios de resena reales

## Estado
PLANIFICADO (Ola 2 de-mock, 2026-06-01). No implementado. Discovery en `DISCOVERY_OLA2-11-criterios-resena-reales.md`.

## Objetivo
Retirar el store en RAM de criterios de resena (`criteriosResenaStore.ts`) y persistirlos en una tabla real `public.criterios_resena` multi-tenant por `empresa_id`, con CRUD via server actions y seed inicial desde `CRITERIOS_RESENA_DEFAULT`. Como el discovery revela que **las resenas del candidato tampoco se persisten** (no hay columna en `candidatos`, el campo `Candidato.resenas` es solo estado de React), esta task tambien **decide y cablea** donde se guardan las resenas (DN-2), para no dejar la pestana "Resenas" del `CandidatoDetailModal` medio real. Sustituir `useCriteriosResena()` por una lectura de datos reales y la `guardar()` de `ResenasTab` por una server action.

## Estimacion de complejidad
Baja. Es 1 tabla + RLS + 4 actions de CRUD de criterios + reemplazo de un hook con un unico consumidor. El unico vector que sube el coste es la decision DN-2 (persistir resenas): si se resuelve como columna `resenas jsonb` en `candidatos` (recomendado), sigue siendo baja (1 columna + 1 action + 1 mapeo); si se opta por tabla aparte de resenas, sube a media. Verificacion de schema real (PROD) y mapeo slug->uuid son los puntos de cuidado.

## Criterio de corte
- `src/features/rrhh/data/criteriosResenaStore.ts` eliminado; `grep -rln "criteriosResenaStore\|useCriteriosResena\|addCriterioResena\|renameCriterioResena\|removeCriterioResena" src` -> vacio.
- Tabla `public.criterios_resena` (id uuid, empresa_id, nombre, orden, created_at) creada con RLS multi-tenant estricta por `empresa_id` (NO `using(true)`); seed inicial por empresa desde `CRITERIOS_RESENA_DEFAULT`.
- Actions CRUD de criterios (`list/crear/renombrar/eliminar`) operativas y multi-tenant; `CandidatoDetailModal` (`ResenasTab`) lee los criterios reales y ordena por `orden`.
- Las resenas del candidato persisten segun DN-2 (recomendado: columna `resenas jsonb` en `candidatos`): `guardar()` llama a una server action; tras recargar, la resena sigue ahi.
- `ResenaCriterio.criterioId` referencia el uuid real del criterio (dbId), no el slug; el seed mapea los slugs historicos por nombre para no romper resenas previas.
- Empty state honesto si una empresa no tiene criterios (ya existe en el modal); no romper la pestana cuando `criterios = []`.
- `npm run typecheck` y `npm run build` verdes (WSL NON-login).
- Schema real verificado via Management API antes de migrar/cablear.
- OLA2-10 cerrada (o coordinada) antes de tocar el dominio reclutamiento.

## Modo operativo
(taskId: OLA2-11 / taskMode: code / reviewMode: standard / sourcePlan: docs/rrhh-consolidacion/ola2-demock/EXECUTION_PLAN_OLA2.md)

## Contexto previo obligatorio
1. Leer `DISCOVERY_OLA2-11-criterios-resena-reales.md` (estado real: doble mock — criterios en RAM + resenas no persistidas).
2. **OLA2-10 (roles-empresa unificar)** es la dependencia: mismo dominio reclutamiento. Ejecutar OLA2-11 despues para reutilizar su patron de tabla+RLS+actions y no chocar en el feature. (Al 2026-06-01 OLA2-10 aun no tiene Full-TASK ni discovery escritos; coordinar.)
3. Leer `src/features/rrhh/data/criteriosResenaStore.ts`: patron `useSyncExternalStore`, ids slug, `CRUD` en RAM. Es el unico mock a retirar de criterios.
4. Leer `src/features/rrhh/data/reclutamiento.ts`: `CRITERIOS_RESENA_DEFAULT` (l.153, semilla), `CriterioResena`/`ResenaCriterio`/`ResenaCandidato` (l.148-172), `Candidato.resenas` (l.203, opcional "para no romper BD").
5. Leer `src/features/rrhh/components/reclutamiento/CandidatoDetailModal.tsx`: unico consumidor; `ResenasTab` (l.620) usa `useCriteriosResena` y `guardar()` (l.654) hace solo `onUpdate(...)` (sin persistencia). Empty state en l.670.
6. Leer `src/features/rrhh/actions/reclutamiento-actions.ts` (`getContext`/`getEmpresaActivaForUser`, `listVacantesConCandidatos` l.190 sin `resenas`, `updateCandidato` l.262 sin `resenas`) y `candidatos-actions.ts` (mismo patron). Es donde viven las actions del dominio.
7. Leer `supabase/migrations/010_features_restantes.sql` l.464-482: DDL/RLS reales de `candidatos` (sin columna resenas; `cand_write` laxo). NOTA: el codigo usa columnas no presentes en 010 -> el schema PROD esta por delante; verificar.
8. Criterios globales Ola 2: RLS multi-tenant real, UUID no slug, placeholder honesto donde falte backend, verificar schema PROD via Management API.

## Scope IN
- Crear `public.criterios_resena` (id uuid, empresa_id, nombre, orden, created_at) + RLS multi-tenant estricta por `empresa_id`.
- Seed inicial de criterios por empresa desde `CRITERIOS_RESENA_DEFAULT` (5 criterios) — via migracion (backfill para empresas existentes) y/o on-demand al primer acceso.
- Actions CRUD de criterios en el feature reclutamiento: `listCriteriosResena`, `crearCriterioResena`, `renombrarCriterioResena`, `eliminarCriterioResena` (multi-tenant, patron `{ ok, ... }`).
- Reemplazar `useCriteriosResena()` por lectura de criterios reales en `CandidatoDetailModal` (server data via props desde `ReclutamientoView`, o hook que consuma la action). Ordenar por `orden`.
- Persistir las resenas del candidato (DN-2): cablear `ResenasTab.guardar()` a una server action de guardado de resena; hidratar `Candidato.resenas` desde BD en `listVacantesConCandidatos`.
- Migrar `ResenaCriterio.criterioId` de slug a uuid (dbId); seed mapea slugs historicos por nombre.
- Retirar `criteriosResenaStore.ts`.

## Scope OUT
- NO construir una pantalla nueva de administracion de criterios ("Configuracion -> Candidatos"): no existe hoy y queda fuera del corte de esta task pequena (el CRUD queda accesible por actions; el empty state del modal se mantiene honesto). Si se quiere UI de gestion, va en task aparte.
- NO redefinir roles/vacantes ni el modelo de reclutamiento (eso es OLA2-10). Esta task solo anade criterios + persistencia de resenas.
- NO tocar el escalar `candidatos.puntuacion` (la pestana de resenas no lo usa); no se reutiliza para resenas.
- NO cambiar autor/fecha a modelo de identidad rico mas alla de capturar `created_by`/timestamptz de servidor si DN-3 lo decide; por defecto se conserva el comportamiento actual (autor textual).
- NO romper `createCandidato`/`updateCandidato`/promocion existentes.

## Restricciones
- Server actions reciben/derivan el UUID de empresa server-side (patron `getEmpresaActivaForUser`), NUNCA el slug; el `empresa_id` de la tabla nueva iguala la convencion real de `candidatos` (verificar tipo en PROD: text vs uuid).
- RLS multi-tenant real por `empresa_id` en `criterios_resena`; NADA de `using(true) with check(true)` (no copiar el `cand_write` laxo de 010).
- Reutilizar el patron `getContext()` + `{ ok, data }`/try-catch + `revalidatePath("/rrhh/reclutamiento")` de las actions existentes del feature.
- Verificar schema real en PROD via Management API antes de migrar o cablear (no inferir del DDL 010). Marcar VERIFICAR-SCHEMA-REAL en el modelo.
- Mantener `CriterioResena`/`ResenaCriterio`/`ResenaCandidato` como contrato; ajustar solo el tipo de `id`/`criterioId` a uuid.
- Commits terminan en `_FernandoClaude`; push directo a `main` tras typecheck+build verdes.
- Restaurar `next-env.d.ts` si el tooling lo modifica.

## Validacion requerida
- `wsl -d Ubuntu bash -c "cd /home/fernandomp/dev/Balles-Hosteleros && npm run typecheck"` -> verde.
- `wsl -d Ubuntu bash -c "cd /home/fernandomp/dev/Balles-Hosteleros && npm run build"` -> verde.
- `grep -rln "criteriosResenaStore\|useCriteriosResena" src` -> sin referencias (mock retirado).
- Verificacion en PROD (Management API): `criterios_resena` existe con RLS por `empresa_id`; seed presente para empresas existentes; columna/tabla de resenas (segun DN-2) existe.
- Smoke manual: abrir el modal de un candidato real de HABANA y de BACANAL; comprobar que (a) los criterios se ven y se ordenan, (b) crear/renombrar/eliminar un criterio persiste tras recargar y es por empresa (no se filtra a la otra), (c) guardar una resena persiste tras recargar.
- `review-rls-multi-tenant` sobre `criterios_resena` (+ la solucion de resenas); `golden-path-review` sobre las actions y su consumo en el modal.

## Dependencias
- Entrantes (bloquean a OLA2-11): **OLA2-10** (roles-empresa unificar, mismo dominio reclutamiento). Coordinar para no chocar en el feature ni duplicar el patron tabla+RLS+actions.
- Coordinacion: estado real de `candidatos` (compartido con OLA2-10 y con `reclutamiento.ts`).
- Salientes: ninguna task depende de OLA2-11.

## Inputs
- `src/features/rrhh/data/criteriosResenaStore.ts` (mock a retirar).
- `src/features/rrhh/data/reclutamiento.ts` (`CRITERIOS_RESENA_DEFAULT`, tipos `CriterioResena`/`ResenaCriterio`/`ResenaCandidato`, `Candidato.resenas`).
- `src/features/rrhh/components/reclutamiento/CandidatoDetailModal.tsx` (`ResenasTab`, unico consumidor; `guardar()` l.654; empty state l.670).
- `src/features/rrhh/components/reclutamiento/ReclutamientoView.tsx` y `KanbanPipeline.tsx` (origen de `onUpdateCandidato` / propagacion de criterios a la vista).
- `src/features/rrhh/actions/reclutamiento-actions.ts` (`getContext`, `listVacantesConCandidatos`, `updateCandidato`) y `candidatos-actions.ts` (patron de actions del dominio).
- `supabase/migrations/010_features_restantes.sql` (DDL/RLS de `candidatos`), `002_align_profiles_and_roles.sql` (empresas.id uuid; patron RLS por `profiles`).
- Outputs de OLA2-10 (patron de tabla/RLS del dominio reclutamiento) cuando exista.

## Outputs esperados
- Migracion `.sql` nueva: `public.criterios_resena` + RLS multi-tenant + seed/backfill desde `CRITERIOS_RESENA_DEFAULT`; y, segun DN-2, columna `resenas jsonb` en `candidatos` (o tabla `candidato_resenas`).
- Actions nuevas (en `reclutamiento-actions.ts` o nuevo `criterios-resena-actions.ts`): CRUD de criterios + guardado/hidratacion de resenas de candidato.
- `CandidatoDetailModal`/`ResenasTab` consumiendo criterios reales y persistiendo resenas via action; `listVacantesConCandidatos` hidratando `Candidato.resenas`.
- `criteriosResenaStore.ts` eliminado; `Candidato.resenas` ya no es solo estado de cliente.

## Riesgos conocidos
- **Doble mock no resuelto**: persistir criterios sin persistir resenas deja la pestana medio real. Mitigacion: resolver DN-2 en la misma task (recomendado: `resenas jsonb` en `candidatos`).
- **Slug vs uuid**: las resenas previas (en RAM) referencian `criterioId` por slug; las nuevas por uuid. Mitigacion: el seed mapea slugs historicos por nombre; al ser estado volatil, no hay datos historicos reales que migrar (las resenas tampoco persistian) — riesgo bajo.
- **empresa_id text vs uuid**: `empresas.id` es uuid pero `candidatos.empresa_id` es text (010). Mitigacion: igualar la convencion REAL de `candidatos` tras verificar PROD; no inventar un tipo distinto que rompa los joins/filtros del feature.
- **RLS laxa heredada**: copiar `cand_write using(true)` reabriria el agujero multi-tenant. Mitigacion: policy estricta por `empresa_id` via `profiles`; revisar con `review-rls-multi-tenant`.
- **Schema real != migracion 010**: el codigo usa columnas de `candidatos` ausentes del DDL 010 -> PROD esta por delante. Mitigacion: Management API antes de decidir/migrar.
- **Multiples consumidores de la vista**: `ReclutamientoView`/`KanbanPipeline` propagan `onUpdateCandidato`; cablear la persistencia de resenas sin romper la actualizacion optimista de la UI. Mitigacion: la action guarda y la UI sigue reflejando el cambio (optimista + revalidate).

## Modelo de datos propuesto
> Marca global: **VERIFICAR-SCHEMA-REAL via Management API** antes de migrar o cablear. No inferir del DDL 010 (PROD esta por delante).

### Se CREA: `public.criterios_resena` (catalogo de criterios por empresa)
- `id uuid primary key default gen_random_uuid()` — sustituye el slug del store por dbId.
- `empresa_id <text|uuid> not null` — **VERIFICAR-SCHEMA-REAL**: igualar el tipo real de `candidatos.empresa_id` (en 010 es `text`); FK a `empresas(id)` si el tipo lo permite, o constraint logica si es text.
- `nombre text not null`
- `orden int not null default 0` — orden de presentacion (el store usaba orden de insercion).
- `created_at timestamptz not null default now()`
- (opcional) `updated_at timestamptz` + trigger si se quiere auditar renombrados.
- Indice/constraint: `unique (empresa_id, nombre)` para evitar duplicados; indice `(empresa_id, orden)`.
- **RLS multi-tenant estricta** (no `using(true)`):
  - read: `empresa_id in (select p.empresa_id from profiles p where p.user_id = auth.uid())`.
  - write (insert/update/delete): mismo predicado en `using` y `with check` (NO `with check(true)`).
- **Seed**: para cada empresa existente, insertar los 5 de `CRITERIOS_RESENA_DEFAULT` con `orden` 0..4 (backfill en migracion). On-demand opcional: si una empresa no tiene criterios al primer `list`, sembrar.

### Donde se guardan las resenas en si (DN-2) — VERIFICAR-SCHEMA-REAL
Hoy NO se guardan (no hay columna en `candidatos`; `Candidato.resenas` es estado de cliente). Dos opciones:
- **Opcion A (recomendada, baja complejidad): columna `resenas jsonb` en `public.candidatos`.**
  - `alter table public.candidatos add column if not exists resenas jsonb not null default '[]'::jsonb`.
  - Cada elemento = `ResenaCandidato` (`{ id, autor, fecha, puntuaciones: [{criterioId, estrellas}], comentario? }`), con `criterioId` = uuid del criterio.
  - Reusa la RLS ya existente de `candidatos`; `updateCandidato` (o nueva action) hace merge/append del array. Lo mas barato y alineado con el modelo actual.
- **Opcion B (mayor aislamiento, media complejidad): tabla `public.candidato_resenas`.**
  - `id uuid pk`, `empresa_id`, `candidato_id uuid references candidatos(id) on delete cascade`, `autor text`, `created_by uuid references auth.users(id)`, `puntuaciones jsonb` (o tabla hija `candidato_resena_items`), `comentario text`, `created_at timestamptz`.
  - RLS por `empresa_id`. Mas normalizado y auditable, pero duplica modelo para un dato simple.

## Interfaces publicas propuestas
En `src/features/rrhh/actions/reclutamiento-actions.ts` (o nuevo `src/features/rrhh/actions/criterios-resena-actions.ts`). Firmas orientativas (ajustar a tipos reales tras VERIFICAR-SCHEMA-REAL):

```ts
// CRUD de criterios (multi-tenant; empresa resuelta server-side via getEmpresaActivaForUser)
export async function listCriteriosResena(): Promise<
  { ok: true; data: CriterioResena[] } | { ok: false; data: [] }
>; // ordenados por `orden`; siembra on-demand si la empresa no tiene ninguno

export async function crearCriterioResena(input: { nombre: string }): Promise<
  { ok: true; data: CriterioResena } | { ok: false; error: string }
>; // asigna orden = max(orden)+1; unique (empresa_id, nombre)

export async function renombrarCriterioResena(input: { id: string; nombre: string }): Promise<
  { ok: boolean; error?: string }
>;

export async function eliminarCriterioResena(input: { id: string }): Promise<
  { ok: boolean; error?: string }
>; // (opcional) reordenar `orden` tras borrado

// Guardar resena de un candidato (DN-2). Opcion A: persiste en candidatos.resenas (jsonb).
export async function guardarResenaCandidato(input: {
  candidatoId: string;
  puntuaciones: { criterioId: string; estrellas: number }[]; // criterioId = uuid real
  comentario?: string;
}): Promise<{ ok: boolean; error?: string }>; // append a resenas[]; revalidatePath("/rrhh/reclutamiento")
```
Las acciones de escritura siguen el patron del feature: `getContext()` + `getEmpresaActivaForUser`, validacion de pertenencia por `empresa_id`, `{ ok }`/`friendlyError`, `revalidatePath("/rrhh/reclutamiento")`. La hidratacion de `Candidato.resenas` se hace en `listVacantesConCandidatos` (anadir el campo al mapeo l.190).

## Flujo operativo esperado
**Fase 0 - Verificacion de schema real (Management API) + OLA2-10.** Confirmar tipo real de `candidatos.empresa_id` (text vs uuid), RLS real de `candidatos`, e inexistencia de `criterios_resena` y de columna de resenas. Confirmar que OLA2-10 esta cerrada/coordinada. Resolver DN-2 y DN-1 con el responsable.

**Fase 1 - Migracion.** Crear `public.criterios_resena` + RLS estricta + seed/backfill desde `CRITERIOS_RESENA_DEFAULT`. Segun DN-2, anadir `candidatos.resenas jsonb` (Opcion A) o crear `candidato_resenas` (Opcion B). typecheck/verificacion antes de seguir.

**Fase 2 - Actions.** `listCriteriosResena` (+ siembra on-demand) y `crear/renombrar/eliminar`; `guardarResenaCandidato`; hidratar `resenas` en `listVacantesConCandidatos`. typecheck.

**Fase 3 - Cablear UI.** En `CandidatoDetailModal`/`ResenasTab`: reemplazar `useCriteriosResena()` por criterios reales (props desde `ReclutamientoView` o hook que llame a la action), ordenar por `orden`; cambiar `guardar()` para invocar `guardarResenaCandidato` manteniendo la actualizacion optimista. Mantener el empty state honesto.

**Fase 4 - Retirar mock.** Borrar `criteriosResenaStore.ts`; ajustar `CriterioResena.id`/`ResenaCriterio.criterioId` a uuid. `grep` de criterio de corte vacio.

**Fase 5 - Validar.** typecheck + build verdes (WSL), smoke HABANA/BACANAL (criterios por empresa + resena persistente), revision RLS. Commit `_FernandoClaude` + push a `main`.

## Decisiones de negocio pendientes
- **DN-1 (alcance del de-mock)**: ¿esta task cubre solo los **criterios** (lo que dice el plan) o tambien la **persistencia de las resenas** (mock contiguo que el discovery saca a la luz)? Recomendado: incluir ambas para no dejar la pestana a medias.
- **DN-2 (donde se guardan las resenas)**: ¿columna `resenas jsonb` en `candidatos` (Opcion A, baja complejidad, recomendada) o tabla aparte `candidato_resenas` (Opcion B, mas auditable, media complejidad)? Define el peso de la task.
- **DN-3 (autor/identidad de la resena)**: ¿se conserva el autor textual actual (`"Admin RRHH"`) o se captura `created_by uuid`/usuario real + timestamptz de servidor? Afecta al modelo y a la UI.
- **DN-4 (gestion de criterios en UI)**: ¿se anade en esta task una pantalla minima de administracion de criterios (Configuracion -> Candidatos, hoy inexistente) o se deja el CRUD solo por actions y se mantiene el empty state? Recomendado: fuera de esta task pequena (task aparte).
- **DN-5 (efecto de borrar un criterio)**: ¿borrado fisico (resenas previas quedan con `criterioId` huerfano, ya tolerado por la UI que cae al `criterioId` como nombre) o soft-delete/`activo`? Recomendado: borrado fisico + la UI ya degrada el nombre ausente.

## Paths del proyecto
A crear:
- `supabase/migrations/<NNN>_criterios_resena_y_resenas.sql` (`criterios_resena` + RLS + seed; y segun DN-2, `candidatos.resenas jsonb` o `candidato_resenas`).
- Opcional `src/features/rrhh/actions/criterios-resena-actions.ts` (si no se amplia `reclutamiento-actions.ts`).

A tocar:
- `src/features/rrhh/components/reclutamiento/CandidatoDetailModal.tsx` (`ResenasTab`: criterios reales + `guardar()` -> action).
- `src/features/rrhh/actions/reclutamiento-actions.ts` (actions de criterios/resena + hidratar `resenas` en `listVacantesConCandidatos`).
- `src/features/rrhh/data/reclutamiento.ts` (ajustar `id`/`criterioId` a uuid; conservar `CRITERIOS_RESENA_DEFAULT` como seed).
- `src/features/rrhh/components/reclutamiento/ReclutamientoView.tsx` (propagar criterios reales / wiring de la action si aplica).

A retirar:
- `src/features/rrhh/data/criteriosResenaStore.ts`.

A leer como referencia (no se tocan salvo lo indicado):
- `supabase/migrations/010_features_restantes.sql`, `002_align_profiles_and_roles.sql`.
- `src/features/rrhh/actions/candidatos-actions.ts`.
- Outputs de OLA2-10.

## Agentes recomendados
- Implementacion: agente de codigo Next.js/Supabase (Feature-First, TS estricto).
- Tabla + RLS: skill `create-supabase-table-rls-base` (para `criterios_resena` y, segun DN-2, `candidato_resenas`).
- Revision: `review-rls-multi-tenant` (aislamiento por `empresa_id`, sin `using(true)`) y `golden-path-review` (actions + consumo en el modal).
- Validacion: ejecutor con WSL para `typecheck`/`build` y smoke con navegador (HABANA/BACANAL).

## Checklist de cierre
- [ ] Schema real verificado en PROD (Management API): tipo de `candidatos.empresa_id`, RLS real de `candidatos`, inexistencia de `criterios_resena` y de columna de resenas; DN-1/DN-2 decididos.
- [ ] OLA2-10 cerrada o coordinada (mismo dominio reclutamiento).
- [ ] Migracion aplicada: `criterios_resena` + RLS estricta por `empresa_id` + seed/backfill `CRITERIOS_RESENA_DEFAULT`; resenas persistidas segun DN-2.
- [ ] Actions: `list/crear/renombrar/eliminar` criterios + `guardarResenaCandidato`; `listVacantesConCandidatos` hidrata `resenas`.
- [ ] `CandidatoDetailModal`/`ResenasTab` lee criterios reales (orden por `orden`) y persiste resenas via action; empty state honesto intacto.
- [ ] `ResenaCriterio.criterioId` = uuid (dbId); seed mapea slugs historicos por nombre.
- [ ] `criteriosResenaStore.ts` eliminado; `grep -rln "criteriosResenaStore\|useCriteriosResena" src` -> vacio.
- [ ] RLS revisada: multi-tenant por `empresa_id`, sin `using(true) with check(true)`.
- [ ] `npm run typecheck` y `npm run build` verdes (WSL).
- [ ] Smoke HABANA + BACANAL: criterios por empresa (no se filtran cruzados), alta/edicion/borrado persiste, resena persiste tras recarga.
- [ ] Commit `_FernandoClaude` + push a `main` tras validacion.

## Siguiente paso sugerido
Ejecutar la **Fase 0**: confirmar con OLA2-10 cerrada y verificar via Management API el tipo real de `candidatos.empresa_id` y su RLS, y resolver DN-2 (recomendado: `resenas jsonb` en `candidatos`). Confirmado eso, crear la migracion de `criterios_resena` + seed + (DN-2) columna de resenas (Fase 1) y `typecheck` antes de cablear actions y el modal.

## Ruta canonica
docs/rrhh-consolidacion/ola2-demock/Full-TASK-OLA2-11-criterios-resena-reales.md
