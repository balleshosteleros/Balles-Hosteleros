# DISCOVERY OLA2-02 - Salarios reales (tabla salarial + coste/hora)

- **Fecha:** 2026-06-01
- **Tarea:** OLA2-02 (KEYSTONE de pagos, bonus y ratios)
- **Metodo:** lectura directa de archivos via UNC `\\wsl.localhost\Ubuntu\home\fernandomp\dev\Balles-Hosteleros` + busqueda de consumidores con `grep` (WSL non-login). Verificado linea a linea sobre los 4 archivos clave.
- **Clasificacion:** MOCK PURO. Sin server actions, sin Supabase, sin persistencia. Toda la vista lee de un modulo de datos estaticos.

## Archivos verificados

| Archivo | Lineas | Rol |
|---|---|---|
| `src/features/rrhh/data/salarios.ts` | 448 | Fuente de datos mock (interfaces + dataset por empresa) |
| `src/features/rrhh/components/salarios/SalariosView.tsx` | 564 | Vista cliente completa (lista + detalle + config + normas) |
| `src/features/rrhh/io/salarios.io.ts` | 56 | Config import/export; `fetchAll` devuelve el mock |
| `supabase/migrations/026_rrhh_empleados.sql` | 396 | DDL real de RRHH (empleados, puestos_trabajo, contratos, nominas...) |

## Estado real detallado

### 1. La vista lee 100% del mock

`SalariosView.tsx` (linea 43):

```ts
const data = useMemo(() => getSalariosEmpresa(empresaActual.id), [empresaActual.id]);
```

- `empresaActual.id` es el **slug** (`"bacanal"` / `"habana"`), no el UUID. Ver `empresa-context.tsx` lineas 13-19: `Empresa.id` = slug, `Empresa.dbId?` = UUID real de Supabase.
- No hay ninguna llamada a server action ni a Supabase en toda la vista.
- Los botones de escritura son stubs sin handler:
  - Linea 218: `onNuevo={() => { /* TODO: abrir crear puesto */ }}`.
  - Lineas 454, 477, 491, 513, 520: botones "Nuevo" / `Settings2` sin `onClick`.
- La unica via de mutacion existente es `IOActions` (lineas 230-234), que opera sobre `salariosIO` y recarga con `window.location.reload()` (import/export, no persiste en BD).

### 2. Modelo de datos mock (`data/salarios.ts`)

Entidad central `PuestoSalarial` (tabla salarial **por puesto**, no por empleado) — lineas 8-24:

```ts
export interface PuestoSalarial {
  id: string;
  departamento: string;
  puesto: string;
  vacaciones: string;        // texto libre: "30 dias naturales"
  nominaNeta: number;        // neto declarado en nomina
  efectivoExtra: number;     // pago en B (efectivo fuera de nomina)
  salarioNeto: number;       // campo libre, hoy NO derivado
  jornadaContrato: string;   // "Completa" | "Parcial" | "Por evento"
  horasSemanales: number;
  diasLibres: number;
  horarioSemanal: HorarioDia[];  // 7 dias { dia, turno }
  observaciones: string;
  objetivos: string[];
  estado: "activo" | "borrador" | "inactivo";
  updatedAt: string;         // string, no timestamptz
}
```

Otras interfaces:

- `HorarioDia { dia: string; turno: string }` (lineas 3-6); `turno` es texto libre tipo `"10:00 - 18:00"` o `"LIBRE"`.
- `NormaSalarial { id, titulo, descripcion }` (lineas 26-30).
- `SalariosEmpresa { puestos: PuestoSalarial[]; normas: NormaSalarial[] }` (lineas 32-35).

Exportaciones:

- `SALARIOS_POR_EMPRESA: Record<string, SalariosEmpresa>` (lineas 426-429), indexado por **slug**: `bacanal` (13 puestos), `habana` (7 puestos). Normas compartidas (`NORMAS_BASE`, 4 normas, lineas 47-72).
- `getSalariosEmpresa(empresaId: string): SalariosEmpresa` (lineas 431-433); fallback `{ puestos: [], normas: NORMAS_BASE }`.
- `DEPARTAMENTOS_DISPONIBLES: string[]` (lineas 435-448), 12 nombres hardcodeados.

Observacion de coherencia: `salarioNeto` es un campo libre. En los datos suele cumplir `salarioNeto == nominaNeta + efectivoExtra`, pero NO esta forzado por codigo. El puesto "Artistas" (lineas 282-297) tiene todo a 0 y estado `borrador`.

### 3. La capa IO tambien es mock (`io/salarios.io.ts`)

- `salariosIO.fetchAll` (lineas 52-55) hace `getSalariosEmpresa(empresaId).puestos` — devuelve el mock.
- `uniqueBy: "puesto"` (linea 34) y columna `puesto` marcada `unique` (linea 38).
- **No existe handler de escritura** (`upsertRow` / `deleteRow` / persistencia). El schema Zod (`salarioSchema`, lineas 8-24) replica `PuestoSalarial` con `id` exigido.

### 4. La BD ya tiene el dominio salarial real (`026_rrhh_empleados.sql`)

NO existe ninguna tabla "salarios por puesto" como tal. PERO el dominio salarial ya esta modelado con RLS:

- **`puestos_trabajo`** (lineas 43-54): `id uuid pk`, `empresa_id` (FK empresas, cascade), `departamento_id` (FK departamentos, set null), `nombre text not null`, `descripcion`, **`salario_base numeric(10,2)`**, `activo`, timestamps. **`unique (empresa_id, nombre)`**. RLS `puesto_read` / `puesto_manage` (lineas 330-334), ambas por pertenencia a empresa via `profiles`.
  - **Clave para D1:** esta es la tabla candidata natural para la tabla salarial por puesto. Ya tiene `salario_base` y la unicidad `(empresa_id, nombre)`. Hoy esta practicamente muerta: las unicas lecturas son joins `puestos_trabajo(nombre)` en `empleados-actions.ts` (`getMiInformacionLaboral`, linea ~702) y nunca se lee `salario_base`.
- **`empleados.puesto`** es **texto libre** (no hay columna FK a `puestos_trabajo` consultada en escritura; `empleados.puesto_id` existe en DDL linea 82 pero el flujo de alta guarda `puesto` como string, ver `empleados-actions.ts` y `pagos-actions.ts` linea 31). Hay por tanto dos representaciones del puesto desacopladas.
- **`empleados.salario_base numeric`** (no consultado para salario en la vista).
- **`contratos.salario_bruto numeric(10,2) not null`** (linea 147) + `jornada_horas numeric(4,1) not null default 40` (linea 148). Esta es la cifra contractual legal real por empleado.
- **`nominas`** (lineas 179-212): nomina mensual real por empleado. Campos relevantes: `empleado_id`, `contrato_id`, `periodo 'YYYY-MM'`, devengos (`salario_base`, `complementos`, `horas_extra`, `total_devengado`), deducciones, `liquido_percibir`, `seg_social_empresa`, **`coste_total_empresa numeric(10,2)`**, `estado` (Borrador/Revisada/Pagada/Reclamada), `unique (empleado_id, periodo)`. RLS `nom_read` / `nom_manage` (lineas 351-355). **`nominas` NO se consulta desde ningun sitio del frontend.**
- Vista `resumen_personal` (lineas 374-392) ya expone `c.salario_bruto` del contrato vigente por empleado activo.

### 5. Consumidores externos del mock

`grep` de `getSalariosEmpresa` encuentra **2 consumidores**:

1. `SalariosView.tsx` (RRHH, modulo de salarios).
2. **`src/features/mi-panel/components/MisCondicionesView.tsx`** (Mi Panel del empleado). Verificado:
   - Lineas 10, 109-112: importa `getSalariosEmpresa(empresaActual.id)` y resuelve el puesto del usuario con `buscarPuestoUsuario` (lineas 33-47), que hace **match difuso por substring** sobre `nombre + email + roles` contra `puesto`/`departamento`. Fragil.
   - `SalarioCard` (lineas 220-276) muestra al empleado su `nominaNeta`, `efectivoExtra` y `salarioNeto`.
   - `HorarioCard` (lineas 278-340) muestra `horarioSemanal`, `horasSemanales`, `diasLibres`, `jornadaContrato`.
   - `GeneralesCard` (lineas 146-218) deriva vacaciones de `puesto.vacaciones` con `parseDiasVacaciones` (regex), y `fechaAlta`/`tipoContrato` estan hardcodeados ("Pendiente de configurar", "Indefinido").
   - **Impacto:** hacer reales los salarios cambia tambien lo que ve el empleado en Mi Panel; la confidencialidad por rol pasa a ser obligatoria.

### 6. Patron canonico de server action (referencia para las firmas)

Verificado en `src/features/rrhh/actions/empleados-actions.ts` y `pagos-actions.ts`:

- `"use server"` + `import { getAppContext } from "@/lib/supabase/get-context"`.
- `const { supabase, empresaId, userId } = await getAppContext();` — `supabase` es cliente RLS-scoped; `empresaId` es el **UUID** real (se usa como `.eq("empresa_id", empresaId)`).
- Escrituras privilegiadas: `createAdminClient()` desde `@/lib/supabase/admin`.
- Gate de rol: `requireAdminUser({ empresaIds: [...] })` desde `@/features/rrhh/services/empleados-core`.
- `revalidatePath("/rrhh/...")` tras mutar; errores via `friendlyError` (`@/shared/lib/friendly-errors`).
- Return shape consistente: `{ ok: boolean, data?/error? }`.

## Riesgos y decisiones detectadas

- **(D1) Fuente de verdad del salario — 4 sitios con cifras salariales:**
  1. `puestos_trabajo.salario_base` (referencia por puesto, ya en BD, dead).
  2. tabla salarial mock por puesto (`PuestoSalarial`, lo que ve la UI hoy).
  3. `contratos.salario_bruto` (cifra contractual legal por empleado).
  4. `nominas` (liquidacion mensual real + `coste_total_empresa`).
  Riesgo alto de duplicar la verdad. **Recomendacion (ver Full-TASK):** la tabla salarial por puesto es **plantilla/referencia** (extender `puestos_trabajo` o tabla 1:1); la verdad legal por empleado sigue en `contratos`; el coste real ejecutado en `nominas`.
- **(D2) `efectivoExtra` = pago en B (efectivo fuera de nomina):** persistir esto en BD tiene implicaciones legales/fiscales. Requiere confirmacion explicita del negocio antes de almacenarlo. Default propuesto: NO persistir como columna estructurada; si se necesita, dejarlo fuera del coste/hora "oficial".
- **Slug vs UUID:** el mock indexa por slug; la version real debe operar por `empresaActual.dbId` (UUID). Cambio de firma obligatorio (`empresaDbId`).
- **Confidencialidad / RLS por rol:** hoy cualquiera con la vista ve todos los salarios; el empleado solo deberia ver el suyo, y RRHH/Direccion el resto. Las RLS actuales de `puestos_trabajo` son solo por empresa, no por rol — insuficiente para datos salariales.
- **`salarioNeto` incoherente:** hoy es campo libre; deberia derivarse (`nominaNeta + efectivoExtra`) o eliminarse como campo persistido.
- **`MisCondicionesView` ya expone salarios al empleado** con match difuso por nombre; al hacerlo real hay que sustituir el match por el vinculo real empleado->puesto y aplicar RLS del propio empleado.
- **NOTA KEYSTONE:** pagos (OLA2-06), bonus (OLA2-12) y ratios (OLA2-13) necesitan de aqui una fuente de **coste/hora** por puesto/empleado. `pagos-actions.ts` ya lista empleados con `puesto` pero sin cifra de coste. Esta task debe proveer explicitamente un `getCosteHoraPorPuesto` (y/o por empleado).

## Mapa de consumidores (resumen)

| Consumidor | Que usa hoy | Que necesitara |
|---|---|---|
| `SalariosView.tsx` | `getSalariosEmpresa(slug)` (mock) | `getSalariosEmpresa(empresaDbId)` real + CRUD |
| `MisCondicionesView.tsx` (Mi Panel) | `getSalariosEmpresa(slug)` + match difuso | salario del propio empleado via vinculo real + RLS empleado |
| `salarios.io.ts` (`IOActions`) | `fetchAll` -> mock | `fetchAll` real + handlers de escritura |
| OLA2-06 pagos (`pagos-actions.ts`) | lista empleados, `puesto` string, sin coste | `getCosteHoraPorPuesto` / coste por empleado |
| OLA2-12 bonus / OLA2-13 ratios | (pendiente) | coste/hora como input |

## Ruta canonica

`docs/rrhh-consolidacion/ola2-demock/DISCOVERY_OLA2-02-salarios-reales.md`
