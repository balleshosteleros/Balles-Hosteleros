# Full-TASK-OLA2-06 - Pagos reales sobre nominas

## Estado

PLANIFICADO Ola 2 (2026-06-01). No implementado. Discovery verificado en `DISCOVERY_OLA2-06-pagos-sobre-nominas.md` (mismo directorio). Clasificacion confirmada: MIXTO con sesgo a mock (unico real = identidad del empleado via `listEmpleadosParaPagos`; todos los importes son efimeros en `useState` y se pierden al recargar; no hay action de escritura). La tabla destino `public.nominas` (026) ya existe y no se usa desde ningun sitio.

## Objetivo

Cablear el modulo de Pagos a la tabla real `public.nominas` para que las nominas por empleado y periodo **persistan** (crear/leer/actualizar, cambio de estado), sustituyendo el estado efimero en `useState`. La base de cada nomina (salario_base y derivados) se **prefija consumiendo la interfaz de coste de OLA2-02** (sin recalcular cifras salariales por cuenta propia), se reconcilia el eje temporal mensual de `nominas` con las 4 granularidades de la UI, y se endurece la RLS de `nominas` con gating por rol por tratarse de un dato sensible.

## Estimacion de complejidad

**Media-Alta.** Justificacion: NO crea modelo de datos nuevo (la tabla existe), pero (a) depende de OLA2-02 y hereda su decision D1; (b) exige un mapeo no trivial UI<->BD (la UI piensa en propinas/pago, la tabla en devengos/deducciones/coste-empresa); (c) reconcilia un eje temporal mensual con 4 granularidades; (d) toca confidencialidad/RLS por rol; (e) sustituye un patron optimista efimero por persistencia con upsert idempotente y ciclo de estado. No es un CRUD plano, pero parte de tabla + identidad + fuente de coste ya disponibles.

## Criterio de corte

La tarea esta COMPLETA cuando:

1. Las ediciones de la tabla de pagos **persisten** en `public.nominas` (crear y actualizar por `(empleado_id, periodo)`), y sobreviven a recargar la pagina.
2. `PagosView` **lee de `nominas`** (mapeado a `PagoEmpleado`), no de filas a 0; el estado efimero deja de ser la fuente de verdad.
3. Existen server actions reales: lectura por empresa+periodo, upsert de nomina, cambio de estado (`Borrador|Revisada|Pagada|Reclamada`), con gate de rol RRHH/Direccion.
4. La base mensual (`salario_base` y derivados) se **prefija desde la jerarquia de OLA2-02** (preferente `contratos.salario_bruto`); ninguna cifra salarial se re-deriva localmente.
5. El eje temporal esta reconciliado: persistencia mensual; trimestre/semestre/ano **agregan** los meses del rango en lectura (decision D-eje resuelta por escrito).
6. RLS de `nominas` aplica gating por rol (empleado sin rol no lee/escribe nominas ajenas); D-rol resuelta.
7. KPIs honestos: `prestamos` y `efectivoAhorro` dejan de ser placeholders inventados (calculo real o placeholder etiquetado).

Queda FUERA del corte: el calculo automatico de SS/IRPF "de verdad" fiscal (se persiste lo que el usuario introduce + prefill; no se implementa motor de nomina legal), la generacion de PDF de nomina (`documento_url`), y la integracion con `fichajes` (opcional, ver fase 6).

## Modo operativo

- **taskId:** OLA2-06
- **taskMode:** code
- **reviewMode:** standard
- **sourcePlan:** `docs/rrhh-consolidacion/ola2-demock/EXECUTION_PLAN_OLA2.md`

## Contexto previo obligatorio

Antes de tocar codigo, leer:

1. `docs/rrhh-consolidacion/ola2-demock/DISCOVERY_OLA2-06-pagos-sobre-nominas.md` (estado real completo + mapeo UI<->BD).
2. **OLA2-02 (salarios) debe estar CERRADA** o, como minimo, su interfaz de coste publicada. Leer `Full-TASK-OLA2-02-salarios-reales.md` y **consumir** `getCosteHoraPorEmpleado(empresaDbId)` y la jerarquia plantilla/contrato/nomina. PAGOS NO redefine la fuente de verdad del salario: la hereda.
3. `supabase/migrations/026_rrhh_empleados.sql` (DDL real de `nominas`, `contratos`, `empleados` + RLS).
4. `src/features/rrhh/actions/pagos-actions.ts` (firma real de `listEmpleadosParaPagos`, patron `getAppContext`) y `empleados-actions.ts` (patron canonico: `requireAdminUser`, `createAdminClient`, `revalidatePath`, `friendlyError`).
5. `src/features/empresa/contexts/empresa-context.tsx` (slug en `Empresa.id`, UUID en `Empresa.dbId`).
6. Resolver D1 (heredada), D-eje y D-rol (ver "Decisiones de negocio pendientes").

## Scope IN

- Server actions sobre `public.nominas`: lectura por empresa+periodo (con agregacion por rango), upsert de nomina por `(empleado_id, periodo)`, cambio de estado.
- Refactor de `PagosView.tsx` para leer/escribir via esas actions (sustituir el `useState` efimero como fuente de verdad; conservar cache de UI si se quiere, pero alimentada desde BD).
- Mapeo bidireccional `PagoEmpleado` (camelCase, modelo UI) <-> `nominas` (snake_case, devengos/deducciones).
- Prefill de la base (`salario_base` y derivados) **consumiendo OLA2-02** (`getCosteHoraPorEmpleado` y/o `contratos.salario_bruto`), con etiqueta de `fuente`.
- Reconciliacion del eje temporal: persistencia mensual + lectura agregada para trimestre/semestre/ano.
- Endurecimiento de RLS de `nominas`: gating por rol (RRHH/Direccion) reutilizando el helper de rol definido en OLA2-02.
- KPIs reales u honestos en `getResumenPagos` (`prestamos`, `efectivoAhorro`).
- `pagos.io.ts`: `fetchAll` real desde `nominas` (o desactivar import/export explicitamente si no entra).

## Scope OUT

- Motor de calculo fiscal real de SS/IRPF (se persiste lo introducido + prefill; no se reglamenta la nomina legal).
- Generacion/almacenamiento de PDF de nomina (`documento_url`) — futura task.
- Definir o tocar la fuente de verdad del salario (es de OLA2-02; aqui solo se consume).
- Crear el modelo salarial por puesto (OLA2-02) ni bonus/ratios (OLA2-12/13).
- Integracion con `fichajes` para horas reales: **opcional** (fase 6), no parte del corte minimo.
- Editor avanzado multi-concepto de la nomina mas alla del set de campos actual.

## Restricciones

- TS estricto; Feature-First (codigo en `src/features/rrhh/...`).
- **VERIFICAR SCHEMA REAL via Management API antes de migrar/escribir.** No inferir el estado de `nominas`/`contratos`/`empleados` desde el DDL del repo: ya se confirmo divergencia (`empleados.puesto` texto y `departamentos.area` NO estan en `026` pero existen en prod). Confirmar columnas, tipos y politicas RLS reales antes de cualquier ALTER o action.
- Todas las consultas filtran por `empresa_id = empresaId` (UUID de `getAppContext` o `empresaDbId` recibido), nunca por slug.
- Mutaciones detras de `"use server"` con gate `requireAdminUser` (o equivalente por rol RRHH/Direccion). Datos salariales: ningun endpoint devuelve nominas de terceros a un empleado sin rol.
- Upsert idempotente por `(empleado_id, periodo)` (la `unique` ya existe): no duplicar nominas; no usar el `id` sintetico `<empId>-pago`.
- No re-derivar cifras salariales: la base viene de la interfaz de OLA2-02.
- Cualquier ALTER de `nominas` (RLS por rol, columnas nuevas para propinas si se decide) idempotente (`drop policy if exists`, `add column if not exists`), estilo `026_*`.
- Flujos de escritura con try/catch, error legible y sin perder ediciones del usuario en fallo.

## Validacion requerida

- `npm run typecheck` y `npm run build` (en WSL, `wsl -d Ubuntu bash -c`, NON-login) en verde.
- Persistencia verificada: editar importes, recargar la pagina y comprobar que **se conservan** (antes se perdian).
- Upsert idempotente: guardar dos veces el mismo `(empleado, periodo)` no crea filas duplicadas (respeta `unique`).
- RLS verificada: un usuario sin rol RRHH/Direccion NO puede leer/escribir nominas (test con dos usuarios o consulta directa con JWT de empleado).
- Eje temporal: una nomina creada en un mes aparece sumada en la vista trimestral/anual que lo contiene.
- Prefill: al crear una nomina nueva, `salario_base` llega prefijado desde OLA2-02 (no a 0) y con `fuente` trazable.
- KPIs: `prestamos`/`efectivoAhorro` ya no muestran cifras inventadas.
- Smoke con bacanal/habana sobre datos reales sembrados.

## Dependencias

- **Depende de:** **OLA2-02 (salarios)** — provee `getCosteHoraPorEmpleado(empresaDbId)`, la jerarquia plantilla/contrato/nomina y el helper de rol (`tiene_rol_rrhh_o_direccion` o equivalente) reutilizado en la RLS. No arrancar el prefill ni la RLS por rol antes de que esa interfaz exista.
- **Coordina con:** OLA2-01 (empleados reales) — la identidad ya es real via `listEmpleadosParaPagos`; mantener ese contrato.
- **Bloquea a:** parcialmente OLA2-13 (ratios) en la parte de coste ejecutado por nomina, si se decide usar `nominas.coste_total_empresa` como fuente preferente.
- Reutiliza infra existente: `nominas`/`contratos` (026), `getAppContext`, `createAdminClient`, `requireAdminUser`, `revalidatePath`.

## Inputs

- `listEmpleadosParaPagos()` (identidad real; sin argumentos, resuelve empresa via `getAppContext`).
- Interfaz de OLA2-02: `getCosteHoraPorEmpleado(empresaDbId)` + jerarquia de fuente de verdad; `contratos.salario_bruto`/`jornada_horas` como verdad legal por empleado.
- `empresaActual.dbId` (UUID) desde `empresa-context`.
- Schema real de Supabase (via Management API) para `nominas`, `contratos`, `empleados`, `departamentos`.
- `nominas.periodo` ('YYYY-MM') como eje temporal canonico.
- Decisiones D1 (heredada), D-eje y D-rol resueltas por el negocio.
- Opcional: `fichajes-actions.ts` (`listFichajesEmpleado`) para horas reales del periodo.

## Outputs esperados

- `src/features/rrhh/actions/nominas-actions.ts` (NUEVO — server actions de pagos sobre `nominas`; firmas en "Interfaces publicas propuestas").
- Migracion correctiva de RLS (p.ej. `0NN_nominas_rls_por_rol.sql`) que sustituye `nom_read`/`nom_manage` por politicas con gating por rol (+ columnas nuevas para propinas SOLO si D-modelo lo decide).
- `PagosView.tsx` refactorizado: lee/escribe via actions; estado efimero deja de ser la verdad.
- Mapeo `PagoEmpleado` <-> `nominas` (helper de transformacion documentado).
- `data/pagos.ts`: `getResumenPagos` con KPIs honestos.
- `pagos.io.ts`: `fetchAll` real (o import/export desactivado explicitamente).
- Actualizacion del estado de este Full-TASK (a IMPLEMENTADO) + auto-blindaje al cerrar.

## Riesgos conocidos

- **Dependencia de OLA2-02 (D1):** si la fuente de verdad del salario no esta cerrada, el prefill recalcula cifras y se duplica la verdad. Mitigacion: bloquear el prefill hasta que `getCosteHoraPorEmpleado` exista; consumir, no recalcular.
- **Fuga de confidencialidad:** la RLS actual de `nominas` (`nom_read`/`nom_manage`) es **solo por empresa** -> cualquier empleado lee salarios de todos. Mitigacion: gating por rol (urgente; mismo helper que OLA2-02).
- **Mapeo UI<->BD ambiguo:** `nominas` no tipa propinas; `pago`/`nomina` (UI) no mapean limpio a devengos/neto. Mitigacion: tabla de mapeo cerrada (ver modelo de datos) y decision D-modelo sobre propinas (bucket vs columna nueva).
- **Eje temporal:** escribir un "trimestre" no tiene fila propia (`periodo` es mensual + `unique`). Mitigacion: persistir SIEMPRE por mes; rangos mayores agregan en lectura; bloquear escritura directa de rangos no mensuales o repartir por meses.
- **Id sintetico vs uuid:** persistir con `<empId>-pago` rompe; colisiona con uuid real. Mitigacion: upsert por `(empleado_id, periodo)`; nunca usar el id sintetico como PK.
- **Schema divergente:** el DDL del repo no refleja el estado real (`empleados.puesto`/`departamentos.area`). Mitigacion: Management API antes de migrar; ajustar al schema real.
- **Slug vs UUID:** `IOActions` hoy pasa el slug (`empresaActual.id`); si el IO lee real debe resolver el UUID. Mitigacion: firmar por `empresaDbId`/`getAppContext`.
- **Perdida de datos del usuario en fallo de guardado:** patron optimista actual oculta errores. Mitigacion: try/catch + estado de guardado visible + no limpiar el formulario en error.

## Modelo de datos propuesto

> **NO se crea tabla nueva.** El destino es `public.nominas` (026), que ya existe con RLS y `unique(empleado_id, periodo)` y **no se usa desde ningun sitio**. Esta task la **cablea**. El unico cambio de schema es **correctivo de RLS** (gating por rol) y, condicionalmente, columnas para propinas si D-modelo lo decide.
>
> **VERIFICAR SCHEMA REAL via Management API antes de migrar.** Ya hay divergencia confirmada entre el DDL del repo y prod (`empleados.puesto` texto y `departamentos.area` no estan en `026`). Confirmar columnas/tipos/RLS reales de `nominas`/`contratos` antes de cualquier ALTER.

DDL real de referencia (026, no se recrea): `nominas(id, empresa_id, empleado_id, contrato_id, periodo 'YYYY-MM', fecha_pago, salario_base, complementos, horas_extra, otros_devengos, total_devengado, seg_social_empleado, irpf_pct, irpf_importe, otras_deducciones, total_deducciones, liquido_percibir, seg_social_empresa, coste_total_empresa, estado in ('Borrador','Revisada','Pagada','Reclamada'), documento_url, notas, created_by, created_at, updated_at, unique(empleado_id, periodo))`.

**Mapeo `PagoEmpleado` (UI) <-> `nominas` (BD):**

| UI `PagoEmpleado` | `nominas` | Direccion / nota |
| --- | --- | --- |
| `empleadoId` | `empleado_id` (uuid) | identidad ya real |
| (empresa activa) | `empresa_id` (uuid) | de `getAppContext`/`dbId` |
| (mes del rango) | `periodo` ('YYYY-MM') | escritura solo mensual |
| `pago` | `salario_base` | prefill desde OLA2-02/`contratos.salario_bruto`/12 |
| `nomina` | `total_devengado` / `liquido_percibir` | reconciliar bruto vs neto (decidir uno) |
| `horasExtras` (importe) | `horas_extra` | importe, no nº de horas |
| `bonus` | `complementos` | bucket de devengo |
| `propinaMantenimiento` | `otros_devengos` o `complementos` | D-modelo |
| `propina` | `otros_devengos` **o columna nueva `propinas`** | D-modelo |
| `descuento` | `otras_deducciones` | |
| `total` | `total_devengado`/`liquido_percibir` | derivado (no editable directo) |
| `pagado` (bool) | `estado = 'Pagada'` | bool<->enum; exponer ciclo completo |
| `horasReales`/`horasTrabajadas` | (no en nominas) | de `fichajes` (opcional, fase 6) |

**RLS por rol (migracion correctiva, idempotente) — VERIFICAR/ADAPTAR al schema real:**

```sql
-- 0NN_nominas_rls_por_rol.sql  (sustituye la RLS solo-por-empresa de 026)
-- Reutiliza el helper de rol definido en OLA2-02 (VERIFICAR nombre real).
drop policy if exists "nom_read"   on public.nominas;
drop policy if exists "nom_manage" on public.nominas;

create policy "nom_read_mgmt" on public.nominas for select to authenticated
  using (
    empresa_id in (select p.empresa_id from public.profiles p where p.user_id = auth.uid())
    and public.tiene_rol_rrhh_o_direccion(empresa_id)   -- VERIFICAR/IMPLEMENTAR (OLA2-02)
  );

create policy "nom_manage_mgmt" on public.nominas for all to authenticated
  using (
    empresa_id in (select p.empresa_id from public.profiles p where p.user_id = auth.uid())
    and public.tiene_rol_rrhh_o_direccion(empresa_id)
  )
  with check (
    empresa_id in (select p.empresa_id from public.profiles p where p.user_id = auth.uid())
    and public.tiene_rol_rrhh_o_direccion(empresa_id)
  );

-- Opcional: el empleado ve SU propia nomina (RLS self), si el negocio lo quiere.
-- create policy "nom_read_self" on public.nominas for select to authenticated
--   using (empleado_id in (
--     select e.id from public.empleados e where e.user_id = auth.uid()
--   ));

-- Condicional D-modelo: columnas para propinas si no se reutiliza otros_devengos.
-- alter table public.nominas add column if not exists propinas numeric(10,2) not null default 0;
```

## Interfaces publicas propuestas

Archivo: `src/features/rrhh/actions/nominas-actions.ts` (`"use server"`, patron `getAppContext` + gate de rol + `revalidatePath` + `friendlyError`). Reciben/usan el **UUID** de empresa (no slug). Convencion de retorno coherente con el repo: `{ ok, data?/error? }`.

```ts
// Lectura de nominas de un periodo (mensual) para toda la empresa.
// empresaDbId = empresaActual.dbId (UUID). periodo = 'YYYY-MM'.
export async function getNominas(empresaDbId: string, periodo: string): Promise<{
  ok: boolean;
  data: NominaRow[];   // mapeable a PagoEmpleado en la UI
  error?: string;
}>;

// Lectura agregada por rango (trimestre/semestre/ano): suma las nominas
// de los meses contenidos. Devuelve un agregado por empleado.
export async function getNominasRango(empresaDbId: string, desde: string, hasta: string): Promise<{
  ok: boolean;
  data: NominaAgregadaRow[];
  error?: string;
}>;

// Crear/actualizar una nomina por (empleado_id, periodo) — upsert idempotente.
// Gate de rol RRHH/Direccion. NO usar el id sintetico de la UI.
export interface UpsertNominaInput {
  empleadoId: string;          // uuid real
  periodo: string;             // 'YYYY-MM'
  contratoId?: string | null;
  salarioBase: number;
  complementos?: number;
  horasExtra?: number;
  otrosDevengos?: number;
  segSocialEmpleado?: number;
  irpfPct?: number;
  otrasDeducciones?: number;
  segSocialEmpresa?: number;
  notas?: string | null;
  // total_devengado / total_deducciones / liquido_percibir / coste_total_empresa
  // se derivan en el servidor a partir de los anteriores (no se confia en el cliente).
}
export async function upsertNomina(input: UpsertNominaInput): Promise<{ ok: boolean; id?: string; error?: string }>;

// Cambiar el estado del ciclo de la nomina.
export async function cambiarEstadoNomina(
  nominaId: string,
  estado: "Borrador" | "Revisada" | "Pagada" | "Reclamada",
): Promise<{ ok: boolean; error?: string }>;

// Prefill de la base consumiendo OLA2-02 (NO recalcular cifras aqui).
// Devuelve, por empleado, la base sugerida + la fuente para trazabilidad.
export async function prefillBaseNominas(empresaDbId: string, periodo: string): Promise<{
  ok: boolean;
  data: Array<{ empleadoId: string; salarioBaseSugerido: number; fuente: "nomina" | "contrato" | "plantilla" }>;
  error?: string;
}>;
// Implementacion: consume getCosteHoraPorEmpleado(empresaDbId) de OLA2-02 y/o
// contratos.salario_bruto/12. PAGOS no abre una quinta fuente de verdad.
```

`pagos.io.ts`: `fetchAll(ctx)` pasa a leer de `nominas` via `getNominas`/`getNominasRango` (resolviendo el UUID, no el slug); el import, si entra en corte, delega en `upsertNomina`; si no, se desactiva explicitamente.

## Flujo operativo esperado (fases)

1. **Fase 1 — Actions read/upsert sobre `nominas`:** crear `nominas-actions.ts` con `getNominas`, `getNominasRango`, `upsertNomina` (idempotente por `(empleado_id, periodo)`) y `cambiarEstadoNomina`, con gate de rol. Mapeo `nominas` -> `NominaRow` -> `PagoEmpleado`. Totales derivados en servidor.
2. **Fase 2 — Persistir ediciones:** refactor de `PagosView` para que `guardarEdicion`/`togglePagado` llamen a `upsertNomina`/`cambiarEstadoNomina` y para que `cargarEmpleados` lea de `getNominas` (no `nuevoPagoVacio` a 0). El `useState` deja de ser la verdad; estado de guardado visible; no perder datos en error.
3. **Fase 3 — Prefill base desde OLA2-02:** al no existir nomina del periodo, `prefillBaseNominas` rellena `salario_base` (y derivados) desde la jerarquia de OLA2-02 (`getCosteHoraPorEmpleado` / `contratos.salario_bruto`), etiquetando `fuente`. Sin recalcular cifras propias.
4. **Fase 4 — Reconciliar eje temporal:** persistencia mensual; para TRIMESTRAL/SEMESTRAL/ANUAL la vista usa `getNominasRango` (suma los meses). Definir el comportamiento de escritura en rangos no mensuales (bloquear o repartir) — D-eje.
5. **Fase 5 — RLS por rol:** aplicar `0NN_nominas_rls_por_rol.sql` (gating por rol, helper de OLA2-02), opcional `nom_read_self`. Verificar que empleado sin rol no accede.
6. **Fase 6 — Horas desde fichajes (opcional):** derivar `horasReales`/`horasTrabajadas` (y, si se decide, el importe de horas extra = horas x coste/hora de OLA2-02) desde `listFichajesEmpleado`. Fuera del corte minimo.

## Decisiones de negocio pendientes

- **D1 — Fuente de verdad del salario (HEREDADA de OLA2-02; bloquea Fase 3).** PAGOS NO la decide: consume la jerarquia que fije OLA2-02 (plantilla por puesto -> `contratos.salario_bruto` legal -> `nominas.coste_total_empresa` ejecutado). Recomendacion: para prefijar el bruto mensual usar `contratos.salario_bruto/12`; para coste de horas extra usar `getCosteHoraPorEmpleado(...).costeHoraEmpresa`. El prefill etiqueta `fuente`. Confirmar que OLA2-02 esta cerrada antes de la Fase 3.
- **D-eje — Granularidad de persistencia (bloquea Fase 4).** `nominas.periodo` es mensual con `unique(empleado_id, periodo)`. Recomendacion: **persistir siempre por mes** y agregar en lectura para trimestre/semestre/ano; la escritura directa de un rango no-mensual se bloquea (o se reparte por meses, decision del negocio). Sin esto, las 4 granularidades de la UI no tienen destino coherente.
- **D-rol — Gating por rol y vista del propio empleado (bloquea Fase 5).** La RLS actual expone todas las nominas a cualquier empleado de la empresa. Recomendacion: gestion solo RRHH/Direccion (helper de OLA2-02); decidir si el empleado puede ver SU propia nomina (`nom_read_self`). Es deuda de seguridad: aplicar aunque el resto se posponga.
- **D-modelo — Propinas en `nominas`.** La tabla no tipa propinas (`propina`, `propinaMantenimiento`). Decidir si van a `otros_devengos`/`complementos` (sin tocar schema) o si se anaden columnas `propinas`/`propina_mantenimiento`. Recomendacion: reutilizar `otros_devengos` salvo que el negocio exija desglose contable propio.

## Paths del proyecto

- `src/features/rrhh/components/pagos/PagosView.tsx` (vista a refactorizar; importes hoy en `useState`).
- `src/features/rrhh/data/pagos.ts` (tipos + `calcularTotalPago` + `getResumenPagos`; KPIs a sanear).
- `src/features/rrhh/actions/pagos-actions.ts` (lectura real existente: `listEmpleadosParaPagos`).
- `src/features/rrhh/actions/nominas-actions.ts` (NUEVO — server actions sobre `nominas`).
- `src/features/rrhh/io/pagos.io.ts` (IO a refactorizar; `fetchAll` hoy `[]`).
- `src/features/rrhh/actions/salarios-actions.ts` (OLA2-02 — interfaz de coste a consumir).
- `src/features/rrhh/actions/fichajes-actions.ts` (opcional, horas reales).
- `src/features/empresa/contexts/empresa-context.tsx` (slug vs dbId).
- `src/lib/supabase/get-context.ts`, `src/lib/supabase/admin.ts` (infra reutilizada).
- `supabase/migrations/026_rrhh_empleados.sql` (DDL real de `nominas`/`contratos`).
- `supabase/migrations/0NN_nominas_rls_por_rol.sql` (NUEVO — RLS correctiva por rol).

## Agentes recomendados

- **review-rls-multi-tenant** — auditar que la RLS por rol de `nominas` impide fuga de salarios entre empleados/empresas.
- **generate-data-access-layer** — capa de actions consistente con el patron del repo (`getAppContext`, gate de rol, `friendlyError`).
- **create-supabase-table-rls-base** — base para la migracion correctiva de RLS (adaptar a tabla existente, no crear).
- **execute-phase** — ejecucion por fases de este contrato.
- (Consulta al negocio para D-eje, D-rol y D-modelo antes de las fases afectadas; confirmar cierre de OLA2-02 para D1.)

## Checklist de cierre

- [ ] OLA2-02 cerrada y su interfaz de coste (`getCosteHoraPorEmpleado`) consumida; D1 heredada respetada.
- [ ] D-eje, D-rol y D-modelo resueltas por escrito y reflejadas en el codigo/migracion.
- [ ] Schema real de `nominas`/`contratos` verificado via Management API antes de migrar.
- [ ] `nominas-actions.ts` implementado (getNominas, getNominasRango, upsertNomina idempotente, cambiarEstadoNomina, prefillBaseNominas).
- [ ] Migracion `0NN_nominas_rls_por_rol.sql` aplicada e idempotente; RLS por rol verificada (empleado sin rol no accede).
- [ ] `PagosView` lee/escribe via actions; ediciones persisten tras recargar; estado efimero ya no es la verdad.
- [ ] Mapeo `PagoEmpleado` <-> `nominas` documentado y aplicado; `id` sintetico no se usa como PK.
- [ ] Eje temporal reconciliado: nomina mensual aparece sumada en trimestre/semestre/ano.
- [ ] Prefill de base desde OLA2-02 con `fuente` trazable (no a 0, no recalculo local).
- [ ] KPIs honestos en `getResumenPagos` (`prestamos`, `efectivoAhorro`).
- [ ] `pagos.io.ts` real o import/export desactivado explicitamente.
- [ ] `npm run typecheck` + `npm run build` en verde (WSL).
- [ ] Estado de este Full-TASK actualizado a IMPLEMENTADO + auto-blindaje declarado.

## Siguiente paso sugerido

Confirmar el cierre de OLA2-02 (interfaz de coste publicada) y verificar via Management API el schema real de `nominas`/`contratos`. Resolver D-eje, D-rol y D-modelo con el negocio. Con eso, ejecutar la Fase 1 (actions sobre `nominas`) y la Fase 5 (RLS por rol, deuda de seguridad) como prioridad, auditando con `review-rls-multi-tenant`. Si se prefiere ejecucion granular, descomponer con `/plan-to-tasks`.

## Ruta canonica

`docs/rrhh-consolidacion/ola2-demock/Full-TASK-OLA2-06-pagos-sobre-nominas.md`
