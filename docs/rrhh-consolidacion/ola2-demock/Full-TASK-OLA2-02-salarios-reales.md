# Full-TASK-OLA2-02 - Salarios reales

## Estado

PLANIFICADO Ola 2 (2026-06-01). No implementado. Discovery verificado en `DISCOVERY_OLA2-02-salarios-reales.md` (mismo directorio). Clasificacion confirmada: MOCK PURO (vista lee 100% de `data/salarios.ts`; sin actions ni Supabase).

## Objetivo

Convertir la tabla salarial por puesto de mock a datos reales en Supabase con RLS multi-tenant y por rol, y exponer una fuente canonica de **coste/hora por puesto** (y derivable por empleado) que sirva de fundacion a pagos (OLA2-06), bonus (OLA2-12) y ratios (OLA2-13). El modulo debe leer/escribir por `empresaDbId` (UUID), respetar confidencialidad salarial y eliminar la incoherencia del campo `salarioNeto`.

## Estimacion de complejidad

**Alta.** Justificacion: es un KEYSTONE con tres consumidores aguas abajo; toca confidencialidad/RLS por rol (no solo por empresa); requiere decision de negocio sobre la fuente de verdad (D1) y sobre el pago en B (D2); impacta un segundo modulo (Mi Panel); y exige reconciliar 4 representaciones del salario hoy desacopladas. No es un CRUD plano.

## Criterio de corte

La tarea esta COMPLETA cuando:

1. `SalariosView` y `MisCondicionesView` leen de Supabase (no de `data/salarios.ts`) por `empresaDbId`.
2. Existe persistencia real (crear/actualizar/eliminar puesto y norma) detras de server actions con gate de rol.
3. Existe `getCosteHoraPorPuesto(empresaDbId)` (y derivacion por empleado) consumible por OLA2-06/12/13, con formula de coste/hora documentada y testeable.
4. RLS aplica confidencialidad: empleado ve solo su salario; RRHH/Direccion ven todos.
5. D1 y D2 estan resueltas por escrito (no asumidas) antes de migrar.
6. `data/salarios.ts` queda solo como seed/fixture o se elimina; ningun import de produccion lo usa para datos vivos.

Queda FUERA del corte: nominas mensuales reales (OLA2-06 las consume, no las crea esta task) y el editor de horario semanal avanzado.

## Modo operativo

- **taskId:** OLA2-02
- **taskMode:** code
- **reviewMode:** standard
- **sourcePlan:** `docs/rrhh-consolidacion/ola2-demock/EXECUTION_PLAN_OLA2.md`

## Contexto previo obligatorio

Antes de tocar codigo, leer:

1. `docs/rrhh-consolidacion/ola2-demock/DISCOVERY_OLA2-02-salarios-reales.md` (estado real completo).
2. `supabase/migrations/026_rrhh_empleados.sql` (DDL real de `puestos_trabajo`, `contratos`, `nominas`, `empleados` + RLS).
3. `src/features/rrhh/actions/empleados-actions.ts` y `pagos-actions.ts` (patron canonico de server action: `getAppContext`, `requireAdminUser`, `createAdminClient`, `revalidatePath`, `friendlyError`).
4. `src/features/empresa/contexts/empresa-context.tsx` (slug en `Empresa.id`, UUID en `Empresa.dbId`).
5. Resolver D1 y D2 (ver "Decisiones de negocio pendientes").

## Scope IN

- Modelo de datos real para la tabla salarial **por puesto** (extension de `puestos_trabajo` o tabla 1:1 asociada) con RLS multi-tenant + por rol.
- Server actions: lectura por empresa, CRUD de puesto salarial, CRUD de norma salarial, y `getCosteHoraPorPuesto` / derivacion por empleado.
- Refactor de `SalariosView.tsx` para consumir las actions (lista, detalle, config, normas) por `empresaActual.dbId`.
- Refactor de `MisCondicionesView.tsx` para mostrar el salario del **propio** empleado via vinculo real (no match difuso), respetando RLS del empleado.
- Refactor de `salarios.io.ts` para `fetchAll` real + handlers de escritura (o desactivar import/export si no entra en el corte; decidir explicitamente).
- Derivacion y documentacion de la formula de **coste/hora**.
- Seed/migracion de los datos mock actuales (bacanal/habana) si el negocio quiere conservarlos.

## Scope OUT

- Creacion/gestion de nominas mensuales reales (`nominas`) — es OLA2-06.
- Calculo de bonus (OLA2-12) y ratios (OLA2-13) — solo se les provee el input de coste/hora.
- Editor visual avanzado de `horarioSemanal` (turnos por dia) — se mantiene el modelo actual de texto por dia.
- Cambios en el flujo de contratos/`salario_bruto` legal mas alla de leerlo como fuente de verdad por empleado.
- Persistir `efectivoExtra` como dato fiscal estructurado salvo que D2 lo autorice.

## Restricciones

- TS estricto; Feature-First (codigo en `src/features/rrhh/...`).
- **VERIFICAR SCHEMA REAL via Management API antes de migrar.** No inferir el estado de `puestos_trabajo`/`nominas`/`contratos` desde el codigo ni desde el DDL del repo: el DDL puede haber divergido. Confirmar columnas, tipos y politicas RLS reales antes de escribir cualquier migracion.
- Todas las consultas filtran por `empresa_id = empresaId` (UUID de `getAppContext`), nunca por slug.
- Mutaciones detras de `"use server"` con gate `requireAdminUser` (o equivalente por rol) salvo la lectura del propio salario del empleado.
- No romper `MisCondicionesView`: si la migracion es por fases, mantener fallback hasta que el vinculo real exista.
- Confidencialidad: ningun endpoint debe devolver salarios de terceros a un empleado sin rol.
- Migraciones idempotentes (`create table if not exists`, `drop policy if exists`), siguiendo el estilo de `026_*`.

## Validacion requerida

- `npm run typecheck` y `npm run build` (en WSL) en verde.
- RLS verificada: un empleado sin rol RRHH/Direccion NO puede leer salarios de otros (test manual con dos usuarios o consulta directa con JWT de empleado).
- `getCosteHoraPorPuesto` devuelve cifras coherentes para bacanal y habana (smoke con datos sembrados).
- `SalariosView` y `MisCondicionesView` renderizan con datos reales tras seed.
- Idempotencia de la migracion (re-ejecutable sin error).
- Revision de coherencia: `salarioNeto` ya no es campo libre incoherente.

## Dependencias

- **Depende de:** ninguna (fundacion / keystone).
- **Bloquea a:** OLA2-06 (pagos), OLA2-12 (bonus), OLA2-13 (ratios) — todas consumen el coste/hora de aqui.
- Reutiliza infra existente: `puestos_trabajo`, `contratos`, `nominas` (026), `getAppContext`, `createAdminClient`, `requireAdminUser`.

## Inputs

- Dataset mock actual: `src/features/rrhh/data/salarios.ts` (bacanal 13 puestos, habana 7, 4 normas) — candidato a seed.
- `empresaActual.dbId` (UUID) desde `empresa-context`.
- Schema real de Supabase (via Management API) para `puestos_trabajo`, `contratos`, `nominas`, `departamentos`.
- Decisiones D1 y D2 resueltas por el negocio.

## Outputs esperados

- Migracion SQL nueva (p.ej. `0NN_rrhh_salarios.sql`) con tabla/columnas salariales + RLS por rol (+ seed opcional).
- `src/features/rrhh/actions/salarios-actions.ts` con las server actions (firmas en "Interfaces publicas propuestas").
- `SalariosView.tsx` y `MisCondicionesView.tsx` refactorizados a datos reales.
- `salarios.io.ts` con `fetchAll` real (+ escritura o desactivacion explicita).
- Helper de coste/hora documentado.
- Actualizacion del estado de mock en este Full-TASK (a IMPLEMENTADO) al cerrar.

## Riesgos conocidos

- **Duplicacion de la verdad (D1):** 4 sitios con cifras salariales; sin una regla clara, las cifras divergen. Mitigacion: roles explicitos (plantilla vs contrato vs nomina) documentados.
- **Legal/fiscal (D2):** persistir `efectivoExtra` (pago en B) puede ser problematico. Mitigacion: no persistir como dato fiscal sin autorizacion; excluir del coste/hora oficial.
- **Fuga de confidencialidad:** RLS solo-por-empresa expone todos los salarios a cualquier empleado. Mitigacion: politica por rol + endpoint propio del empleado restringido a su fila.
- **Slug vs UUID:** pasar el slug a una consulta UUID rompe (devuelve vacio o error). Mitigacion: cambiar la firma a `empresaDbId` y pasar `empresaActual.dbId`.
- **Match difuso en Mi Panel:** `buscarPuestoUsuario` puede mapear al puesto equivocado. Mitigacion: usar `empleados.puesto_id` / vinculo real.
- **Coste/hora ambiguo:** sin definir base (bruto contractual vs neto+B vs coste empresa con SS) y divisor (horas/semana -> mes), el ratio es inconsistente. Mitigacion: formula unica documentada (ver modelo de datos).
- **Regresion en Mi Panel** durante la migracion por fases. Mitigacion: feature flag o fallback temporal.

## Modelo de datos propuesto

> **VERIFICAR SCHEMA REAL via Management API antes de migrar.** Confirmar que `puestos_trabajo` y `nominas`/`contratos` existen con las columnas y RLS aqui asumidas; el DDL del repo (`026_*`) puede haber divergido del estado real en Supabase. Ajustar la migracion al schema real.

**Decision de modelado (recomendada):** extender `puestos_trabajo` (que ya es 1 fila por puesto/empresa con `unique(empresa_id, nombre)` y `salario_base`) con las columnas de la plantilla salarial, en vez de crear una tabla paralela que duplique el puesto. Esto mantiene UNA fila por puesto y evita una 5ª fuente de verdad. Alternativa: tabla 1:1 `puestos_salario(puesto_id pk/fk)` si se prefiere aislar datos sensibles con su propia RLS estricta. Abajo se muestra la **alternativa 1:1** por ser la mas defendible en confidencialidad; adaptar segun D1.

```sql
-- 0NN_rrhh_salarios.sql  (VERIFICAR/ADAPTAR al schema real antes de aplicar)

-- Plantilla salarial por puesto. 1:1 con puestos_trabajo para aislar datos
-- sensibles con RLS propia por rol. La verdad LEGAL por empleado sigue en
-- contratos.salario_bruto; el coste REAL ejecutado en nominas.
create table if not exists public.puestos_salario (
  puesto_id       uuid primary key
                    references public.puestos_trabajo(id) on delete cascade,
  empresa_id      uuid not null
                    references public.empresas(id) on delete cascade,
  -- Cifras de referencia (plantilla, NO la verdad legal)
  nomina_neta     numeric(10,2) not null default 0,
  -- efectivo_extra: pago en B. SUJETO A D2. Si D2 = NO persistir, eliminar
  -- esta columna y no incluirla en ningun calculo oficial.
  efectivo_extra  numeric(10,2) not null default 0,
  -- salario_neto DERIVADO: columna generada para eliminar la incoherencia del
  -- campo libre actual. Si D2 excluye el efectivo, generar solo desde nomina_neta.
  salario_neto    numeric(10,2)
                    generated always as (nomina_neta + efectivo_extra) stored,
  jornada_contrato text not null default 'Completa'
                    check (jornada_contrato in ('Completa','Parcial','Por evento')),
  horas_semanales  numeric(5,2) not null default 40,
  dias_libres      smallint not null default 2,
  vacaciones_texto text,                       -- "30 dias naturales" (migrar a int en futuro)
  horario_semanal  jsonb not null default '[]'::jsonb,  -- [{dia,turno}] (modelo actual)
  observaciones    text,
  objetivos        text[] not null default '{}',
  estado           text not null default 'activo'
                    check (estado in ('activo','borrador','inactivo')),
  updated_at       timestamptz not null default now(),
  created_at       timestamptz not null default now()
);

create index if not exists idx_puestos_salario_empresa
  on public.puestos_salario(empresa_id);

-- Normas/clausulas salariales por empresa (hoy NORMAS_BASE mock)
create table if not exists public.normas_salariales (
  id           uuid primary key default gen_random_uuid(),
  empresa_id   uuid not null references public.empresas(id) on delete cascade,
  titulo       text not null,
  descripcion  text not null,
  orden        smallint not null default 0,
  activo       boolean not null default true,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index if not exists idx_normas_salariales_empresa
  on public.normas_salariales(empresa_id);

-- trigger updated_at (estilo 026_*)
create or replace function public.set_puestos_salario_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end; $$;
drop trigger if exists puestos_salario_updated_at on public.puestos_salario;
create trigger puestos_salario_updated_at
  before update on public.puestos_salario
  for each row execute function public.set_puestos_salario_updated_at();

-- ── RLS multi-tenant + por rol ────────────────────────────────
-- Confidencialidad: NO basta con pertenecer a la empresa. Solo roles
-- RRHH/Direccion gestionan y ven todas las cifras. El empleado ve SU puesto
-- via la action dedicada (que filtra por empleados.puesto_id del propio user).

alter table public.puestos_salario   enable row level security;
alter table public.normas_salariales enable row level security;

-- Helper de rol asumido (VERIFICAR nombre real en el esquema de roles del
-- proyecto; en 026/087 los roles viven por empresa). Sustituir esta condicion
-- por la funcion/consulta de rol que use el repo (p.ej. has_rol_rrhh(empresa_id)).
-- Lectura de gestion (RRHH/Direccion): todas las filas de su empresa.
create policy "psal_read_mgmt" on public.puestos_salario for select to authenticated
  using (
    empresa_id in (select p.empresa_id from public.profiles p where p.user_id = auth.uid())
    and public.tiene_rol_rrhh_o_direccion(empresa_id)   -- VERIFICAR/IMPLEMENTAR
  );

create policy "psal_manage_mgmt" on public.puestos_salario for all to authenticated
  using (
    empresa_id in (select p.empresa_id from public.profiles p where p.user_id = auth.uid())
    and public.tiene_rol_rrhh_o_direccion(empresa_id)
  )
  with check (
    empresa_id in (select p.empresa_id from public.profiles p where p.user_id = auth.uid())
    and public.tiene_rol_rrhh_o_direccion(empresa_id)
  );

-- Lectura del propio empleado: solo la fila del puesto que tiene asignado.
create policy "psal_read_self" on public.puestos_salario for select to authenticated
  using (
    puesto_id in (
      select e.puesto_id from public.empleados e
      where e.user_id = auth.uid() and e.puesto_id is not null
    )
  );

-- Normas: lectura para cualquier miembro de la empresa; gestion solo rol.
create policy "norma_read" on public.normas_salariales for select to authenticated
  using (empresa_id in (select p.empresa_id from public.profiles p where p.user_id = auth.uid()));
create policy "norma_manage" on public.normas_salariales for all to authenticated
  using (
    empresa_id in (select p.empresa_id from public.profiles p where p.user_id = auth.uid())
    and public.tiene_rol_rrhh_o_direccion(empresa_id)
  )
  with check (
    empresa_id in (select p.empresa_id from public.profiles p where p.user_id = auth.uid())
    and public.tiene_rol_rrhh_o_direccion(empresa_id)
  );
```

**Derivacion de coste/hora (formula canonica a documentar y testear):**

```
horas_mensuales = horas_semanales * (52 / 12)        -- ~4.333 semanas/mes

-- Coste/hora "empresa" (recomendado para ratios y pagos):
coste_hora_empresa = coste_mensual_empresa / horas_mensuales
  donde coste_mensual_empresa:
    - PREFERENTE si existe nomina del periodo: nominas.coste_total_empresa
    - si no, derivado de contrato: contratos.salario_bruto * (1 + factor_ss_empresa)
      (factor_ss_empresa ~ 0.30, parametrizable por empresa)

-- Coste/hora "neto" (informativo, NO para fiscalidad):
coste_hora_neto = salario_neto / horas_mensuales
  -- salario_neto incluye efectivo_extra SOLO si D2 lo autoriza.
```

`getCosteHoraPorPuesto` usa la rama de plantilla (`puestos_salario` + bruto estimado) cuando no hay nomina; la version por empleado prefiere `nominas`/`contratos` reales. La fuente usada debe venir etiquetada (`fuente: 'nomina' | 'contrato' | 'plantilla'`) para trazabilidad en OLA2-06/13.

## Interfaces publicas propuestas

Archivo: `src/features/rrhh/actions/salarios-actions.ts` (`"use server"`, patron `getAppContext` + `requireAdminUser` + `revalidatePath` + `friendlyError`). Todas reciben/usan el **UUID** de empresa (no slug).

```ts
// Tipos de retorno coherentes con el resto del repo: { ok, data?/error? }

// Lectura de gestion (RRHH/Direccion). empresaDbId = empresaActual.dbId (UUID).
export async function getSalariosEmpresa(empresaDbId: string): Promise<{
  ok: boolean;
  data: { puestos: PuestoSalarialRow[]; normas: NormaSalarialRow[] };
  error?: string;
}>;

// Crear / actualizar / eliminar puesto salarial (gate rol RRHH/Direccion).
export async function crearPuestoSalarial(input: PuestoSalarialInput): Promise<{ ok: boolean; id?: string; error?: string }>;
export async function actualizarPuestoSalarial(puestoId: string, patch: Partial<PuestoSalarialInput>): Promise<{ ok: boolean; error?: string }>;
export async function eliminarPuestoSalarial(puestoId: string): Promise<{ ok: boolean; error?: string }>;

// Normas salariales (gate rol para escritura).
export async function crearNormaSalarial(input: { titulo: string; descripcion: string; orden?: number }): Promise<{ ok: boolean; id?: string; error?: string }>;
export async function actualizarNormaSalarial(id: string, patch: Partial<{ titulo: string; descripcion: string; orden: number; activo: boolean }>): Promise<{ ok: boolean; error?: string }>;
export async function eliminarNormaSalarial(id: string): Promise<{ ok: boolean; error?: string }>;

// KEYSTONE: coste/hora por puesto para OLA2-06/12/13.
export interface CosteHoraPuesto {
  puestoId: string;
  puesto: string;
  departamento: string | null;
  horasSemanales: number;
  costeHoraEmpresa: number;   // ver formula
  costeHoraNeto: number;      // informativo
  fuente: "nomina" | "contrato" | "plantilla";
}
export async function getCosteHoraPorPuesto(empresaDbId: string): Promise<{ ok: boolean; data: CosteHoraPuesto[]; error?: string }>;

// Derivacion por empleado (prefiere nominas/contratos reales). Para pagos/ratios.
export async function getCosteHoraPorEmpleado(empresaDbId: string): Promise<{ ok: boolean; data: Array<CosteHoraPuesto & { empleadoId: string }>; error?: string }>;

// Mi Panel: salario del PROPIO empleado (RLS self). Sin empresaDbId: deriva del user.
export async function getMiSalario(): Promise<{ ok: boolean; data: PuestoSalarialRow | null; error?: string }>;
```

`salarios.io.ts`: `fetchAll(ctx)` pasa a llamar `getSalariosEmpresa(ctx.empresaDbId)`; los handlers de escritura, si entran en corte, delegan en `crear/actualizar/eliminarPuestoSalarial`.

## Flujo operativo esperado (fases)

1. **Fase 0 — Decisiones:** cerrar D1 y D2 por escrito. Verificar schema real via Management API.
2. **Fase 1 — Migracion:** crear `puestos_salario` (o extender `puestos_trabajo`) + `normas_salariales` + RLS por rol + helper de rol. Seed opcional desde el mock (bacanal/habana).
3. **Fase 2 — Actions:** implementar `salarios-actions.ts` (lectura, CRUD, `getCosteHoraPorPuesto`, `getCosteHoraPorEmpleado`, `getMiSalario`) con gates de rol.
4. **Fase 3 — UI RRHH:** refactor `SalariosView.tsx` a `empresaActual.dbId` + actions; conectar botones "Nuevo"/editar/eliminar hoy stub; salario_neto derivado.
5. **Fase 4 — Mi Panel:** refactor `MisCondicionesView.tsx` para usar `getMiSalario` (vinculo real, no match difuso) con fallback durante transicion.
6. **Fase 5 — IO + cierre:** `salarios.io.ts` real (o desactivar import/export); retirar `data/salarios.ts` de produccion (queda como seed/fixture); validacion typecheck+build+RLS; documentar formula coste/hora.

## Decisiones de negocio pendientes

- **D1 — Fuente de verdad del salario (CRITICA, bloquea Fase 1).** Hay 4 sitios: `puestos_trabajo.salario_base`, tabla salarial por puesto (mock), `contratos.salario_bruto`, `nominas`. **Recomendacion del agente:** establecer una jerarquia explicita en vez de una unica tabla:
  - **Plantilla / referencia por puesto** = la tabla salarial (extender `puestos_trabajo` o `puestos_salario` 1:1). Es lo que ve RRHH y de donde sale el coste/hora "estimado" cuando no hay nomina.
  - **Verdad legal por empleado** = `contratos.salario_bruto` (+ `jornada_horas`). Inmutable desde esta task; solo se lee.
  - **Coste real ejecutado** = `nominas.coste_total_empresa` por periodo. Preferente para coste/hora cuando existe.
  El coste/hora etiqueta su `fuente` (nomina > contrato > plantilla) para que OLA2-06/13 sepan que precision tienen. Asi no se duplica la verdad: cada cifra tiene un dueno y una prioridad.
- **D2 — `efectivoExtra` (pago en B) en BD (bloquea forma final de la tabla).** Persistir efectivo fuera de nomina tiene implicaciones legales/fiscales. **Recomendacion:** por defecto NO persistirlo como dato fiscal ni incluirlo en el coste/hora "oficial". Si el negocio exige reflejarlo internamente, dejarlo en una columna claramente marcada como interna y excluirla de cualquier export/calculo legal. Confirmar con el cliente antes de migrar; la columna `efectivo_extra` del DDL queda condicionada a esta decision.

## Paths del proyecto

- `src/features/rrhh/data/salarios.ts` (mock actual; futuro seed/fixture).
- `src/features/rrhh/components/salarios/SalariosView.tsx` (vista RRHH a refactorizar).
- `src/features/rrhh/io/salarios.io.ts` (IO a refactorizar).
- `src/features/mi-panel/components/MisCondicionesView.tsx` (consumidor externo, Mi Panel).
- `src/features/rrhh/actions/salarios-actions.ts` (NUEVO — server actions).
- `src/features/rrhh/actions/empleados-actions.ts`, `pagos-actions.ts` (patron de referencia).
- `src/features/empresa/contexts/empresa-context.tsx` (slug vs dbId).
- `supabase/migrations/026_rrhh_empleados.sql` (DDL real existente).
- `supabase/migrations/0NN_rrhh_salarios.sql` (NUEVO — migracion).
- `src/lib/supabase/get-context.ts`, `src/lib/supabase/admin.ts`, `src/features/rrhh/services/empleados-core.ts` (infra reutilizada).

## Agentes recomendados

- **create-supabase-table-rls-base** — andamiaje de tabla + RLS multi-tenant (base que extender con la politica por rol).
- **review-rls-multi-tenant** — auditar que la RLS impide fuga de salarios entre empleados/empresas.
- **generate-data-access-layer** — capa de acceso/actions consistente con el patron del repo.
- **execute-phase** — ejecucion por fases de este contrato.
- (Consulta opcional al cliente/negocio para D1 y D2 antes de la Fase 1.)

## Checklist de cierre

- [ ] D1 y D2 resueltas por escrito y reflejadas en la migracion.
- [ ] Schema real verificado via Management API antes de migrar.
- [ ] Migracion `0NN_rrhh_salarios.sql` aplicada e idempotente.
- [ ] RLS por rol verificada: empleado no ve salarios ajenos; RRHH/Direccion si.
- [ ] `salarios-actions.ts` implementado (CRUD + coste/hora por puesto y por empleado + getMiSalario).
- [ ] `SalariosView.tsx` consume datos reales por `dbId`; botones de escritura funcionales.
- [ ] `MisCondicionesView.tsx` usa vinculo real (no match difuso); sin regresion.
- [ ] `salarios.io.ts` real o import/export desactivado explicitamente.
- [ ] `salarioNeto` derivado (sin campo libre incoherente).
- [ ] `getCosteHoraPorPuesto` validado con bacanal y habana; formula documentada.
- [ ] `data/salarios.ts` fuera de produccion (seed/fixture o eliminado).
- [ ] `npm run typecheck` + `npm run build` en verde (WSL).
- [ ] Estado de este Full-TASK actualizado a IMPLEMENTADO + auto-blindaje declarado.

## Siguiente paso sugerido

Llevar D1 y D2 al cliente/negocio para decision explicita; en paralelo, verificar via Management API el schema real de `puestos_trabajo`/`contratos`/`nominas`. Con ambas cosas resueltas, ejecutar la Fase 1 (migracion + RLS por rol) con `create-supabase-table-rls-base` y auditar con `review-rls-multi-tenant`. Tras la migracion, descomponer en tareas via `/plan-to-tasks` si se prefiere ejecucion granular.

## Ruta canonica

`docs/rrhh-consolidacion/ola2-demock/Full-TASK-OLA2-02-salarios-reales.md`
