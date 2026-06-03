# Full-TASK-OLA2-04 - Boarding: reparar el mixto roto

## Estado

**IMPLEMENTADO y validado (2026-06-03).** Cierre: `docs/rrhh-consolidacion/ola2-demock/CIERRE_2026-06-03_OLA2-04.md`.

> **Corrección de contrato (schema real manda).** La verificación con Management API reveló que el schema productivo de `plantillas_boarding`/`procesos_boarding` YA estaba migrado y correcto (a diferencia del DDL `010` que leyó el discovery): existen `updated_at`, `iniciado_por` (FK→auth.users), `fecha_fin`; `empresa_id`/`empleado_id` son `uuid NOT NULL`; la RLS YA es multi-tenant (`*_rw_empresa`); y el `estado` YA tiene CHECK canónico `activo|finalizado|archivado`. **No existían** `created_by` ni `empleado_nombre` (de ahí los P0 al escribirlas). Y **`procesos_boarding.empleado_id` es FK a `empleados(id)`, NO a `profiles.user_id`** como asumía este contrato. Conclusión: **no se requirió migración**; el fix fue solo código (alinear actions + componente + IO al schema real) y se persiste `empleados.id` en `empleado_id`. La deuda de reproducibilidad (schema sin `.sql` versionado) es pre-existente y queda anotada.

Discovery de respaldo: `docs/rrhh-consolidacion/ola2-demock/DISCOVERY_OLA2-04-boarding-reparar-mixto.md` (DDL, actions, view, io, modelo TS y nucleo de alta verificados directamente sobre el codigo el 2026-06-01).

## Objetivo

Convertir el submodulo Boarding (Onboarding / Offboarding) de **MIXTO roto** a **real y operativo**: que la pantalla lea y escriba contra `plantillas_boarding` y `procesos_boarding` (no contra el mock), que ninguna escritura falle por columnas inexistentes, que el empleado se identifique por su `user_id` real (no por id mock), que los estados usen un vocabulario unico y que el CRUD persista de verdad (crear/editar/finalizar/archivar/duplicar/eliminar). Cerrar la brecha de seguridad de RLS write permisiva.

## Estimacion de complejidad

**Media.** No es reescritura: las tablas, las actions y el modelo TS ya existen. El esfuerzo se concentra en (a) una migracion correctiva de schema, (b) el mapeo bidireccional snake/JSONB <-> TS anidado, (c) completar las actions que faltan y cablear las mutaciones que hoy solo viven en `useState`, y (d) endurecer RLS. Riesgo controlado por ser un area aislada. Mayor incertidumbre: el schema productivo real (puede diferir del DDL versionado) y la coordinacion del id-space con OLA2-01.

## Criterio de corte

Boarding queda CERRADO cuando:

1. Ninguna escritura referencia columnas inexistentes (verificado contra el schema **real** en prod, no contra el DDL).
2. La pantalla pinta datos de la BD (no del mock); el mock deja de ser fuente funcional de verdad para boarding.
3. Crear/editar/eliminar plantilla y crear/finalizar/archivar/duplicar proceso y marcar tareas **persisten** en BD y sobreviven a un recargado de pagina.
4. El proceso se crea con `empleado_id` = `user_id` real proveniente del selector de empleados de OLA2-01.
5. Existe un unico vocabulario de estado, mapeado de forma estable en lectura y escritura.
6. RLS write es multi-tenant real por `empresa_id` (no `using(true) with check(true)`).
7. `npm run typecheck` y `npm run build` verdes (via WSL).

## Modo operativo

- taskId: **OLA2-04**
- taskMode: **code**
- reviewMode: **standard**
- sourcePlan: `docs/rrhh-consolidacion/ola2-demock/EXECUTION_PLAN_OLA2.md`

## Contexto previo obligatorio

- **OLA2-01 (empleados reales como fuente unica) debe estar CERRADA** antes de ejecutar las fases 2-4. Boarding depende de ella para el id-space del empleado: el selector "nuevo proceso" debe emitir el `profiles.user_id` (uuid) real, sustituyendo a `getEmpleadosPorEmpresa` del mock `data/rrhh.ts`.
- Leer el plan maestro Ola 2 y sus criterios globales (UUID `dbId` no slug, RLS multi-tenant, verificar schema real via Management API, commits y push).
- Leer el DISCOVERY de esta task antes de tocar codigo.

## Scope IN

- Migracion correctiva de `plantillas_boarding` y `procesos_boarding`: anadir `created_by` y `updated_at`, reconciliar el enum de `estado`, endurecer RLS write.
- Reparar `boarding-actions.ts`: alinear los INSERT/UPDATE con el schema real; completar las actions que faltan (`updatePlantilla`, `deletePlantilla`, y operaciones de proceso `finalizar`/`archivar`/`duplicar`).
- Reescribir `BoardingView.loadData` para leer de BD con mapeo snake/JSONB -> TS; retirar el fallback permanente al mock.
- Cablear a persistencia real: `toggleTarea`, `finalizarProceso`, `archivarProceso`, `duplicarProceso`, edicion y borrado de plantilla.
- Unificar id-space empleado: el selector usa empleados reales (OLA2-01) y persiste `user_id`.
- Reconciliar enums de estado en TS, UI, IO y actions.
- Conectar `boarding.io.ts#fetchAll` a la lectura real (export coherente con BD).

## Scope OUT

- No reescribir el componente ni cambiar el diseno/UX de las 3 vistas.
- No ampliar el modelo de boarding mas alla de lo necesario para repararlo (no anadir adjuntos, recordatorios, asignacion de responsable por tarea, etc.).
- No tocar el "onboarding" de formacion (`OnboardingGuard` / web-tour / `features/formacion`): es OTRO concepto, lo cubre OLA2-08.
- No implementar la integracion alta->proceso ni tarea->firma salvo que la decision de negocio (ver seccion) lo apruebe; por defecto quedan documentadas como fase opcional.
- No migrar datos mock historicos a la BD (el mock se retira como fuente, no se "sube").

## Restricciones

- **Verificar el schema productivo real con Management API antes de escribir o aplicar cualquier migracion.** No inferir del codigo ni del DDL versionado (regla de memoria del proyecto; el DDL `010` puede no coincidir con prod).
- RLS multi-tenant real por `empresa_id`; nunca `using(true) with check(true)`.
- Las server actions reciben/resuelven el **UUID de empresa (`dbId`)**, no el slug.
- No reintroducir `src/features/rrhh/data/rrhh.ts` ni `data/boarding.ts` como fuente funcional de verdad.
- Mantener try/catch, errores legibles y comportamiento optimista coherente (revertir el `useState` si la action falla, para no fingir persistencia).
- Commits terminan en `_FernandoClaude`; push directo a `main` tras typecheck+build verdes.
- No versionar peppers, claves SMTP, `CREDENCIALES_ENCRYPTION_KEY` ni service-role.
- Restaurar `next-env.d.ts` si el tooling lo modifica.

## Validacion requerida

- `wsl -d Ubuntu bash -c "cd /home/fernandomp/dev/Balles-Hosteleros && npm run typecheck"` -> sin errores.
- `wsl -d Ubuntu bash -c "cd /home/fernandomp/dev/Balles-Hosteleros && npm run build"` -> build OK.
- Verificacion de schema real en prod (Management API): confirmar columnas de ambas tablas antes y despues de la migracion correctiva.
- Smoke controlado (donde el flujo lo permita): crear plantilla, crear proceso para un empleado real, marcar tareas, finalizar/archivar/duplicar, recargar pagina y confirmar persistencia en BD. Verificar que no quedan filas con `empleado_id` no resoluble en `profiles`.
- Verificar RLS: un usuario de empresa A no puede escribir ni leer filas de boarding de empresa B.

## Dependencias

- **OLA2-01** (empleados reales, fuente unica): bloqueante para fases 2-4 (id-space del selector).
- `src/features/rrhh/services/empleados-core.ts` (`altaUsuarioEmpleado`): solo si se aprueba la integracion alta->proceso (fase 6 opcional).
- `src/features/rrhh/actions/firmas-actions.ts` (`crearFirma`, `getAuditTrail`): solo si se aprueba el enlace tarea-firma (fase 6 opcional).
- Contexto de empresa: `src/features/empresa/contexts/empresa-context.tsx` (`empresaActual.dbId`).
- Resolucion de empresa server-side: `src/features/empresa/lib/empresa-server.ts` (`getEmpresaActivaForUser`).

## Inputs

- DDL versionado: `supabase/migrations/010_features_restantes.sql` (lin. 380-408).
- Schema productivo real (a obtener via Management API).
- Actions actuales: `src/features/rrhh/actions/boarding-actions.ts`.
- Componente: `src/features/rrhh/components/boarding/BoardingView.tsx`.
- Modelo TS y mock: `src/features/rrhh/data/boarding.ts`.
- IO: `src/features/rrhh/io/boarding.io.ts`.
- Fuente de empleados reales que exponga OLA2-01.

## Outputs esperados

- Nueva migracion correctiva en `supabase/migrations/` (numero siguiente disponible), aplicada y reproducible.
- `boarding-actions.ts` con CRUD completo y alineado al schema real.
- `BoardingView.tsx` leyendo de BD con mapeo, sin fallback al mock, con mutaciones persistentes.
- `boarding.io.ts#fetchAll` leyendo de la action real.
- `data/boarding.ts` reducido a tipos TS (o tipos extraidos a su sitio canonico); deja de exportar mock como fuente funcional.
- Validacion verde + smoke documentado.

## Riesgos conocidos

- **Schema real != DDL versionado.** Si prod ya tiene (o no tiene) ciertas columnas, la migracion debe ser idempotente (`add column if not exists`) y no asumir el `010` literal. Riesgo de romper datos por inferir del codigo: mitigado verificando con Management API.
- **Reconciliacion de enums sobre datos existentes.** Si en prod ya hay procesos con `en_progreso`/`completado`, el cambio de vocabulario necesita un `UPDATE` de normalizacion o un mapeo de lectura tolerante. Decidir vocabulario canonico antes de migrar.
- **Patron optimista enmascara fallos.** Hoy oculta los errores P0. Tras la reparacion, hay que asegurar el rollback del `useState` ante `{ ok: false }`, o seguira fingiendo persistencia.
- **Acoplamiento con OLA2-01.** Si OLA2-01 cambia el contrato del selector de empleados, hay que re-tocar el dialogo de "nuevo proceso".
- **JSONB sin id estable de tarea.** El JSONB de la BD no guarda `id`/`orden`/`fechaCompletado`; `toggleTarea` necesita una clave estable (por `orden` o por indice) para no depender de ids mock.
- **Multi-tenant en write.** Mientras RLS sea `using(true) with check(true)`, cualquier reparacion de escritura sigue siendo insegura; endurecerla es parte del corte, no opcional.

## Modelo de datos propuesto

> **VERIFICAR SCHEMA REAL (Management API) antes de redactar y aplicar esta migracion.** Lo que sigue parte del DDL versionado `010`; el schema productivo manda.

Migracion correctiva (idempotente) sobre las dos tablas:

```sql
-- 1. Columnas de auditoria que las actions ya escriben (causa de los fallos P0)
alter table public.plantillas_boarding
  add column if not exists created_by uuid references profiles(user_id) on delete set null;

alter table public.procesos_boarding
  add column if not exists created_by uuid references profiles(user_id) on delete set null,
  add column if not exists updated_at timestamptz not null default now();

-- 2. Reconciliar el enum de estado (decidir vocabulario canonico antes).
--    Opcion recomendada: vocabulario UI canonico = activo | finalizado | archivado.
--    Normalizar datos preexistentes si los hay:
update public.procesos_boarding set estado = 'activo'      where estado = 'en_progreso';
update public.procesos_boarding set estado = 'finalizado'  where estado = 'completado';
--    (alternativa: CHECK constraint o enum nativo; evaluar segun datos reales)

-- 3. Endurecer RLS write a multi-tenant real (reemplaza using(true) with check(true)).
drop policy if exists "plb_write" on public.plantillas_boarding;
create policy "plb_write" on public.plantillas_boarding for all to authenticated
  using (empresa_id in (select p.empresa_id from profiles p where p.user_id = auth.uid()))
  with check (empresa_id in (select p.empresa_id from profiles p where p.user_id = auth.uid()));

drop policy if exists "prb_write" on public.procesos_boarding;
create policy "prb_write" on public.procesos_boarding for all to authenticated
  using (empresa_id in (select p.empresa_id from profiles p where p.user_id = auth.uid()))
  with check (empresa_id in (select p.empresa_id from profiles p where p.user_id = auth.uid()));
```

Decisiones del modelo a fijar en ejecucion:

- **Vocabulario de estado canonico**: unificar en `activo | finalizado | archivado` (lado UI) o en `activo | en_progreso | completado` (lado actions). Recomendacion: el vocabulario UI, por ser el que el usuario ve; las actions dejan de inventar estados.
- **Tipo de `empresa_id`**: el DDL lo declara `text`; persistir el **uuid (`dbId`)** y filtrar coherentemente (el READ ya compara contra `profiles.empresa_id`).
- **JSONB `tareas`**: fijar el shape persistido. Propuesta: incluir `orden` y `fechaCompletado` en el JSONB para no perder informacion en el round-trip (`{ titulo, completada, orden, fechaCompletado }`), o documentar explicitamente que se derivan.

## Interfaces publicas propuestas

Server actions en `src/features/rrhh/actions/boarding-actions.ts` (firmas completas tras la reparacion):

```ts
// Plantillas
export async function listPlantillas(): Promise<
  { ok: true; data: PlantillaBoarding[] } | { ok: false; data: [] }
>;

export async function createPlantilla(input: {
  nombre: string;
  tipo: TipoBoarding;
  tareas: { titulo: string; orden: number }[];
}): Promise<{ ok: true; data: PlantillaBoarding } | { ok: false; error: string }>;

export async function updatePlantilla(input: {
  id: string;
  nombre: string;
  tipo: TipoBoarding;
  tareas: { titulo: string; orden: number }[];
}): Promise<{ ok: true } | { ok: false; error: string }>;

export async function deletePlantilla(
  id: string,
): Promise<{ ok: true } | { ok: false; error: string }>;

// Procesos
export async function listProcesos(): Promise<
  { ok: true; data: ProcesoBoarding[] } | { ok: false; data: [] }
>;

export async function createProceso(input: {
  empleadoId: string;            // = profiles.user_id (uuid real de OLA2-01)
  empleadoNombre: string;
  plantillaId: string;
  tipo: TipoBoarding;
  fechaInicio: string;           // YYYY-MM-DD
  tareas: { titulo: string; completada: boolean; orden: number }[];
}): Promise<{ ok: true; data: ProcesoBoarding } | { ok: false; error: string }>;

export async function updateProcesoTareas(
  id: string,                    // uuid de procesos_boarding (no id mock)
  tareas: { titulo: string; completada: boolean; orden: number; fechaCompletado: string | null }[],
): Promise<{ ok: true } | { ok: false; error: string }>;

export async function setEstadoProceso(
  id: string,
  estado: EstadoProceso,         // vocabulario canonico unico
): Promise<{ ok: true } | { ok: false; error: string }>;

export async function duplicarProceso(
  id: string,
): Promise<{ ok: true; data: ProcesoBoarding } | { ok: false; error: string }>;
```

Notas:

- Las actions devuelven datos ya **mapeados al tipo TS** (`PlantillaBoarding` / `ProcesoBoarding`), no la fila cruda snake_case: el mapeo snake/JSONB -> TS vive en la action, no en el componente.
- `createProceso` recibe `empleadoId` = `user_id` (uuid), no el id mock.
- `setEstadoProceso` cubre finalizar y archivar de forma persistente (sustituye los handlers que hoy solo mutan `useState`).

## Flujo operativo esperado

**Fase 1 - Migracion correctiva de BD.** Verificar schema real (Management API). Crear y aplicar la migracion idempotente: anadir `created_by`/`updated_at`, normalizar `estado` al vocabulario canonico, endurecer RLS write. Confirmar columnas y policies en prod.

**Fase 2 - Unificar id-space empleado con OLA2-01.** Sustituir `getEmpleadosPorEmpresa` (mock) por la fuente real de empleados que expone OLA2-01 en el dialogo "nuevo proceso". El selector emite `user_id` (uuid). `createProceso` persiste ese `user_id` en `procesos_boarding.empleado_id`.

**Fase 3 - Leer BD (no mock) + mapeo.** Reescribir `BoardingView.loadData` para usar `listPlantillasAction` / `listProcesosAction` como **unica** fuente; eliminar el fallback permanente al mock. Implementar el mapeo snake/JSONB -> TS anidado (`titulo`->`nombre`, reconstruir `orden`/`fechaCompletado`/`id` de tarea). Conectar tambien `boarding.io.ts#fetchAll` a la action real.

**Fase 4 - Completar CRUD persistente.** Cablear a actions reales: `toggleTarea` (con clave de tarea estable y uuid de proceso), `guardarPlantilla` en modo edicion (`updatePlantilla`), `eliminarPlantilla` (`deletePlantilla`), `finalizarProceso`/`archivarProceso` (`setEstadoProceso`), `duplicarProceso` (`duplicarProceso` action). Asegurar rollback del `useState` ante `{ ok: false }`.

**Fase 5 - RLS.** Confirmar que las policies endurecidas de la Fase 1 bloquean cross-tenant en write y verificar con un smoke de dos empresas.

**Fase 6 - Opcional (sujeto a decision de negocio).** (a) Auto-crear un `proceso_boarding` onboarding al alta de empleado en `empleados-core.altaUsuarioEmpleado` (usando `userId`, no `empleadoId`). (b) Enlazar tareas tipo "Contrato firmado digitalmente" con `firmas-actions` para que se marquen al completarse la firma (resolviendo el puente `empleados.id` <-> `profiles.user_id`). Solo si se aprueban.

## Decisiones de negocio pendientes

- **DN-1: auto-crear proceso al alta.** ¿El alta de empleado (`altaUsuarioEmpleado`) debe crear automaticamente un proceso de onboarding (con que plantilla por defecto), o el boarding se inicia siempre manualmente desde la pantalla? Afecta la fase 6a.
- **DN-2: enlazar tarea-firma.** ¿Las tareas tipo "Contrato firmado digitalmente" deben marcarse automaticamente cuando la firma real (`firmas-actions`) se completa, o siguen siendo checkbox manual? Implica resolver el puente `empleados.id` <-> `profiles.user_id`. Afecta la fase 6b.
- **DN-3: vocabulario de estado.** Confirmar el vocabulario canonico (`activo|finalizado|archivado` recomendado) y si `archivado` se conserva como estado de primera clase.
- **DN-4: edicion de plantilla con procesos vivos.** ¿Editar una plantilla afecta a procesos ya creados a partir de ella, o las plantillas son inmutables una vez instanciadas? (Hoy el proceso copia las tareas, asi que por defecto: no afecta.)

## Paths del proyecto

- `supabase/migrations/010_features_restantes.sql` (DDL origen a corregir; no editar, crear migracion nueva)
- `supabase/migrations/<siguiente>_boarding_fix.sql` (nueva migracion correctiva)
- `src/features/rrhh/actions/boarding-actions.ts`
- `src/features/rrhh/components/boarding/BoardingView.tsx`
- `src/features/rrhh/data/boarding.ts`
- `src/features/rrhh/io/boarding.io.ts`
- `src/features/rrhh/services/empleados-core.ts` (solo fase 6a)
- `src/features/rrhh/actions/firmas-actions.ts` (solo fase 6b)
- `src/features/empresa/contexts/empresa-context.tsx` (lectura de `dbId`)
- `src/features/empresa/lib/empresa-server.ts` (`getEmpresaActivaForUser`)

## Agentes recomendados

- `create-supabase-table-rls-base` o equivalente de migracion/RLS (Fase 1 y 5: schema correctivo + RLS multi-tenant).
- `review-rls-multi-tenant` (verificacion de que el write queda blindado por `empresa_id`).
- `generate-data-access-layer` (Fases 3-4: actions y mapeo snake/JSONB <-> TS).
- `execute-phase` (ejecucion guiada del contrato fase a fase).
- `golden-path-review` / revisor estandar (cierre con `reviewMode: standard`).

## Checklist de cierre

- [ ] Schema real verificado en prod (Management API) antes y despues de migrar.
- [ ] Migracion correctiva aplicada: `created_by` y `updated_at` existen; `estado` normalizado; RLS write multi-tenant.
- [ ] `boarding-actions.ts`: ninguna escritura referencia columnas inexistentes; CRUD completo (incl. `updatePlantilla`, `deletePlantilla`, `setEstadoProceso`, `duplicarProceso`).
- [ ] `BoardingView` lee de BD; sin fallback al mock; mapeo snake/JSONB -> TS correcto.
- [ ] `boarding.io.ts#fetchAll` lee de la action real.
- [ ] Empleado se persiste como `user_id` (uuid) real de OLA2-01; no quedan ids mock en `empleado_id`.
- [ ] Todas las mutaciones (toggle, finalizar, archivar, duplicar, editar/eliminar plantilla) persisten y sobreviven al recargado.
- [ ] Rollback del `useState` ante `{ ok: false }` (no se finge persistencia).
- [ ] Vocabulario de estado unico en TS, UI, IO y actions.
- [ ] RLS verificada con smoke de dos empresas (sin fuga cross-tenant en write/read).
- [ ] `npm run typecheck` y `npm run build` verdes (WSL).
- [ ] Smoke documentado; estado de blindaje declarado.
- [ ] Decisiones de negocio (DN-1..DN-4) resueltas o explicitamente diferidas (fase 6 opcional).
- [ ] Commit terminado en `_FernandoClaude` y push a `main` tras validacion.

## Siguiente paso sugerido

Confirmar que **OLA2-01 esta cerrada** y resolver **DN-3** (vocabulario de estado). Acto seguido, ejecutar la **Fase 1** (verificar schema real via Management API y aplicar la migracion correctiva idempotente), que desbloquea de inmediato las escrituras P0 sin tocar todavia el componente.

## Ruta canonica

docs/rrhh-consolidacion/ola2-demock/Full-TASK-OLA2-04-boarding-reparar-mixto.md
