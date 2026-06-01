# Discovery OLA2-01 - Empleados reales como fuente unica
Fecha: 2026-06-01
Metodo: barrido de codigo (rutas WSL) verificado contra migraciones.

## Resumen

`src/features/rrhh/data/rrhh.ts` (69 lineas) es el cordon umbilical mock que provee
`Empleado[]` a media docena de submodulos. Ya existe la fuente real (`empleados` +
`departamentos`), ya hay un patron canonico de lectura real (`listEmpleadosParaPagos`)
y ya hay un precedente de selector real (`EmpleadoSelector` en comunicados-actions).
La task consiste en centralizar UNA action canonica de lectura de empleados activos,
migrar los consumidores del mock a ella y vaciar `data/rrhh.ts` de datos (dejando solo
constantes/labels si siguen usandose).

## Inventario de archivos

| Archivo | Lineas | Rol |
| --- | --- | --- |
| `src/features/rrhh/data/rrhh.ts` | 69 | MOCK. Tipo `Empleado` (vista operativa), `DEPARTAMENTOS`, `ESTADOS_LABEL`, `ESTADOS_COLOR`, arrays `HABANA_EMPLEADOS`/`BACANAL_EMPLEADOS`, `getEmpleadosPorEmpresa(empresaId)`. Indexado por SLUG. |
| `src/features/rrhh/data/empleados-ficha.ts` | 190 | MOCK (ficha ampliada). NO objeto de esta task -> OLA2-09. Coexiste. |
| `src/features/rrhh/actions/empleados-actions.ts` | 713 | REAL. `listEmpleados`, `createEmpleado`, `updateEmpleado`, `setEmpleadoEstado`, `getEmpleadoConPerfil`, `getMiInformacionLaboral`, `listDepartamentos`, etc. Lecturas/escrituras reales sobre `empleados`. |
| `src/features/rrhh/actions/pagos-actions.ts` | 83 | REAL. `listEmpleadosParaPagos()` -> **patron canonico** a replicar/ampliar. |
| `src/features/rrhh/io/empleados.io.ts` | 52 | Consumidor mock: `fetchAll` llama `getEmpleadosPorEmpresa(ctx.empresaId)`. Define schema Zod sobre la forma mock. |
| `src/features/gerencia/actions/comunicados-actions.ts` | 41-72 | REAL. `EmpleadoSelector` + `listEmpleadosParaComunicado()` (lee `profiles`). **Precedente** de selector real ya en uso. |

## Tipo `Empleado` mock (vista operativa)

```ts
export type EstadoEmpleado = "trabajando" | "fuera" | "descanso" | "ausente" | "vacaciones";

export interface Empleado {
  id: string;            // "h1".."h10", "b1".."b8" (NO uuid)
  nombre: string;
  apellidos: string;
  avatar?: string;       // nunca poblado en el mock
  estado: EstadoEmpleado;
  horarioTipo: string;   // "05h", "DJ", "Sin horario"
  horarioSemanal: string;// "29h semana"
  horasHoy: string;      // "4h 32min"
  departamento: string;  // "CACHIMBEROS", "JEFE DE SALA", ...
  telefono: string;
  fichajes: number;
  emailEmpresa: string;
  emailPersonal: string;
  validadorFichajes: string;
}

export function getEmpleadosPorEmpresa(empresaId: string): Empleado[] {
  if (empresaId === "habana") return HABANA_EMPLEADOS;  // 10 filas
  if (empresaId === "bacanal") return BACANAL_EMPLEADOS; // 8 filas
  return [];
}
```

Nota clave: el `Empleado.estado` mock es **operativo en tiempo real** (trabajando/fuera/...),
no el ciclo de vida laboral. La tabla real `empleados.estado` es el **ciclo de vida**
(`Activo`/`Baja temporal`/`Baja definitiva`/`Excedencia`). NO son la misma dimension:
ningun consumidor mock necesita el estado operativo real-time excepto el calendario, que
lo usa solo para pintar un punto de color decorativo. Ver gaps.

## Consumidores de `data/rrhh` (grep verificado)

`grep -rln 'data/rrhh' src` (excluyendo el propio `data/rrhh.ts`) devuelve 8 archivos.
Desglose por simbolo importado:

### A) Consumen `getEmpleadosPorEmpresa` (datos mock — HAY QUE MIGRAR)

| # | Archivo | Linea import | Forma usada | Naturaleza | empresaId que pasa |
| --- | --- | --- | --- | --- | --- |
| 1 | `src/features/rrhh/components/calendarios/CalendarioLaboral.tsx` | 3 | `{id, departamento, estado}` (estado -> punto de color decorativo) | client | recibe `empresaId` por prop desde `CalendariosRRHHView` (= `empresaActual.id`, SLUG) |
| 2 | `src/features/rrhh/components/boarding/BoardingView.tsx` | 5 | `{nombre, apellidos}` (iniciales/select) | client | `empresaActual.id` (SLUG) |
| 3 | `src/features/rrhh/components/formacion/FormacionView.tsx` | 32 | `{departamento}` para mapear `DEPARTAMENTO_A_PUESTO`, `.length` | client | `empresaActual.id` (SLUG) |
| 4 | `src/features/cocina/components/partidas/PartidasView.tsx` | 9 | `{id, nombre, apellidos}` (nombre del creador de partida) | client | `empresaActual?.id || "habana"` (SLUG) |
| 5 | `src/features/gerencia/components/EncuestasView.tsx` | 5 | `{id, nombre, apellidos, departamento}` (avatares, selector destinatarios, conteo) | client | `empresaActual.id` (SLUG) |
| 6 | `src/features/gerencia/components/ComunicadosView.tsx` | 6 | `{id, nombre, apellidos}` via `ReturnType<typeof getEmpleadosPorEmpresa>` (conteo + selector legacy) | client | `empresaActual.id` (SLUG) |
| 7 | `src/features/rrhh/io/empleados.io.ts` | 4-6 | `Empleado[]` completo (export/import IO) | server-ish (`fetchAll(ctx)`) | `ctx.empresaId` |

### B) Consumen solo CONSTANTES (`DEPARTAMENTOS` / `ESTADOS_*` / tipo) — NO requieren datos

| # | Archivo | Linea | Simbolo |
| --- | --- | --- | --- |
| 8 | `src/features/gerencia/components/EncuestasView.tsx` | 5 | `DEPARTAMENTOS` (mismo import que A.5) |
| 8 | `src/features/gerencia/components/ComunicadosView.tsx` | 6 | `DEPARTAMENTOS` (mismo import que A.6) |

Observacion: `DEPARTAMENTOS` (constante) tambien se importa en Bonus (`BonusView.tsx:12`)
y Reclutamiento (`RolFormModal.tsx`) — pero esos importan **solo la constante**, no
`getEmpleadosPorEmpresa`. Hay ademas multiples `DEPARTAMENTOS` clonados en otros modulos
(`accesos-apps.ts`, `roles-empresa.ts`, `salarios.ts`) que NO vienen de `data/rrhh` y NO
son objeto de esta task (la unificacion de departamentos/roles es OLA2-10).

`ESTADOS_LABEL`/`ESTADOS_COLOR` del mock **no se consumen fuera de `data/rrhh.ts`**: la UI
real de empleados usa su propio `empleado-ui.ts` (`ESTADOS_LABEL`/`ESTADOS_COLOR` para el
ciclo de vida Activo/Baja). Es decir, los labels mock son codigo muerto salvo el propio
`data/rrhh.ts`.

### Precedente: selectores reales que YA coexisten con el mock

- `ComunicadosView` y `EncuestasView` ya cargan **ademas** un selector real:
  `listEmpleadosParaComunicado()` -> `EmpleadoSelector[]` (lee `profiles`, no `empleados`).
  El mock convive como `empleados` (conteo/avatares) y el real como `empleadosReales`.
  -> La migracion de estas dos vistas es sobre todo **eliminar el mock** y unificar al real.

## Firma real de referencia: `listEmpleadosParaPagos`

`src/features/rrhh/actions/pagos-actions.ts`:

```ts
export type EmpleadoArea = "administrativa" | "operativa";

export interface EmpleadoPagoRow {
  empleadoId: string;        // empleados.id (uuid real)
  empleadoNombre: string;    // `${nombre} ${apellidos}`.trim()
  puesto: string | null;     // empleados.puesto
  area: EmpleadoArea;        // derivada de departamentos.area === "OPERATIVA"
}

export async function listEmpleadosParaPagos(): Promise<{ ok: boolean; data: EmpleadoPagoRow[] }>
```

Mecanica clave que se reutiliza:
1. `getAppContext()` -> `{ supabase, empresaId }` (empresaId = uuid de la empresa activa, resuelto server-side; NO se pasa por parametro).
2. Filtro OR doble: `empresa_id.eq.${empresaId}` (ficha principal) + `user_id.in.(...)` (acceso secundario via `user_empresas`).
3. `.eq("estado", "Activo")` para activos.
4. `select("id, nombre, apellidos, puesto, estado, user_id, empresa_id, departamentos(nombre, area)")`.
5. **Dedup por `user_id`** (director multiempresa aparece 2 veces por el OR; prioriza la ficha cuya `empresa_id` = empresa activa).
6. Derivacion de area: `deptoObj?.area === "OPERATIVA" ? "operativa" : "administrativa"`.
7. Orden por `nombre` con `localeCompare(..., "es")`.

## Schema real verificado (migraciones)

- `public.empleados` (026_rrhh_empleados.sql, ampliada en 065): `id uuid pk`, `empresa_id uuid NOT NULL`, `profile_id uuid`, `departamento_id uuid`, `puesto_id uuid`, `user_id uuid` (NOT NULL desde 072), `local_id`, `nombre text NOT NULL`, `apellidos text`, `puesto text`, `estado text NOT NULL default 'Activo' check in ('Activo','Baja temporal','Baja definitiva','Excedencia')` (068), `avatar_url text`, emails/telefono/dni, etc.
- `public.departamentos` (026, ampliada en 062/086): `id uuid pk`, `empresa_id uuid NOT NULL`, `nombre text`, `area text NOT NULL` con valores `OPERATIVA`/`ADMINISTRATIVA` (086, backfill + NOT NULL), `unique(empresa_id, nombre)`.
- `public.user_empresas`: relacion user<->empresa (acceso multiempresa). Usada en los filtros OR.

VERIFICAR-SCHEMA-REAL (Management API) antes de implementar:
- Confirmar que en PROD `empleados.avatar_url` existe y esta poblado (puede estar siempre NULL).
- Confirmar que `departamentos.area` esta backfilled en PROD para HABANA y BACANAL (la 086 corrio el backfill; verificar que no quedo NULL en filas creadas a mano).
- Confirmar valores reales de `empleados.estado` en PROD (si hay `Excedencia` en uso).

## Gaps identificados

1. **Slug vs UUID (transversal):** los 6 consumidores client pasan `empresaActual.id` (slug). La fuente real filtra por `empresa_id uuid`. `listEmpleadosParaPagos` lo evita resolviendo la empresa server-side via `getAppContext()` (no recibe parametro). Decision de diseno: la action canonica NO debe depender del slug. Dos opciones (ver Full-TASK): (a) sin parametro, resuelve empresa activa server-side como pagos; (b) con parametro `empresaDbId` = `empresaActual.dbId`. Recomendado (a) por consistencia con el patron ya probado y para no propagar el slug.
2. **estado operativo vs ciclo de vida:** la tabla real no tiene el estado operativo en tiempo real (trabajando/fuera/descanso). El unico consumidor que lo usa (CalendarioLaboral) lo pinta como punto de color decorativo. La action devolvera el ciclo de vida (`Activo`/...) o un estado operativo derivado/placeholder; el calendario debe degradar ese adorno (p.ej. todos "Activo") sin romper. NO se inventa estado operativo real (eso seria fichajes/horarios -> OLA2-14).
3. **avatar:** el mock nunca lo poblo; `empleados.avatar_url` puede ser NULL. La action lo expone como `avatarUrl: string | null` y la UI usa iniciales como fallback (ya lo hace).
4. **componentes client:** ninguno puede llamar la action en render sincrono. Hay que cargar via `useEffect`/estado (como ya hacen Comunicados/Encuestas con su selector real) o elevar la carga a un server component padre y pasar por props.
5. **IO export/import (`empleados.io.ts`):** su `fetchAll` devuelve la forma mock completa (telefono, fichajes, horario...) que la action canonica reducida NO cubre. Decidir si la exportacion de empleados se mantiene (mapeando desde la action real ampliada) o se recorta su schema a los campos reales. La importacion de empleados ya tiene flujo real (`createEmpleado`); el IO mock de empleados es de bajo valor. Tratar como sub-decision (no bloqueante para retirar los datos mock).
6. **`DEPARTAMENTOS` constante:** sigue usandose (Encuestas, Comunicados, Bonus, Reclutamiento). Se conserva en `data/rrhh.ts` como constante (sin datos de empleados) o se migra a `listDepartamentos()` real. Para esta task: conservar la constante; la unificacion real de departamentos es OLA2-10.

## Conclusion

Retirar los **datos** mock de empleados es viable sin tabla nueva: la action canonica es
una generalizacion directa de `listEmpleadosParaPagos`. El trabajo real esta en (a) definir
un shape de retorno que cubra a los 6 consumidores, (b) migrar 6 componentes client + el IO,
(c) resolver el adorno de estado operativo del calendario, y (d) vaciar `data/rrhh.ts`
dejando solo `DEPARTAMENTOS` si se decide conservarla.
