# DISCOVERY OLA2-12 - Bonus reales

- **Fecha:** 2026-06-01
- **Tarea:** OLA2-12 (depende de OLA2-02 salarios)
- **Repo:** `Balles-Hosteleros`
- **Plan maestro:** `docs/rrhh-consolidacion/ola2-demock/EXECUTION_PLAN_OLA2.md`
- **Metodo:** lectura directa de archivos via UNC `\\wsl.localhost\Ubuntu\home\fernandomp\dev\Balles-Hosteleros`, verificado linea a linea sobre los 4 archivos clave (vista, data, io, DDL). No inferido de docs.
- **Clasificacion:** **MOCK PURO.** Sin server actions, sin Supabase, sin persistencia. Toda la vista lee de un modulo de datos estaticos y muta solo `useState`.

## Resumen ejecutivo

El modulo Bonus es **100% mock con una tabla huerfana en BD que nadie consulta**. La vista renderiza datos estaticos por empresa (slug `habana`/`bacanal`), permite "editar" en memoria (incluido crear bonus, anadir tablas/tramos/reglas) pero **ningun cambio se persiste**: los botones "Guardar" / "Guardar borrador" no tienen `onClick`, y las acciones del menu (Duplicar, Desactivar, Archivar, Eliminar) son items sin handler. Existe una tabla `public.bonus` (migracion `010`) cuyo schema **diverge del tipo TS** y que **nunca se lee ni se escribe** desde el codigo.

Particularidad de dominio que condiciona toda la task: los tramos de bonus son **texto libre** (`condicion: "+15.000 €"`, `comision: "300 €"`, `condicion: "Desviacion < 3%"`, `condicion: "8 a 9"`). **No hay aritmetica.** Y los `ResultadoBonus` reales (importes liquidados) **no se originan en este modulo**: salen de balance, inventarios e inspecciones (otros modulos que hoy no existen como datos reales). Esto fuerza la decision D3 (descriptivo vs calculo) antes de tocar codigo.

## Archivos verificados

| Archivo | Lineas | Rol | Estado |
| --- | --- | --- | --- |
| `src/features/rrhh/components/bonus/BonusView.tsx` | 665 | Unico componente; listado + detalle (3 tabs: detalles / resultados / config) | Lee mock; muta solo `useState`; sin persistencia |
| `src/features/rrhh/data/bonus.ts` | 366 | Mock de bonus + resultados + config + tipos TS canonicos | Fuente de verdad de facto de la UI |
| `src/features/rrhh/io/bonus.io.ts` | 47 | Import/Export (`ModuleIO`) | `fetchAll` lee solo mock (`getBonusPorEmpresa`) |
| `supabase/migrations/010_features_restantes.sql` (lin. 410-427) | — | DDL de la tabla `public.bonus` huerfana | Schema divergente; NUNCA consultada; RLS write `using(true)` |
| `src/features/mi-panel/components/MisCondicionesView.tsx` | 386 | Consumidor externo (Mi Panel); cruza bonus con salarios/puesto | Lee mock de bonus + mock de salarios |

## Estado real detallado

### 1. La vista lee 100% del mock y no persiste nada

`BonusView.tsx`:

- Estado inicial desde mock (lin. 631): `useState<Bonus[]>(() => getBonusPorEmpresa(eId))`. `eId = empresaActual.id` es el **slug** (`"bacanal"`/`"habana"`), no el UUID.
- Config y resultados tambien del mock: `getConfigBonusEmpresa(eId)` (lin. 632), `getResultadosPorBonus(empresaId, bonus.id)` (lin. 307).
- `handleCrear` (lin. 642-646): `crearBonusVacio` + `setBonusList((prev) => [nuevo, ...prev])`. Solo memoria.
- `TabConfiguracion` (lin. 383-571): todo el CRUD de tablas/tramos/reglas (`addTabla`, `updateTramo`, `removeRegla`, etc.) opera sobre `onChange` -> `setB` (lin. 582). Nada sale del componente.
- **Botones de guardado sin handler** (lin. 599-604): `<Button variant="outline">Guardar borrador</Button>` y `<Button>Guardar</Button>` **no tienen `onClick`**. Son decorativos.
- **Acciones de menu sin handler** (lin. 155-158): `Duplicar`, `Desactivar`, `Archivar`, `Eliminar` son `DropdownMenuItem` sin `onClick`.
- **No hay ningun import de actions.** La unica via de mutacion es `IOActions` (lin. 101) sobre `bonusIO`, que recarga con `window.location.reload()` (import/export en memoria/fichero, no BD).

### 2. Modelo de datos mock (`data/bonus.ts`) — texto libre, sin aritmetica

Entidad central `Bonus` (lin. 49-66):

```ts
export interface Bonus {
  id: string;
  empresaId: string;
  nombre: string;
  tipo: string;            // "Financiero" | "Operativo" | "Calidad" | "Reconocimiento" | "Variable" (texto libre)
  descripcion: string;
  objetivo: string;
  explicacion: string;
  estado: EstadoBonus;     // "activo" | "inactivo" | "borrador" | "archivado"
  periodicidad: PeriodicidadBonus; // "mensual" | "trimestral" | "semestral" | "anual" | "puntual"
  destinatarios: { tipo: TipoDestinatario; ids: string[] }; // tipo: "todos"|"roles"|"departamentos"|"empleados"
  destinatariosTexto: string;
  tablas: TablaTramos[];
  reglas: ReglaBonus[];
  formaPago: string;
  premio: string;
  icono: string;           // clave de ICON_MAP (TrendingUp, Package, ...)
}
```

Estructuras anidadas (lin. 29-47):

```ts
export interface TramoBonus { id: string; condicion: string; comision: string; observaciones: string; }
export interface TablaTramos { id: string; titulo: string; descripcion: string; tramos: TramoBonus[]; }
export interface ReglaBonus { id: string; titulo: string; descripcion: string; }
```

**Clave de dominio:** `condicion` y `comision` son **strings descriptivos**, no numeros. Ejemplos reales del mock (lin. 87-90, 112-115, 145-148):

- `{ condicion: "+15.000 €", comision: "300 €", observaciones: "Resultado minimo" }`
- `{ condicion: "Desviacion < 3%", comision: "150 €", observaciones: "Excelente control" }`
- `{ condicion: "8 a 9", comision: "35 €" }`

No hay `min`/`max`/`operador`/`valor`. El sistema **describe** un plan de bonus; no evalua condiciones ni calcula importes.

Resultados (lin. 293-301) — `importe` es **STRING**:

```ts
export interface ResultadoBonus {
  id: string;
  bonusId: string;
  periodo: string;          // "Q1 2026 (Ene–Mar)", "Marzo 2026"
  estado: EstadoResultado;  // "pendiente" | "calculado" | "liquidado"
  importe: string;          // "500 €", "—", "Variable"
  resumen: string;
  detalles: Record<string, string>; // pares clave/valor de texto ("Facturacion": "142.500 €", ...)
}
```

Los resultados del mock estan **pre-calculados a mano** y citan magnitudes de otros dominios: "Facturacion", "Gastos", "Balance final" (balance), "Desviacion barra/cocina" (inventarios), "Nota inspeccion" (inspecciones). **Ese calculo no vive en este modulo ni en ningun otro real hoy.**

Config por empresa (lin. 68-71):

```ts
export interface ConfigBonusEmpresa { normas: string[]; formasPago: string[]; }
```

API publica del mock (lin. 342-366): `getBonusPorEmpresa(empresaId)`, `getConfigBonusEmpresa(empresaId)`, `getResultadosPorBonus(empresaId, bonusId)`, `crearBonusVacio(empresaId)`. Todas hardcodean por slug (`if (empresaId === "habana") ... if (empresaId === "bacanal") ...`).

### 3. Tabla `public.bonus` HUERFANA — schema divergente, RLS insegura

`supabase/migrations/010_features_restantes.sql`, lin. 413-427 (verbatim):

```sql
create table if not exists public.bonus (
  id uuid primary key default gen_random_uuid(),
  empresa_id text not null,
  nombre text not null,
  estado text not null default 'borrador',
  periodicidad text default 'mensual',
  tipo_destinatario text default 'todos',
  condiciones text,
  tramos jsonb default '[]',
  created_at timestamptz not null default now()
);

alter table public.bonus enable row level security;
create policy "bon_read" on public.bonus for select to authenticated using (empresa_id in (select p.empresa_id from profiles p where p.user_id = auth.uid()));
create policy "bon_write" on public.bonus for all to authenticated using (true) with check (true);
```

Hallazgos:

- **Nunca consultada.** `grep` de `from("bonus")` / `.bonus` en `src/` no devuelve ningun acceso a esta tabla. Ningun action la lee ni escribe.
- **Schema divergente del tipo TS.** La tabla tiene `condiciones text` + `tramos jsonb` y le **faltan**: `tipo`, `descripcion`, `objetivo`, `explicacion`, `destinatarios_texto`, `reglas`, `forma_pago`, `premio`, `icono`. La estructura `destinatarios{tipo,ids[]}` esta reducida a un unico `tipo_destinatario text` (se pierden los `ids`). No hay tabla de `bonus_resultados` ni de config por empresa.
- **`empresa_id` es `text`** (coherente con el mock por slug), no UUID/FK a `empresas`. Diverge del patron multi-tenant por UUID que adopta OLA2-02.
- **RLS write insegura:** `bon_write ... using (true) with check (true)` permite a cualquier usuario autenticado escribir/borrar filas de **cualquier empresa**. La lectura si filtra por empresa.

**Decision de discovery:** **no tocar la tabla huerfana del `010`**; crear una **migracion nueva** que reconcilie el schema completo (alineado al tipo TS), anada `bonus_resultados` y la config por empresa (tabla o jsonb), y aplique **RLS multi-tenant real** (no `using(true)`). Si el negocio no quiere conservar la huerfana, la migracion nueva puede `drop table if exists public.bonus` antes de recrearla con el schema correcto (decidir en Fase 0; **verificar primero el schema real via Management API**, el DDL del repo puede haber divergido).

### 4. Consumidor externo: Mi Panel cruza bonus con salarios (ambos mock)

`src/features/mi-panel/components/MisCondicionesView.tsx`:

- Importa **mock de salarios** (`getSalariosEmpresa`, lin. 10) y **mock de bonus** (`getBonusPorEmpresa`, lin. 11).
- `getBonusAplicables(bonus, puesto, roles)` (lin. 62-90): filtra bonus `estado === "activo"`, y para `destinatarios.tipo !== "todos"` hace **match difuso** (`c.includes(n) || n.includes(c)`) entre los `ids` del bonus y el puesto/departamento/roles del empleado. `tipo === "empleados"` siempre devuelve `false` (no implementado).
- El puesto se resuelve con `buscarPuestoUsuario` (lin. 33-47), un **match por substring** sobre `nombre + email + roles` contra los puestos del mock salarial. Es exactamente el match difuso que OLA2-02 propone eliminar via `empleados.puesto_id`.
- `BonusAplicablesCard` (lin. 342-385) solo pinta nombre, periodicidad y descripcion (no importes).

**Implicacion de orden:** hacer bonus real **sin** salarios real (OLA2-02) deja Mi Panel a medias: el cruce bonus-por-puesto seguiria apoyado en el match difuso del mock salarial. El vinculo destinatarios-por-puesto debe usar la **fuente real de OLA2-02/OLA2-01** (`empleados.puesto_id`, `puestos_trabajo`), no `data/salarios.ts` ni `data/rrhh.ts`.

## Dependencia con OLA2-02 (salarios)

`Full-TASK-OLA2-02-salarios-reales.md` ya esta redactado y declara a OLA2-12 como **consumidor aguas abajo**. OLA2-02 expone (firmas en su contrato): `getCosteHoraPorPuesto(empresaDbId)` y `getCosteHoraPorEmpleado(empresaDbId)`, y fija la **fuente de verdad salarial** en `puestos_trabajo` / `contratos` / `nominas` (jerarquia: nomina > contrato > plantilla). Mi Panel se refactoriza alli para usar `getMiSalario()` con vinculo real. OLA2-12 debe apoyar su cruce destinatarios-por-puesto en esa fuente, no en el mock.

Nota: el cruce **bonus x salario** solo es estrictamente necesario si D3 = calculo (para derivar importes a partir de coste/hora u objetivos). Si D3 = descriptivo, OLA2-12 solo necesita de OLA2-02 el **vinculo empleado->puesto** ya saneado (para resolver destinatarios), no el coste/hora.

## Decision pendiente (D3) — clave

**D3 — descriptivo vs calculo.** Bifurcacion abierta en el plan maestro (lin. 111):

- **(A) CRUD descriptivo.** El modulo persiste la **descripcion** del plan de bonus (bonus + tablas/tramos/reglas/normas como hoy, texto libre) y, opcionalmente, `bonus_resultados` introducidos a mano (igual que el mock). No calcula importes.
- **(B) Calculo numerico.** Rediseno de tramos a `{ min, max, operador, valor, comision_num }` y motor que evalua condiciones contra magnitudes reales. Pero esas magnitudes (balance, desviacion de inventario, nota de inspeccion) **viven en otros modulos que hoy no existen como datos reales**. B esta, de facto, **bloqueado** por dependencias fuera del scope de este submodulo.

**Recomendacion del agente: opcion A (CRUD descriptivo) en esta task**, con el modelo numerico preparado pero NO activado. Detalle y justificacion en el Full-TASK (seccion "Decisiones de negocio pendientes").

## Conclusiones para el Full-TASK

1. **MOCK PURO**: convertir a real exige migracion nueva + actions CRUD + refactor de la vista y de `bonus.io.ts`, todo por `empresaDbId` (UUID).
2. **No tocar la tabla huerfana** del `010`; crear migracion nueva reconciliada (bonus completo + `bonus_resultados` + config) con **RLS multi-tenant real**.
3. **Resolver D3 antes de migrar**: el schema de tramos depende de si se calcula o solo se describe. Recomendacion: descriptivo.
4. **Ordenar tras OLA2-02**: el cruce destinatarios/salario de Mi Panel debe usar la fuente real (`empleados.puesto_id`/`puestos_trabajo`), no el mock.
5. **`ResultadoBonus` reales quedan FUERA de scope** de este submodulo: su origen (balance/inventarios/inspecciones) es de otros modulos. En A, los resultados son introducidos/importados a mano.

## Ruta canonica

`docs/rrhh-consolidacion/ola2-demock/DISCOVERY_OLA2-12-bonus-reales.md`
