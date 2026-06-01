# Full-TASK-OLA2-12 - Bonus reales

## Estado

PLANIFICADO Ola 2 (2026-06-01). No implementado. Discovery verificado en `DISCOVERY_OLA2-12-bonus-reales.md` (mismo directorio). Clasificacion confirmada: **MOCK PURO** (vista lee 100% de `data/bonus.ts`; muta solo `useState`; sin actions ni Supabase). Existe una tabla `public.bonus` huerfana en la migracion `010` con schema divergente, nunca consultada y RLS write `using(true)`.

## Objetivo

Convertir el modulo de Bonus de mock a datos reales en Supabase con RLS multi-tenant real, persistiendo el **plan de bonus** (bonus + tablas de tramos + reglas + config por empresa) y sus **resultados** por periodo, todo por `empresaDbId` (UUID). Reconciliar la tabla huerfana del `010` con un schema alineado al tipo TS, conectar el CRUD hoy stub de `BonusView`, y exponer `getBonusAplicables` real (cruce destinatarios-por-puesto) apoyado en la fuente salarial/empleados saneada por OLA2-02/OLA2-01, eliminando el match difuso del mock en Mi Panel.

## Estimacion de complejidad

**Media.** Justificacion: es un CRUD descriptivo con estructuras anidadas (tablas/tramos/reglas como jsonb o tablas hijas) y RLS por empresa; reconciliacion de una tabla huerfana; e impacto en un segundo modulo (Mi Panel). No es trivial por las estructuras anidadas, la decision de negocio D3 y la dependencia de OLA2-02 para el cruce por puesto. Sube a Media-Alta **solo si** se elige la opcion B (calculo numerico), que implicaria rediseno del modelo de tramos y un motor de evaluacion contra modulos inexistentes (no recomendado en esta task).

## Criterio de corte

La tarea esta COMPLETA cuando:

1. `BonusView` lee de Supabase (no de `data/bonus.ts`) por `empresaActual.dbId`.
2. Existe persistencia real detras de server actions con gate de rol: crear/actualizar/eliminar/duplicar/archivar bonus, y editar tablas/tramos/reglas. Los botones "Guardar" / "Guardar borrador" y las acciones del menu (hoy sin handler) quedan funcionales.
3. `bonus_resultados` y la config por empresa (normas + formas de pago) persisten y se leen reales.
4. RLS multi-tenant real aplica a las 3 entidades (bonus, resultados, config): un usuario solo lee/escribe los de su empresa (no `using(true)`).
5. `getBonusAplicables` (Mi Panel) resuelve destinatarios contra el **puesto real** del empleado (`empleados.puesto_id` / `puestos_trabajo`, fuente de OLA2-02/01), no por match difuso sobre el mock.
6. D3 esta resuelta por escrito (descriptivo vs calculo) antes de migrar; el schema de tramos refleja la decision.
7. `data/bonus.ts` queda solo como seed/fixture o se elimina; ningun import de produccion lo usa para datos vivos.

Queda FUERA del corte: el **calculo automatico de importes** de bonus (los `ResultadoBonus` se introducen/importan a mano en la opcion A); el origen de magnitudes de balance/inventarios/inspecciones (otros modulos); y el motor numerico de tramos (solo si D3 = B, que esta task no recomienda).

## Modo operativo

- **taskId:** OLA2-12
- **taskMode:** code
- **reviewMode:** standard
- **sourcePlan:** `docs/rrhh-consolidacion/ola2-demock/EXECUTION_PLAN_OLA2.md`

## Contexto previo obligatorio

Antes de tocar codigo, leer:

1. `docs/rrhh-consolidacion/ola2-demock/DISCOVERY_OLA2-12-bonus-reales.md` (estado real completo).
2. `docs/rrhh-consolidacion/ola2-demock/Full-TASK-OLA2-02-salarios-reales.md` — **dependencia rio arriba: debe estar CERRADA** (o al menos su Fase 1-2: vinculo `empleados.puesto_id` saneado y `getCosteHoraPorPuesto`/`getCosteHoraPorEmpleado` disponibles). De aqui sale la fuente de verdad por puesto para el cruce de destinatarios.
3. `supabase/migrations/010_features_restantes.sql` (lin. 410-427: DDL real de la tabla `bonus` huerfana a reconciliar).
4. `src/features/rrhh/actions/empleados-actions.ts` y `pagos-actions.ts` (patron canonico de server action: `getAppContext`, `requireAdminUser`, `createAdminClient`, `revalidatePath`, `friendlyError`).
5. `src/features/empresa/contexts/empresa-context.tsx` (slug en `Empresa.id`, UUID en `Empresa.dbId`).
6. Resolver D3 (ver "Decisiones de negocio pendientes").

## Scope IN

- Modelo de datos real para **bonus** (alineado al tipo TS), **tablas/tramos** (jsonb embebido o tablas hijas), **reglas**, **bonus_resultados** y **config por empresa** (normas + formas de pago), con RLS multi-tenant por `empresa_id` UUID.
- Migracion nueva que **reconcilia** (o sustituye) la tabla huerfana `public.bonus` del `010` con el schema correcto y RLS real (no `using(true)`).
- Server actions: lectura por empresa, CRUD de bonus, edicion de tablas/tramos/reglas, duplicar/archivar/desactivar/eliminar, CRUD de resultados (alta/edicion manual o import), y CRUD de config (normas/formas de pago).
- Refactor de `BonusView.tsx` para consumir las actions por `empresaActual.dbId`: conectar "Guardar"/"Guardar borrador" y las acciones del menu (hoy stubs sin `onClick`).
- Refactor de `MisCondicionesView.tsx` (`getBonusAplicables`) para resolver destinatarios contra el puesto real del empleado (fuente OLA2-02/01), con fallback durante la transicion.
- Refactor de `bonus.io.ts` para `fetchAll` real (+ handlers de escritura o desactivacion explicita del import/export).
- Seed/migracion de los datos mock (habana/bacanal) si el negocio quiere conservarlos.

## Scope OUT

- **Calculo automatico de importes de bonus.** Los `ResultadoBonus` se crean/editan/importan a mano (opcion A). El motor numerico de tramos (opcion B) queda fuera salvo decision explicita de negocio.
- **Origen de las magnitudes de resultado** (balance, desviacion de inventarios, nota de inspecciones): pertenecen a otros modulos que hoy no existen como datos reales. Este submodulo no los crea ni los consume.
- **Creacion/gestion del salario** por puesto/empleado: es OLA2-02. Aqui solo se **consume** el vinculo empleado->puesto (y, si D3=B, el coste/hora).
- Reescritura del modelo de tramos a numerico (solo si D3 = B).
- Notificaciones/avisos de liquidacion de bonus a empleados.

## Restricciones

- TS estricto; Feature-First (codigo en `src/features/rrhh/...`).
- **VERIFICAR SCHEMA REAL via Management API antes de migrar.** No inferir el estado de `public.bonus` (ni de `empleados`/`puestos_trabajo`) desde el codigo ni desde el DDL del repo: el `010` puede haber divergido del estado real en Supabase. Confirmar columnas, tipos y politicas RLS reales antes de escribir cualquier migracion.
- **No editar la tabla huerfana in situ** asumiendo su contenido: la migracion nueva la reconcilia (ALTER para anadir columnas + reescribir politicas) o la sustituye (`drop ... if exists` + recreate) segun decision de Fase 0. Idempotente en ambos casos.
- Todas las consultas filtran por `empresa_id = empresaId` (UUID de `getAppContext`), nunca por slug.
- Mutaciones detras de `"use server"` con gate `requireAdminUser` (o equivalente por rol) salvo lecturas de visualizacion.
- RLS multi-tenant real: prohibido `using (true)` en escritura. Patron `empresa_id in (select p.empresa_id from profiles p where p.user_id = auth.uid())`.
- No romper `MisCondicionesView`: si la migracion es por fases, mantener fallback hasta que el vinculo real exista.
- Migraciones idempotentes (`create table if not exists`, `drop policy if exists`, `alter table ... add column if not exists`), siguiendo el estilo de `026_*` / `010`.

## Validacion requerida

- `npm run typecheck` y `npm run build` (en WSL) en verde.
- RLS verificada: un usuario de la empresa A no puede leer ni escribir bonus/resultados/config de la empresa B (test con JWT/usuario de otra empresa o consulta directa).
- CRUD real verificado: crear bonus, anadir tabla+tramos+reglas, guardar, recargar, y comprobar que persiste en BD (no solo `useState`). Idem duplicar/archivar/eliminar.
- `bonus_resultados` y config por empresa se leen y escriben reales.
- `MisCondicionesView` muestra los bonus aplicables resolviendo por puesto real (no match difuso); sin regresion visual.
- Idempotencia de la migracion (re-ejecutable sin error).
- Coherencia: la tabla huerfana del `010` queda reconciliada (sin schema divergente ni RLS `using(true)` residual).

## Dependencias

- **Depende de:** **OLA2-02 (salarios)** — provee la fuente de verdad por puesto (`puestos_trabajo`/`contratos`/`nominas`), el vinculo `empleados.puesto_id` saneado y `getCosteHoraPorPuesto`/`getCosteHoraPorEmpleado`. El cruce destinatarios-por-puesto de Mi Panel debe apoyarse aqui. Indirectamente depende de **OLA2-01** (fuente unica de empleados) por el vinculo empleado->puesto.
- **Bloquea a:** nada directamente (es hoja en el grafo de la Ola D).
- Reutiliza infra existente: `getAppContext`, `createAdminClient`, `requireAdminUser`, `revalidatePath`, `friendlyError`, patron de `empleados-actions.ts`/`pagos-actions.ts`.

## Inputs

- Dataset mock actual: `src/features/rrhh/data/bonus.ts` (habana 5 bonus + bacanal 3 bonus, resultados pre-calculados a mano, config por empresa) — candidato a seed.
- DDL real de la tabla huerfana: `supabase/migrations/010_features_restantes.sql` (lin. 410-427) — a verificar contra schema real.
- `empresaActual.dbId` (UUID) desde `empresa-context`.
- Fuente de verdad por puesto/empleado de OLA2-02/OLA2-01 (`empleados.puesto_id`, `puestos_trabajo`, y si D3=B, `getCosteHoraPorEmpleado`).
- Decision D3 resuelta por el negocio.

## Outputs esperados

- Migracion SQL nueva (p.ej. `0NN_rrhh_bonus.sql`) que reconcilia/sustituye `public.bonus` + crea `bonus_resultados` + config por empresa (tabla o jsonb) + RLS multi-tenant real (+ seed opcional).
- `src/features/rrhh/actions/bonus-actions.ts` con las server actions (firmas en "Interfaces publicas propuestas").
- `BonusView.tsx` refactorizado a datos reales por `dbId`, con botones de guardado y acciones de menu funcionales.
- `MisCondicionesView.tsx` con `getBonusAplicables` apoyado en el puesto real.
- `bonus.io.ts` con `fetchAll` real (+ escritura o desactivacion explicita).
- Actualizacion del estado de mock en este Full-TASK (a IMPLEMENTADO) al cerrar, con auto-blindaje declarado.

## Riesgos conocidos

- **Tabla huerfana mal reconciliada:** si el schema real difiere del `010`, un ALTER ciego rompe. Mitigacion: verificar via Management API; decidir ALTER vs drop+recreate en Fase 0; idempotencia.
- **`empresa_id` text vs UUID:** la huerfana usa `text` (slug); el patron multi-tenant del repo es UUID. Pasar slug a una consulta UUID devuelve vacio o error. Mitigacion: migrar la columna a UUID/FK a `empresas` y usar `empresaActual.dbId` en toda la capa.
- **Fuga multi-tenant:** la RLS `using(true)` actual permite escribir bonus de otra empresa. Mitigacion: politicas por `empresa_id` reales + auditoria con `review-rls-multi-tenant`.
- **Estructuras anidadas:** tablas/tramos/reglas como jsonb son comodas pero dificiles de consultar/validar; como tablas hijas son mas normalizadas pero anaden complejidad de CRUD. Mitigacion: decision explicita de modelado (ver "Modelo de datos propuesto"); recomendado jsonb por ser texto descriptivo no consultado por campo.
- **Acoplamiento con OLA2-02:** hacer bonus real antes que salarios deja el cruce por puesto sobre el mock. Mitigacion: respetar el orden (OLA2-02 primero) o fallback explicito en `getBonusAplicables`.
- **Mal entendido de D3:** implementar calculo cuando el negocio queria descripcion (o viceversa) reescribe el modelo de tramos. Mitigacion: resolver D3 por escrito antes de la migracion.
- **`ResultadoBonus.importe` string:** mantener `string` es honesto con el dominio (hay "—"/"Variable"), pero impide agregaciones. Mitigacion: en opcion A conservar `string`; si D3=B, anadir `importe_num numeric` derivado sin romper la representacion textual.

## Modelo de datos propuesto

> **VERIFICAR SCHEMA REAL via Management API antes de migrar.** Confirmar el estado real de `public.bonus` (la del `010` puede haber divergido), y de `empleados`/`puestos_trabajo` (para el vinculo de destinatarios). Ajustar la migracion al schema real: decidir entre **ALTER** de la huerfana (anadir columnas + reescribir RLS + migrar `empresa_id` a UUID) o **drop+recreate** si el negocio no conserva datos. Lo de abajo asume drop+recreate por claridad; adaptar a ALTER idempotente si hay datos a preservar.

**Decision de modelado (recomendada, asume D3 = A descriptivo):** persistir las estructuras anidadas (`tablas`/`tramos`/`reglas`) como **jsonb** dentro de la fila de `bonus`, porque son **texto libre descriptivo** que la UI pinta tal cual y **no se consulta por campo** (ni se calcula). Normalizar a tablas hijas anadiria complejidad de CRUD sin beneficio de query. Si D3 = B (calculo), promover `tramos` a tabla hija con columnas numericas (`min`/`max`/`operador`/`valor`/`comision_num`).

```sql
-- 0NN_rrhh_bonus.sql  (VERIFICAR/ADAPTAR al schema real antes de aplicar)
-- NOTA tabla huerfana: la tabla public.bonus del 010 tiene schema divergente
-- (solo: empresa_id text, nombre, estado, periodicidad, tipo_destinatario,
--  condiciones text, tramos jsonb) y RLS write using(true). NUNCA fue consultada.
-- Esta migracion la reconcilia. Si hay datos a preservar, sustituir el
-- drop/create por ALTER ... ADD COLUMN IF NOT EXISTS + migracion de empresa_id
-- a uuid. Decidir en Fase 0 tras verificar via Management API.

-- (opcion drop+recreate; envolver en idempotencia)
drop table if exists public.bonus_resultados cascade;
drop table if exists public.bonus cascade;
drop table if exists public.bonus_config_empresa cascade;

-- Plan de bonus (alineado al tipo TS Bonus)
create table if not exists public.bonus (
  id                  uuid primary key default gen_random_uuid(),
  empresa_id          uuid not null references public.empresas(id) on delete cascade,
  nombre              text not null,
  tipo                text not null default '',          -- texto libre ("Financiero", ...)
  descripcion         text not null default '',
  objetivo            text not null default '',
  explicacion         text not null default '',
  estado              text not null default 'borrador'
                        check (estado in ('activo','inactivo','borrador','archivado')),
  periodicidad        text not null default 'trimestral'
                        check (periodicidad in ('mensual','trimestral','semestral','anual','puntual')),
  destinatario_tipo   text not null default 'todos'
                        check (destinatario_tipo in ('todos','roles','departamentos','empleados')),
  destinatario_ids    text[] not null default '{}',      -- roles/departamentos/empleados segun tipo
  destinatarios_texto text not null default '',
  -- Estructuras descriptivas anidadas (texto libre, no consultadas por campo):
  tablas              jsonb not null default '[]'::jsonb, -- TablaTramos[]{titulo,descripcion,tramos[]{condicion,comision,observaciones}}
  reglas              jsonb not null default '[]'::jsonb, -- ReglaBonus[]{titulo,descripcion}
  forma_pago          text not null default '',
  premio              text not null default '',
  icono               text not null default 'Gift',       -- clave de ICON_MAP
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create index if not exists idx_bonus_empresa on public.bonus(empresa_id);

-- Resultados por periodo (importe TEXTO: el dominio usa "—"/"Variable"/"500 €").
-- En opcion A se introducen/importan a mano. Si D3=B, anadir importe_num numeric.
create table if not exists public.bonus_resultados (
  id          uuid primary key default gen_random_uuid(),
  bonus_id    uuid not null references public.bonus(id) on delete cascade,
  empresa_id  uuid not null references public.empresas(id) on delete cascade,
  periodo     text not null,                              -- "Q1 2026 (Ene–Mar)"
  estado      text not null default 'pendiente'
                check (estado in ('pendiente','calculado','liquidado')),
  importe     text not null default '—',
  resumen     text not null default '',
  detalles    jsonb not null default '{}'::jsonb,         -- Record<string,string>
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists idx_bonus_resultados_bonus on public.bonus_resultados(bonus_id);
create index if not exists idx_bonus_resultados_empresa on public.bonus_resultados(empresa_id);

-- Config por empresa (ConfigBonusEmpresa: normas[] + formasPago[]).
-- Una fila por empresa con arrays de texto (alternativa: jsonb unico).
create table if not exists public.bonus_config_empresa (
  empresa_id   uuid primary key references public.empresas(id) on delete cascade,
  normas       text[] not null default '{}',
  formas_pago  text[] not null default '{}',
  updated_at   timestamptz not null default now()
);

-- trigger updated_at (estilo 026_*)
create or replace function public.set_bonus_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end; $$;
drop trigger if exists bonus_updated_at on public.bonus;
create trigger bonus_updated_at before update on public.bonus
  for each row execute function public.set_bonus_updated_at();
drop trigger if exists bonus_resultados_updated_at on public.bonus_resultados;
create trigger bonus_resultados_updated_at before update on public.bonus_resultados
  for each row execute function public.set_bonus_updated_at();

-- ── RLS multi-tenant REAL (NO using(true)) ────────────────────
alter table public.bonus                enable row level security;
alter table public.bonus_resultados     enable row level security;
alter table public.bonus_config_empresa enable row level security;

-- Lectura: cualquier miembro de la empresa. Escritura: gate de rol en la action
-- (RRHH/Direccion); la policy garantiza ademas el aislamiento por empresa.
drop policy if exists "bonus_read" on public.bonus;
create policy "bonus_read" on public.bonus for select to authenticated
  using (empresa_id in (select p.empresa_id from public.profiles p where p.user_id = auth.uid()));
drop policy if exists "bonus_write" on public.bonus;
create policy "bonus_write" on public.bonus for all to authenticated
  using      (empresa_id in (select p.empresa_id from public.profiles p where p.user_id = auth.uid()))
  with check (empresa_id in (select p.empresa_id from public.profiles p where p.user_id = auth.uid()));

drop policy if exists "bonus_res_read" on public.bonus_resultados;
create policy "bonus_res_read" on public.bonus_resultados for select to authenticated
  using (empresa_id in (select p.empresa_id from public.profiles p where p.user_id = auth.uid()));
drop policy if exists "bonus_res_write" on public.bonus_resultados;
create policy "bonus_res_write" on public.bonus_resultados for all to authenticated
  using      (empresa_id in (select p.empresa_id from public.profiles p where p.user_id = auth.uid()))
  with check (empresa_id in (select p.empresa_id from public.profiles p where p.user_id = auth.uid()));

drop policy if exists "bonus_cfg_read" on public.bonus_config_empresa;
create policy "bonus_cfg_read" on public.bonus_config_empresa for select to authenticated
  using (empresa_id in (select p.empresa_id from public.profiles p where p.user_id = auth.uid()));
drop policy if exists "bonus_cfg_write" on public.bonus_config_empresa;
create policy "bonus_cfg_write" on public.bonus_config_empresa for all to authenticated
  using      (empresa_id in (select p.empresa_id from public.profiles p where p.user_id = auth.uid()))
  with check (empresa_id in (select p.empresa_id from public.profiles p where p.user_id = auth.uid()));
```

> **Nota sobre `profiles.empresa_id`:** el patron del `010` filtra por `profiles.empresa_id`. Confirmar via Management API que esa columna existe y que su tipo casa con `bonus.empresa_id` (UUID). Si el repo usa una funcion de rol (p.ej. `tiene_rol_rrhh_o_direccion`), reforzar las policies de escritura con ella, igual que en OLA2-02. **VERIFICAR SCHEMA REAL.**

## Interfaces publicas propuestas

Archivo: `src/features/rrhh/actions/bonus-actions.ts` (`"use server"`, patron `getAppContext` + `requireAdminUser` + `revalidatePath` + `friendlyError`). Todas usan el **UUID** de empresa (no slug). Tipos de retorno `{ ok, data?/error? }` coherentes con el repo.

```ts
import type {
  Bonus, ResultadoBonus, ConfigBonusEmpresa,
} from "@/features/rrhh/data/bonus"; // tipos canonicos (se conservan como contrato TS)

type BonusInput = Omit<Bonus, "id" | "empresaId">;

// ── Lectura ────────────────────────────────────────────────────
// empresaDbId = empresaActual.dbId (UUID).
export async function getBonusEmpresa(empresaDbId: string): Promise<{
  ok: boolean; data: Bonus[]; error?: string;
}>;
export async function getConfigBonus(empresaDbId: string): Promise<{
  ok: boolean; data: ConfigBonusEmpresa; error?: string;
}>;
export async function getResultadosBonus(empresaDbId: string, bonusId: string): Promise<{
  ok: boolean; data: ResultadoBonus[]; error?: string;
}>;

// ── CRUD de bonus (gate rol RRHH/Direccion) ────────────────────
export async function crearBonus(empresaDbId: string, input: BonusInput): Promise<{ ok: boolean; id?: string; error?: string }>;
export async function actualizarBonus(bonusId: string, patch: Partial<BonusInput>): Promise<{ ok: boolean; error?: string }>;
export async function eliminarBonus(bonusId: string): Promise<{ ok: boolean; error?: string }>;
export async function duplicarBonus(bonusId: string): Promise<{ ok: boolean; id?: string; error?: string }>;
// estado: activo|inactivo|borrador|archivado (cubre Desactivar/Archivar del menu)
export async function cambiarEstadoBonus(bonusId: string, estado: Bonus["estado"]): Promise<{ ok: boolean; error?: string }>;

// ── Resultados (opcion A: alta/edicion manual o import; SIN calculo) ──
export async function crearResultadoBonus(bonusId: string, input: Omit<ResultadoBonus, "id" | "bonusId">): Promise<{ ok: boolean; id?: string; error?: string }>;
export async function actualizarResultadoBonus(resultadoId: string, patch: Partial<Omit<ResultadoBonus, "id" | "bonusId">>): Promise<{ ok: boolean; error?: string }>;
export async function eliminarResultadoBonus(resultadoId: string): Promise<{ ok: boolean; error?: string }>;

// ── Config por empresa (normas + formas de pago) ───────────────
export async function actualizarConfigBonus(empresaDbId: string, patch: Partial<ConfigBonusEmpresa>): Promise<{ ok: boolean; error?: string }>;

// ── Cruce destinatarios-por-puesto para Mi Panel (fuente real OLA2-02/01) ──
// Resuelve los bonus aplicables al empleado segun su puesto/departamento real
// (empleados.puesto_id -> puestos_trabajo), NO por match difuso sobre el mock.
// Sin empresaDbId: deriva del user via getAppContext.
export async function getBonusAplicables(): Promise<{
  ok: boolean; data: Bonus[]; error?: string;
}>;
```

`bonus.io.ts`: `fetchAll(ctx)` pasa a llamar `getBonusEmpresa(ctx.empresaDbId)` (no el mock por slug); los handlers de escritura, si entran en corte, delegan en `crear/actualizarBonus`; si no, desactivar import/export explicitamente.

> Si D3 = B (calculo), anadir: `calcularResultadosBonus(bonusId, periodo, magnitudes)` y promover `TramoBonus` a un tipo numerico. **No recomendado en esta task** (ver decisiones).

## Flujo operativo esperado (fases)

1. **Fase 0 — Decisiones + verificacion.** Cerrar D3 por escrito. Confirmar via Management API el schema real de `public.bonus` (huerfana) y del vinculo `empleados.puesto_id`/`puestos_trabajo`. Decidir ALTER vs drop+recreate. Verificar dependencia OLA2-02 (al menos vinculo empleado->puesto disponible).
2. **Fase 1 — Migracion.** Reconciliar/crear `bonus` + `bonus_resultados` + `bonus_config_empresa` con RLS real (no `using(true)`); migrar `empresa_id` a UUID; triggers `updated_at`. Seed opcional desde el mock (habana/bacanal).
3. **Fase 2 — Actions.** Implementar `bonus-actions.ts` (lectura, CRUD bonus, estado/duplicar, CRUD resultados, config, `getBonusAplicables`) con gates de rol.
4. **Fase 3 — UI RRHH.** Refactor `BonusView.tsx` a `empresaActual.dbId` + actions; conectar "Guardar"/"Guardar borrador" (lin. 599-604) y las acciones del menu (Duplicar/Desactivar/Archivar/Eliminar, lin. 155-158) hoy sin handler; persistir tablas/tramos/reglas.
5. **Fase 4 — Mi Panel.** Refactor `MisCondicionesView.tsx` (`getBonusAplicables`) para resolver destinatarios contra el puesto real (fuente OLA2-02/01), con fallback durante la transicion.
6. **Fase 5 — IO + cierre.** `bonus.io.ts` real (o desactivar import/export); retirar `data/bonus.ts` de produccion (queda como seed/fixture); validacion typecheck+build+RLS; actualizar estado de este Full-TASK a IMPLEMENTADO + auto-blindaje.

## Decisiones de negocio pendientes

- **D3 — El modulo describe el plan de bonus o calcula importes (CRITICA, bloquea el schema de tramos).** Hoy los tramos son **texto libre** (`condicion: "+15.000 €"`, `"Desviacion < 3%"`, `"8 a 9"`; `comision: "300 €"`) y los `ResultadoBonus` estan pre-calculados a mano citando magnitudes (balance, desviacion de inventario, nota de inspeccion) que **viven en otros modulos inexistentes como datos reales**.
  - **Opcion A — CRUD descriptivo.** Persistir el plan tal cual (bonus + tablas/tramos/reglas/normas como texto, jsonb) y los resultados introducidos/importados a mano. No calcula.
  - **Opcion B — Calculo numerico.** Rediseno de `TramoBonus` a `{ min, max, operador, valor, comision_num }` + motor que evalua condiciones contra magnitudes reales. Pero esas magnitudes **no existen** hoy como modulos reales; B quedaria bloqueado por dependencias fuera de scope.
  - **RECOMENDACION DEL AGENTE: opcion A (descriptivo) en esta task.** Razones: (1) es lo que el negocio ya modelo (todo es texto libre, sin un solo numero operable); (2) los inputs del calculo (balance/inventarios/inspecciones) no existen como datos reales, asi que B seria un motor sin combustible; (3) entrega valor real e inmediato (persistencia + RLS + CRUD funcional + cruce por puesto en Mi Panel) sin bloquearse; (4) deja el camino abierto a B sin retrabajo: el DDL preve anadir `importe_num` y promover `tramos` a tabla hija cuando los modulos de origen existan. Mantener `ResultadoBonus.importe` como **string** (el dominio usa "—"/"Variable"). Confirmar A con el cliente antes de migrar.
- **Dependencia OLA2-02 (orden de ejecucion).** El cruce destinatarios-por-puesto de `getBonusAplicables` debe usar la fuente real (`empleados.puesto_id`/`puestos_trabajo`) que sanea OLA2-02/OLA2-01, no el match difuso del mock. **Ejecutar OLA2-02 antes** (o al menos su vinculo empleado->puesto). Con D3=A, NO se necesita `getCosteHoraPorPuesto` (solo el vinculo); con D3=B, si se necesitaria el coste/hora.

## Paths del proyecto

- `src/features/rrhh/data/bonus.ts` (mock actual; futuro seed/fixture; conserva los tipos canonicos `Bonus`/`ResultadoBonus`/`ConfigBonusEmpresa`).
- `src/features/rrhh/components/bonus/BonusView.tsx` (vista RRHH a refactorizar; botones de guardado y menu hoy stub).
- `src/features/rrhh/io/bonus.io.ts` (IO a refactorizar).
- `src/features/mi-panel/components/MisCondicionesView.tsx` (consumidor externo, Mi Panel; `getBonusAplicables`).
- `src/features/rrhh/actions/bonus-actions.ts` (NUEVO — server actions).
- `src/features/rrhh/actions/empleados-actions.ts`, `pagos-actions.ts` (patron de referencia).
- `src/features/rrhh/data/salarios.ts` + `src/features/rrhh/actions/salarios-actions.ts` (OLA2-02; fuente del vinculo por puesto).
- `src/features/empresa/contexts/empresa-context.tsx` (slug vs dbId).
- `supabase/migrations/010_features_restantes.sql` (tabla `bonus` huerfana a reconciliar, lin. 410-427).
- `supabase/migrations/0NN_rrhh_bonus.sql` (NUEVO — migracion).
- `src/lib/supabase/get-context.ts`, `src/lib/supabase/admin.ts` (infra reutilizada).

## Agentes recomendados

- **create-supabase-table-rls-base** — andamiaje de tablas + RLS multi-tenant real (reemplazo de la RLS `using(true)` de la huerfana).
- **review-rls-multi-tenant** — auditar que la RLS impide leer/escribir bonus de otra empresa.
- **generate-data-access-layer** — capa de actions consistente con el patron del repo.
- **execute-phase** — ejecucion por fases de este contrato.
- (Consulta al cliente/negocio para D3 antes de la Fase 1.)

## Checklist de cierre

- [ ] D3 resuelta por escrito (descriptivo vs calculo) y reflejada en el schema de tramos.
- [ ] OLA2-02 cerrada (o vinculo empleado->puesto disponible) antes de tocar `getBonusAplicables`.
- [ ] Schema real de `public.bonus` verificado via Management API antes de migrar (ALTER vs drop+recreate decidido).
- [ ] Migracion `0NN_rrhh_bonus.sql` aplicada e idempotente; tabla huerfana reconciliada; `empresa_id` migrado a UUID.
- [ ] RLS multi-tenant real verificada en bonus + resultados + config (sin `using(true)`; aislamiento entre empresas).
- [ ] `bonus-actions.ts` implementado (lectura + CRUD bonus + estado/duplicar + CRUD resultados + config + `getBonusAplicables`).
- [ ] `BonusView.tsx` consume datos reales por `dbId`; "Guardar"/"Guardar borrador" y acciones de menu funcionales; tablas/tramos/reglas persisten.
- [ ] `MisCondicionesView.tsx` resuelve bonus aplicables por puesto real (no match difuso); sin regresion.
- [ ] `bonus.io.ts` real o import/export desactivado explicitamente.
- [ ] `data/bonus.ts` fuera de produccion (seed/fixture o eliminado; tipos canonicos conservados).
- [ ] `npm run typecheck` + `npm run build` en verde (WSL).
- [ ] Estado de este Full-TASK actualizado a IMPLEMENTADO + auto-blindaje declarado.

## Siguiente paso sugerido

Llevar D3 al cliente/negocio para decision explicita (recomendacion: descriptivo) y confirmar que OLA2-02 esta cerrada o, al menos, que el vinculo `empleados.puesto_id` esta saneado. En paralelo, verificar via Management API el schema real de `public.bonus` y decidir ALTER vs drop+recreate. Con todo resuelto, ejecutar la Fase 1 (migracion reconciliada + RLS real) con `create-supabase-table-rls-base` y auditar con `review-rls-multi-tenant`. Tras la migracion, descomponer en tareas via `/plan-to-tasks` si se prefiere ejecucion granular.

## Ruta canonica

`docs/rrhh-consolidacion/ola2-demock/Full-TASK-OLA2-12-bonus-reales.md`
