# DISCOVERY OLA2-06 - Pagos reales sobre la tabla `nominas`

Fecha: 2026-06-01
Repo: `Balles-Hosteleros`
Plan maestro: `docs/rrhh-consolidacion/ola2-demock/EXECUTION_PLAN_OLA2.md`
Clasificacion: **MIXTO con sesgo a mock** (existe una sola lectura real -identidad del empleado-; todos los importes son efimeros y se pierden al recargar; no hay escritura).
Verificacion: codigo y DDL leidos directamente hoy (no inferido de docs).

## Resumen ejecutivo

Pagos pinta una tabla editable de importes por empleado (pago, nomina, propina, descuento, horas extra, bonus, propina mantenimiento, total) y unos KPIs. El **unico dato real** es la **identidad** del empleado (`listEmpleadosParaPagos`, Supabase). Todo lo demas arranca a 0 (`nuevoPagoVacio`), se edita en `useState` indexado por rango de calendario y **se pierde al recargar la pagina**: no existe ninguna server action de escritura ni `fetchAll` real en el IO.

El hallazgo central es que **la tabla destino ya existe y nadie la usa**: `public.nominas` (migracion `026_rrhh_empleados.sql`) esta creada, con RLS, y no se consulta desde ningun punto del codigo. Esta task NO crea modelo de datos nuevo: **cablea** la UI de pagos a `nominas` (persistencia real por periodo), deriva la base desde la fuente de coste de OLA2-02 y endurece la RLS de un dato sensible.

## Archivos implicados (verificados)

| Archivo | Lineas | Rol | Estado |
| --- | --- | --- | --- |
| `src/features/rrhh/components/pagos/PagosView.tsx` | 434 | Unico componente; tabla editable + KPIs + toolbar + IO | Importes en `useState`, efimeros; sin persistencia |
| `src/features/rrhh/data/pagos.ts` | 56 | Tipos + calculo (`PagoEmpleado`, `ResumenPagos`, `calcularTotalPago`, `getResumenPagos`) | Aritmetica local; KPIs derivados (`prestamos` inventado) |
| `src/features/rrhh/actions/pagos-actions.ts` | 83 | Server action de lectura | Solo `listEmpleadosParaPagos` (identidad real); **sin escritura** |
| `src/features/rrhh/io/pagos.io.ts` | 51 | Import/Export (`ModuleIO`) | `fetchAll` devuelve `[]`; sin upsert; `pagoSchema` zod existe |

## Lo unico real: `listEmpleadosParaPagos`

`pagos-actions.ts` (verificado). Firma real: **no recibe argumentos**; resuelve la empresa server-side via `getAppContext()` (empresa activa del usuario, UUID, no slug).

```ts
export type EmpleadoArea = "administrativa" | "operativa";
export interface EmpleadoPagoRow {
  empleadoId: string;        // empleados.id (uuid)
  empleadoNombre: string;    // nombre + apellidos
  puesto: string | null;
  area: EmpleadoArea;        // derivada de departamentos.area === "OPERATIVA"
}
export async function listEmpleadosParaPagos(): Promise<{ ok: boolean; data: EmpleadoPagoRow[] }>;
```

Detalles relevantes:

- Lee `empleados` con `.or(empresa_id.eq.<UUID>, user_id.in.(<accesos user_empresas>))`, filtra `estado = "Activo"`, deduplica por `user_id` (caso director multiempresa) y deriva `area` de la relacion `departamentos(nombre, area)`.
- **Solo aporta IDENTIDAD.** No trae ninguna cifra economica.
- Importante para el contrato: la consulta usa `empleados.puesto` (columna **texto**) y `departamentos.area`. **Ninguna de las dos esta en la migracion `026`** (alli `empleados` no tiene `puesto` texto ni `puesto_id`->texto, y `departamentos` no tiene `area`). Son columnas anadidas en migraciones posteriores (p.ej. `065_rrhh_empleados.sql` y las de centros/geolocalizacion). Es la prueba directa de que **el schema real ha divergido del DDL del repo** -> regla del proyecto: VERIFICAR SCHEMA REAL via Management API antes de migrar.

## Lo efimero: importes en `useState`

`PagosView.tsx` (verificado):

- `nuevoPagoVacio(empleadoId, empleadoNombre, area)` crea la fila con **todos los importes a 0** y `id` sintetico `` `${empleadoId}-pago` ``.
- Estado: `pagosPorRango: Record<string, PagoEmpleado[]>`, indexado por `rangoKey(range)` (fechas ISO del rango). Al cambiar de empresa se limpia (`setPagosPorRango({})`).
- `cargarEmpleados()` llama a `listEmpleadosParaPagos()` y mapea cada empleado a un `nuevoPagoVacio`. **Nunca lee importes guardados.**
- Edicion: `EditForm` -> `guardarEdicion` recalcula `total = calcularTotalPago(...)` y muta `useState`. `togglePagado` igual. **No hay llamada a ninguna action de escritura.**
- Al recargar la pagina, `pagosPorRango` se reinicia: **toda edicion se pierde**.

Tipo `PagoEmpleado` (cita literal, `data/pagos.ts`):

```ts
export interface PagoEmpleado {
  id: string;
  empleadoId: string;
  empleadoNombre: string;
  area: "administrativa" | "operativa";
  fijo: boolean;
  pago: number;
  nomina: number;
  horasReales: number;
  horasTrabajadas: number;
  propina: number;
  descuento: number;
  horasExtras: number;
  bonus: number;
  propinaMantenimiento: number;
  total: number;
  pagado: boolean;
}
```

Calculo (verificado):

```ts
calcularTotalPago(p) = p.pago + p.nomina + p.propina + p.horasExtras + p.bonus + p.propinaMantenimiento - p.descuento;
```

`getResumenPagos` deriva los KPIs. Dos son **placeholders sin respaldo real**:

- `prestamos = Math.round(totalDescuentos * 0.4)` -> **factor 0.4 inventado**; no hay tabla de prestamos.
- `efectivoAhorro = totalFinal - totalNomina` -> heuristica, no un saldo real de caja.

Ambos deben volverse honestos (calculo real o placeholder etiquetado) al cablear.

## La tabla destino que nadie usa: `public.nominas`

DDL real verificado en `supabase/migrations/026_rrhh_empleados.sql` (lin. 179-226). **La tabla existe, tiene RLS, y no se consulta desde ningun punto del codigo** (`grep` de `"nominas"` solo aparece en el DDL). Es el destino natural de pagos.

```sql
create table if not exists public.nominas (
  id              uuid primary key default gen_random_uuid(),
  empresa_id      uuid not null references public.empresas(id) on delete cascade,
  empleado_id     uuid not null references public.empleados(id) on delete cascade,
  contrato_id     uuid references public.contratos(id) on delete set null,
  periodo         text not null,           -- 'YYYY-MM'
  fecha_pago      date,
  -- Devengos
  salario_base    numeric(10,2) not null default 0,
  complementos    numeric(10,2) not null default 0,
  horas_extra     numeric(10,2) not null default 0,
  otros_devengos  numeric(10,2) not null default 0,
  total_devengado numeric(10,2) not null default 0,
  -- Deducciones
  seg_social_empleado numeric(10,2) not null default 0,
  irpf_pct        numeric(4,2) not null default 0,
  irpf_importe    numeric(10,2) not null default 0,
  otras_deducciones numeric(10,2) not null default 0,
  total_deducciones numeric(10,2) not null default 0,
  -- Neto
  liquido_percibir numeric(10,2) not null default 0,
  -- Coste empresa
  seg_social_empresa numeric(10,2) not null default 0,
  coste_total_empresa numeric(10,2) not null default 0,
  -- Estado
  estado          text not null default 'Borrador'
                    check (estado in ('Borrador','Revisada','Pagada','Reclamada')),
  documento_url   text,
  notas           text,
  created_by      uuid references auth.users(id) on delete set null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (empleado_id, periodo)
);
```

RLS real (lin. 350-355) — **solo por empresa, SIN gating por rol**:

```sql
create policy "nom_read" on public.nominas for select to authenticated
  using (empresa_id in (select p.empresa_id from profiles p where p.user_id = auth.uid()));
create policy "nom_manage" on public.nominas for all to authenticated
  using (empresa_id in (select p.empresa_id from profiles p where p.user_id = auth.uid()))
  with check (empresa_id in (select p.empresa_id from profiles p where p.user_id = auth.uid()));
```

Consecuencia: **cualquier usuario autenticado de la empresa lee/escribe nominas de todos** (datos salariales sensibles). Hay que anadir gating por rol (RRHH/Direccion), en linea con la decision de confidencialidad de OLA2-02.

`contratos` (misma migracion, lin. 139-159) aporta la **verdad legal** por empleado: `salario_bruto numeric(10,2) not null`, `jornada_horas numeric(4,1) default 40`, `estado in ('Vigente',...)`. Es la fuente preferente para prefijar `salario_base` mensual cuando no hay nomina previa.

> ADVERTENCIA: este DDL es la migracion versionada. El schema productivo puede diferir (de hecho, ya se confirmo divergencia en `empleados`/`departamentos`). VERIFICAR con Management API que `nominas`/`contratos` existen con estas columnas y RLS antes de aplicar cualquier ALTER.

## Mapeo conceptual `PagoEmpleado` (UI) <-> `nominas` (BD)

El modelo de la UI y el de la tabla NO coinciden 1:1: la UI piensa en "propinas" y "pago", la tabla piensa en devengos/deducciones/coste-empresa. Mapeo propuesto (a fijar en el contrato):

| UI `PagoEmpleado` | `nominas` | Nota |
| --- | --- | --- |
| `empleadoId` | `empleado_id` | uuid real (identidad ya disponible) |
| `pago` | `salario_base` | base mensual; prefill desde contrato/OLA2-02 |
| `nomina` | (deriva de `total_devengado`/`liquido_percibir`) | reconciliar semantica (bruto vs neto) |
| `horasExtras` | `horas_extra` | importe, no numero de horas |
| `bonus` + `propinaMantenimiento` | `complementos` u `otros_devengos` | decidir bucket |
| `propina` | `otros_devengos` (o columna nueva) | propinas no estan tipadas en `nominas` |
| `descuento` | `otras_deducciones` | |
| `total` | `total_devengado` / `liquido_percibir` | derivado, no editable directo |
| `pagado` (bool) | `estado = 'Pagada'` | mapear bool<->enum |
| `horasReales` / `horasTrabajadas` | (no en `nominas`) | provienen de `fichajes` (opcional) |

Disonancias a resolver:

- `nominas` no tiene columna de **propinas** ni de **propina de mantenimiento**: decidir si van a `otros_devengos`/`complementos` o si se anaden columnas (decision de modelado, evitar inflar el schema sin necesidad).
- `pagado` booleano vs `estado` de 4 valores (`Borrador|Revisada|Pagada|Reclamada`): la UI actual solo distingue pagado/no pagado; conviene exponer el ciclo de estado real.
- `id` sintetico `<empId>-pago` **colisiona** con el uuid real de `nominas`. Al persistir hay que usar el uuid real (o resolver por `unique(empleado_id, periodo)` con upsert), no el id sintetico.

## Eje temporal: mensual (BD) vs 4 granularidades (UI)

- `nominas.periodo` es **mensual** (`'YYYY-MM'`, con `unique(empleado_id, periodo)`).
- `PagosView` ofrece **MENSUAL / TRIMESTRAL / SEMESTRAL / ANUAL** (`MODES_PAGOS`, lin. 37) y cachea por rango ISO.
- Hay que **reconciliar**: o se restringe la persistencia a meses y los rangos mayores **agregan N filas mensuales** (lectura agregada, escritura mes a mes), o se anade granularidad. Recomendacion: persistir SIEMPRE por mes (verdad legal) y, para trimestre/semestre/ano, **sumar los meses** del rango en lectura. Escribir un trimestre no tiene fila propia: se reparte o se exige mes.

## Relacion con OLA2-02 (salarios) — fuente de la base

OLA2-02 (ya redactada) expone la fuente canonica de coste y una **jerarquia de verdad** que PAGOS debe **consumir, no recalcular**:

- `getCosteHoraPorEmpleado(empresaDbId)` -> `{ ok, data: Array<CosteHoraPuesto & { empleadoId }> }`, con `costeHoraEmpresa`, `costeHoraNeto` y `fuente: 'nomina' | 'contrato' | 'plantilla'`.
- Jerarquia: **plantilla por puesto** (`puestos_trabajo`/`puestos_salario`) -> **`contratos.salario_bruto`** (verdad legal por empleado) -> **`nominas.coste_total_empresa`** (coste ejecutado, preferente cuando existe).

Consumo correcto en PAGOS:

- **Prefill de la base mensual** (`salario_base`, y derivacion de `pago`/`nomina`): tomar de la jerarquia de OLA2-02 (preferente `contratos.salario_bruto`/12 para el bruto mensual legal). NO re-derivar cifras salariales por cuenta propia.
- **Importe de horas extra**: si se calculan, usar `getCosteHoraPorEmpleado(...).costeHoraEmpresa` por las horas extra del periodo. La UI hoy guarda `horasExtras` como **importe**; si se quiere "horas x coste/hora" hay que aclararlo.
- Esto arrastra la **decision D1** (fuente de verdad del salario), compartida con OLA2-02/12/13: PAGOS hereda la jerarquia, no abre una quinta fuente.

## Horas reales: `fichajes` (opcional)

`horasReales`/`horasTrabajadas` hoy son 0 y no se rellenan. Existe `src/features/rrhh/actions/fichajes-actions.ts` con `listFichajesEmpleado(...)` y `listFichajes(fecha?)` (verificado). Opcionalmente, las horas del periodo pueden derivarse de fichajes para informar horas extra/desviacion. Es **scope opcional** (fase tardia), no bloqueante del cableado base.

## IO de import/export

`pagos.io.ts` (verificado): `fetchAll` devuelve `[]` (export vacio); no hay handler de import/upsert (el import esta deshabilitado de facto). Existe `pagoSchema` zod con el shape de `PagoEmpleado`. Al cablear, `fetchAll` deberia leer de `nominas` (mapeado) y, si entra en corte, el import delegar en el upsert real; o desactivarlo explicitamente.

## Slug vs UUID de empresa

- `empresaActual.id` = slug (`"habana"`, `"bacanal"`); `empresaActual.dbId` = uuid real (`empresa-context.tsx`).
- La action de lectura actual (`listEmpleadosParaPagos`) NO recibe argumentos: resuelve el UUID server-side via `getAppContext()`. Correcto.
- Las nuevas actions deben operar con el **UUID** (sea recibido como `empresaDbId` por coherencia con la firma de OLA2-02, o resuelto via `getAppContext`). Nunca filtrar por slug.
- OJO: en `PagosView` el `IOActions` recibe `context={{ empresaId: empresaActual.id }}` = **slug**; ese es el canal de import/export, separado de las actions. Si el IO pasa a leer real, su `fetchAll` debe resolver el UUID (no usar el slug).

## Conclusion

Pagos NO es "construir desde cero": la tabla (`nominas`), la identidad del empleado (`listEmpleadosParaPagos`) y la fuente de coste (OLA2-02) ya existen o estaran listas. Es un **cableado** en ~5-6 fases: (1) server actions read/upsert/cambiar-estado sobre `nominas`; (2) persistir las ediciones de la UI (sustituir `useState` efimero); (3) prefijar la base desde la jerarquia de OLA2-02 (no recalcular); (4) reconciliar el eje temporal mensual vs 4 granularidades; (5) endurecer la RLS con gating por rol (dato sensible); (6) opcional, horas reales desde `fichajes`. Decisiones abiertas: D1 (fuente de verdad heredada de OLA2-02), eje temporal y gating por rol.

Contrato ejecutable: `docs/rrhh-consolidacion/ola2-demock/Full-TASK-OLA2-06-pagos-sobre-nominas.md`.
