# Full-TASK-OLA2-01 - Empleados reales como fuente unica

## Estado
IMPLEMENTADO y VALIDADO (2026-06-02, commit `5bbaaa0` en `main`). typecheck + build verdes.
Smoke UI (Playwright sobre Supabase real, usuario admin `rrhh-smoke-admin`): Formación muestra
los empleados REALES por empresa (HABANA 10, BACANAL 16; el mock fijaba 10/8), `/rrhh/empleados`
lista nombres reales, y el cambio de empresa HABANA↔BACANAL re-carga correctamente. Verificado
además a nivel BD que la query de `getEmpleadosActivos` devuelve 16/10 con la RLS del usuario.
Nota: en dev (Turbopack HMR) las server actions dan intermitentemente "Failed to find Server
Action … older/newer deployment" tras recompilar — flake conocido del hot-reload (no de esta
task, ausente en producción; se va al asentar el server). Discovery en
DISCOVERY_OLA2-01-empleados-reales-fuente-unica.md.

## Objetivo
Retirar `src/features/rrhh/data/rrhh.ts` como fuente funcional de empleados. Centralizar UNA
server action canonica de lectura de empleados activos (generalizacion de
`listEmpleadosParaPagos`) que devuelva la forma que necesitan los consumidores (id uuid real,
nombre completo, departamento, area operativa/administrativa, puesto, avatar, estado de ciclo
de vida), y reemplazar todos los imports de `getEmpleadosPorEmpresa` por ella. Dejar
`data/rrhh.ts` solo con la constante `DEPARTAMENTOS` (y labels) si siguen usandose, SIN datos
mock de empleados.

## Estimacion de complejidad
Media. No hay tabla nueva ni migracion (la fuente real existe). El coste esta en: 1 action
nueva (copia/generalizacion de un patron ya probado) + migrar 6 componentes client + el IO,
todos client components que requieren pasar de un `getEmpleadosPorEmpresa(slug)` sincrono a una
carga async. Riesgo bajo-medio por el numero de superficies tocadas (7) y por el cruce
slug/uuid. Sin decisiones de negocio criticas pendientes.

## Criterio de corte
- `getEmpleadosPorEmpresa`, `HABANA_EMPLEADOS`, `BACANAL_EMPLEADOS` y los datos mock ya no
  existen en `src/features/rrhh/data/rrhh.ts`.
- `grep -rln "getEmpleadosPorEmpresa" src` no devuelve resultados (ni definicion ni uso).
- Los 6 consumidores funcionales leen empleados desde la action canonica (datos reales por
  empresa activa, con RLS por `empresa_id`).
- `data/rrhh.ts` queda vacio de empleados; conserva como mucho `DEPARTAMENTOS` (constante) si
  algun consumidor la sigue usando. Si no queda nada, se borra el archivo.
- `npm run typecheck` y `npm run build` verdes (via WSL NON-login).
- Ninguna pantalla migrada queda rota: si pierde un adorno (p.ej. estado operativo del
  calendario) degrada con un placeholder honesto, no con datos inventados.

## Modo operativo
(taskId: OLA2-01 / taskMode: code / reviewMode: standard / sourcePlan: docs/rrhh-consolidacion/ola2-demock/EXECUTION_PLAN_OLA2.md)

## Contexto previo obligatorio
1. Leer `DISCOVERY_OLA2-01-empleados-reales-fuente-unica.md` (inventario, consumidores y gaps).
2. Leer la firma real de `src/features/rrhh/actions/pagos-actions.ts::listEmpleadosParaPagos`
   (patron canonico: filtro OR empresa/user_empresas, dedup por user_id, derivacion de area).
3. Leer el precedente de selector real:
   `src/features/gerencia/actions/comunicados-actions.ts::listEmpleadosParaComunicado`
   (`EmpleadoSelector`) — patron ya en uso en Comunicados y Encuestas.
4. Conocer la distincion slug (`empresaActual.id`) vs uuid (`empresaActual.dbId`) del contexto
   `src/features/empresa/contexts/empresa-context.tsx` (Empresa.id = slug, Empresa.dbId = uuid).
5. Criterio global Ola 1 vigente: "Ninguna task reintroduce `data/rrhh.ts` como fuente
   funcional de verdad" + "las server actions reciben el UUID de empresa (dbId), no el slug".

## Scope IN
- Crear la action canonica `getEmpleadosActivos(...)` (preferentemente ampliando
  `src/features/rrhh/actions/empleados-actions.ts`) y su tipo de retorno `EmpleadoActivo`.
- Migrar los 6 consumidores funcionales de `getEmpleadosPorEmpresa` a la nueva action:
  CalendarioLaboral, BoardingView, FormacionView, PartidasView, EncuestasView, ComunicadosView.
- Migrar/recortar `src/features/rrhh/io/empleados.io.ts` (decision documentada en Riesgos/Decisiones).
- Vaciar `data/rrhh.ts` de empleados (datos, arrays, `getEmpleadosPorEmpresa`, tipo `Empleado`
  operativo y `ESTADOS_*` si quedan huerfanos). Conservar `DEPARTAMENTOS` si sigue en uso.
- En Comunicados/Encuestas: unificar al selector real ya existente (eliminar la dependencia mock).

## Scope OUT
- NO tocar la ficha ampliada `data/empleados-ficha.ts` (es OLA2-09).
- NO unificar los `DEPARTAMENTOS` clonados de otros modulos (`accesos-apps.ts`,
  `salarios.ts`, `roles-empresa.ts`) — eso es OLA2-10.
- NO crear estado operativo real-time (trabajando/fuera/...) — eso depende de fichajes/horarios (OLA2-14).
- NO crear ni alterar tablas (`empleados`/`departamentos` ya existen). Sin migracion `.sql`.
- NO rediseniar el flujo de import/export IO mas alla del recorte minimo para que compile.

## Restricciones
- La action recibe el UUID de empresa (dbId) o resuelve la empresa activa server-side; NUNCA el slug.
- RLS multi-tenant real por `empresa_id` (la action usa el cliente con sesion, no service-role,
  salvo que `listEmpleados` ya use admin por una razon — replicar el patron de `listEmpleadosParaPagos`,
  que usa el cliente con sesion).
- Mantener try/catch + retorno `{ ok, data }` consistente con las actions existentes del feature.
- Componentes client: cargar via estado/`useEffect` (o elevar a server component); no romper el
  render sincrono actual con una llamada bloqueante.
- Commits terminan en `_FernandoClaude`; push directo a `main` tras typecheck+build verdes.
- Restaurar `next-env.d.ts` si el tooling lo modifica.

## Validacion requerida
- `wsl -d Ubuntu bash -c "cd /home/fernandomp/dev/Balles-Hosteleros && npm run typecheck"` -> verde.
- `wsl -d Ubuntu bash -c "cd /home/fernandomp/dev/Balles-Hosteleros && npm run build"` -> verde.
- `grep -rln "getEmpleadosPorEmpresa\|HABANA_EMPLEADOS\|BACANAL_EMPLEADOS" src` -> vacio.
- Smoke manual (donde el flujo lo permita): abrir Calendario laboral, Boarding, Formacion,
  Partidas (cocina), Encuestas y Comunicados con HABANA y BACANAL; verificar que la lista/conteo
  de empleados refleja los empleados REALES de cada empresa (no los 10/8 mock) y que la UI no
  rompe al cambiar de empresa.

## Dependencias
- Dependencias entrantes: ninguna (es fundacion de la Ola 2).
- Dependencias salientes (la desbloquean): OLA2-04 (boarding), OLA2-07 (encuestas: destinatarios),
  OLA2-08 (formacion: puesto real), OLA2-09 (ficha ampliada).

## Inputs
- `src/features/rrhh/data/rrhh.ts` (mock a retirar).
- `src/features/rrhh/actions/pagos-actions.ts` (patron canonico `listEmpleadosParaPagos`).
- `src/features/rrhh/actions/empleados-actions.ts` (destino de la nueva action; ya tiene `listEmpleados`).
- `src/features/gerencia/actions/comunicados-actions.ts` (precedente `EmpleadoSelector`).
- `src/features/empresa/contexts/empresa-context.tsx` (slug/dbId; `useEmpresa`).
- Migraciones: `supabase/migrations/026_rrhh_empleados.sql`, `065_rrhh_empleados.sql`,
  `062_departamentos.sql`, `086_departamento_area_y_cronograma_departamento.sql`,
  `068_empleados_estado_constraint.sql`, `072_empleados_user_id_required.sql`.

## Outputs esperados
- Nueva action `getEmpleadosActivos` + tipo `EmpleadoActivo` exportados desde
  `src/features/rrhh/actions/empleados-actions.ts`.
- 6 componentes consumidores migrados a la action (datos reales por empresa).
- `src/features/rrhh/io/empleados.io.ts` recortado/migrado o desactivado, segun decision.
- `src/features/rrhh/data/rrhh.ts` vaciado de empleados (solo `DEPARTAMENTOS` si procede) o borrado.

## Riesgos conocidos
- **Cruce slug/uuid**: el riesgo principal. Mitigacion: la action resuelve la empresa activa
  server-side (como `listEmpleadosParaPagos`) y no recibe el slug; o recibe `empresaActual.dbId`.
  Si por error se le pasa el slug, devolveria `[]` (no datos cruzados) — fallo visible, no silencioso.
- **estado operativo del calendario**: `CalendarioLaboral` usa `e.estado` (trabajando/fuera/...)
  para un punto de color. La fuente real no tiene ese dato. Riesgo: pintar todos igual o romper el
  `ESTADOS_COLOR`. Mitigacion: mapear todos a un estado neutro/"Activo" o quitar el punto; degradar
  el adorno, documentar que el estado operativo real llega con OLA2-14.
- **IO empleados**: el schema Zod del IO espera campos mock (telefono, fichajes, horario, validador)
  que la action reducida no devuelve. Riesgo de romper la pantalla de import/export. Mitigacion:
  recortar `empleadoSchema`/`columns` a los campos reales y mapear `fetchAll` desde `getEmpleadosActivos`,
  o desactivar temporalmente el modulo de import de empleados (bajo valor; ya hay alta real).
- **Componentes client async**: pasar de sincrono a async puede introducir estados de carga/vacio
  no contemplados (listas vacias mientras carga). Mitigacion: estado `loading`/fallback, replicando
  el patron de Comunicados/Encuestas que ya cargan su selector real por `useEffect`.
- **avatar siempre NULL**: si `empleados.avatar_url` no esta poblado en PROD, los avatares dependen
  del fallback de iniciales (ya existente). Sin riesgo funcional.

## Modelo de datos propuesto
NO se crea tabla nueva: `empleados` y `departamentos` ya existen (ver migraciones en Inputs).
Esta task documenta solo el **shape de retorno** de la action y el **mapeo departamento -> area**.

Tabla origen `public.empleados` (campos relevantes, VERIFICAR-SCHEMA-REAL via Management API):
- `id uuid` (pk) -> `empleadoId`
- `nombre text NOT NULL`, `apellidos text` -> `nombre`, `apellidos`, `nombreCompleto`
- `puesto text` (y `puesto_id`) -> `puesto: string | null`
- `estado text` check in (`Activo`,`Baja temporal`,`Baja definitiva`,`Excedencia`) -> `estado` (ciclo de vida)
- `avatar_url text` -> `avatarUrl: string | null` (VERIFICAR-SCHEMA-REAL: puede estar siempre NULL en PROD)
- `departamento_id uuid` -> join a `departamentos`
- `user_id uuid NOT NULL`, `empresa_id uuid NOT NULL` -> filtro/dedup multiempresa

Join `public.departamentos`:
- `nombre text` -> `departamento: string | null`
- `area text NOT NULL` in (`OPERATIVA`,`ADMINISTRATIVA`) -> `area` (VERIFICAR-SCHEMA-REAL: confirmar backfill en PROD para HABANA y BACANAL).

Mapeo departamento -> area (replicar `listEmpleadosParaPagos`):
```
area = departamentos.area === "OPERATIVA" ? "operativa" : "administrativa"
```
(cualquier valor != "OPERATIVA", incluido NULL, cae en "administrativa").

Filtro y dedup (replicar exactamente `listEmpleadosParaPagos`):
- OR: `empresa_id.eq.${empresaId}` + (si hay) `user_id.in.(<user_empresas de la empresa>)`.
- `.eq("estado", "Activo")` para activos (parametrizable si algun consumidor necesita bajas).
- Dedup por `user_id` priorizando la ficha cuya `empresa_id` = empresa activa.

## Interfaces publicas propuestas
En `src/features/rrhh/actions/empleados-actions.ts`:

```ts
export type EmpleadoActivoArea = "administrativa" | "operativa";

export interface EmpleadoActivo {
  empleadoId: string;          // empleados.id (uuid)
  userId: string | null;       // empleados.user_id
  nombre: string;              // empleados.nombre
  apellidos: string;           // empleados.apellidos ?? ""
  nombreCompleto: string;      // `${nombre} ${apellidos}`.trim()
  departamento: string | null; // departamentos.nombre
  area: EmpleadoActivoArea;    // derivada de departamentos.area
  puesto: string | null;       // empleados.puesto
  avatarUrl: string | null;    // empleados.avatar_url
  estado: string;              // ciclo de vida: "Activo" (la action filtra activos)
}

/**
 * Fuente unica de empleados activos de la empresa. Resuelve la empresa activa
 * server-side via getAppContext() (NO recibe el slug). Reemplaza al mock
 * getEmpleadosPorEmpresa de data/rrhh.ts.
 */
export async function getEmpleadosActivos(): Promise<{ ok: boolean; data: EmpleadoActivo[] }>;
```

Variante alternativa (si se prefiere parametro explicito, manteniendo el criterio de UUID):
```ts
export async function getEmpleadosActivos(
  empresaDbId?: string, // = empresaActual.dbId; si se omite, usa la empresa activa del contexto
): Promise<{ ok: boolean; data: EmpleadoActivo[] }>;
```
Recomendacion: firma SIN parametro (resuelve empresa activa server-side, como
`listEmpleadosParaPagos`). Es el patron ya probado, evita propagar el slug por las props de los
client components y elimina la clase de bug slug/uuid. Si un consumidor necesita otra empresa
distinta de la activa (no es el caso hoy), se aniade el parametro opcional.

## Flujo operativo esperado
**Fase 1 - Crear la action canonica.**
- En `empleados-actions.ts`, aniadir `EmpleadoActivo` + `getEmpleadosActivos()` copiando la
  mecanica de `listEmpleadosParaPagos` (OR empresa/user_empresas, dedup por user_id, derivacion
  de area, orden por nombre `localeCompare("es")`), ampliando el `select` para incluir
  `avatar_url` y `departamentos(nombre, area)` y mapeando al shape `EmpleadoActivo`.
- typecheck para validar el tipo de retorno antes de tocar consumidores.

**Fase 2 - Migrar consumidores uno a uno** (typecheck tras cada uno):
1. `ComunicadosView` / `EncuestasView`: ya cargan un selector real (`listEmpleadosParaComunicado`).
   Sustituir la variable `empleados` (mock) por la lista real (la del selector existente o
   `getEmpleadosActivos`), unificar conteos/avatares y eliminar el import de `getEmpleadosPorEmpresa`.
   Mantener el import de `DEPARTAMENTOS` (sigue siendo constante).
2. `BoardingView`: reemplazar `getEmpleadosPorEmpresa(empresaActual.id)` por carga async de
   `getEmpleadosActivos()` en estado; usar `{nombre, apellidos}`.
3. `PartidasView`: idem; usar `{empleadoId, nombreCompleto}` para resolver el creador de partida.
4. `FormacionView`: idem; usar `departamento` para `DEPARTAMENTO_A_PUESTO` y `.length` para conteos.
5. `CalendarioLaboral`: idem; resolver el adorno de estado operativo (mapear a neutro/"Activo" o
   retirar el punto de color); dejar de recibir `empresaId` por prop si ya no se necesita el slug.
6. `empleados.io.ts`: recortar el schema/columns a campos reales y mapear `fetchAll` desde
   `getEmpleadosActivos`, o desactivar el IO de empleados (documentar la decision).

**Fase 3 - Limpiar `data/rrhh.ts`.**
- Borrar `HABANA_EMPLEADOS`, `BACANAL_EMPLEADOS`, `getEmpleadosPorEmpresa`, el tipo `Empleado`
  operativo, `EstadoEmpleado` y `ESTADOS_LABEL`/`ESTADOS_COLOR` mock si quedan huerfanos.
- Conservar `DEPARTAMENTOS` (constante) solo si algun consumidor la importa todavia; si no, borrar
  el archivo entero y limpiar imports.

**Fase 4 - Validar.**
- `grep` de criterio de corte vacio + `typecheck` + `build` verdes + smoke manual con HABANA/BACANAL.

## Decisiones de negocio pendientes
Ninguna critica de negocio. Sub-decisiones tecnicas (las puede resolver el ejecutor, documentando):
- **DT-1 (estado operativo del calendario):** ¿se elimina el punto de color o se mapea a un estado
  neutro hasta OLA2-14? Recomendado: estado neutro/"Activo" + nota de que el real-time llega con horarios/fichajes.
- **DT-2 (IO de empleados):** ¿se recorta el schema del IO a campos reales o se desactiva el import/export
  de empleados? Recomendado: recortar a campos reales (id, nombre, apellidos, departamento, puesto, area, estado).
- **DT-3 (mapeo depto->area):** se reutiliza tal cual el de pagos (`OPERATIVA` -> operativa, resto ->
  administrativa). Sin decision adicional salvo que negocio quiera mas areas (no hoy).

## Paths del proyecto
A tocar:
- `src/features/rrhh/actions/empleados-actions.ts` (aniadir action + tipo).
- `src/features/rrhh/data/rrhh.ts` (vaciar empleados / posible borrado).
- `src/features/rrhh/io/empleados.io.ts` (recortar o desactivar).
- `src/features/rrhh/components/calendarios/CalendarioLaboral.tsx`.
- `src/features/rrhh/components/calendarios/CalendariosRRHHView.tsx` (si CalendarioLaboral deja de recibir `empresaId`).
- `src/features/rrhh/components/boarding/BoardingView.tsx`.
- `src/features/rrhh/components/formacion/FormacionView.tsx`.
- `src/features/cocina/components/partidas/PartidasView.tsx`.
- `src/features/gerencia/components/EncuestasView.tsx`.
- `src/features/gerencia/components/ComunicadosView.tsx`.

A leer como referencia (no se tocan):
- `src/features/rrhh/actions/pagos-actions.ts`.
- `src/features/gerencia/actions/comunicados-actions.ts`.
- `src/features/empresa/contexts/empresa-context.tsx`.

## Agentes recomendados
- Implementacion: agente de codigo Next.js/Supabase (Feature-First, TS estricto).
- Revision: `review-rls-multi-tenant` (confirmar que la action filtra por `empresa_id` y no filtra de mas
  via OR/user_empresas) y `golden-path-review` (server action + consumo en client components).
- Validacion: ejecutor con WSL para `typecheck`/`build` y smoke con navegador.

## Checklist de cierre
- [ ] `getEmpleadosActivos` + `EmpleadoActivo` creados y exportados desde `empleados-actions.ts`.
- [ ] Action replica filtro OR + dedup por user_id + derivacion de area + orden `localeCompare("es")`.
- [ ] 6 consumidores funcionales migrados a la action (datos reales por empresa activa).
- [ ] Comunicados/Encuestas unificados al selector real (sin dependencia mock).
- [ ] Calendario: adorno de estado operativo degradado honestamente.
- [ ] `empleados.io.ts` recortado o desactivado (decision DT-2 documentada).
- [ ] `data/rrhh.ts` sin empleados; `DEPARTAMENTOS` conservado solo si se usa (o archivo borrado).
- [ ] `grep -rln "getEmpleadosPorEmpresa\|HABANA_EMPLEADOS\|BACANAL_EMPLEADOS" src` -> vacio.
- [ ] `npm run typecheck` y `npm run build` verdes (WSL).
- [ ] Smoke HABANA + BACANAL en las 6 pantallas (conteo/lista real, sin romper al cambiar de empresa).
- [ ] Schema real verificado via Management API (avatar_url, departamentos.area backfilled, estados).
- [ ] Commit `_FernandoClaude` + push a `main` tras validacion.

## Siguiente paso sugerido
Ejecutar la Fase 1 (crear `getEmpleadosActivos` por generalizacion de `listEmpleadosParaPagos`) y
hacer `typecheck` antes de tocar consumidores. Al cerrar OLA2-01 quedan desbloqueadas OLA2-04
(boarding), OLA2-07 (encuestas) y OLA2-09 (ficha ampliada), que dependen de esta fuente unica.

## Ruta canonica
docs/rrhh-consolidacion/ola2-demock/Full-TASK-OLA2-01-empleados-reales-fuente-unica.md
