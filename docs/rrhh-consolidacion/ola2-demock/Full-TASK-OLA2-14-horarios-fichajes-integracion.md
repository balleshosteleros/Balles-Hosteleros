# Full-TASK-OLA2-14 - Horarios <-> Fichajes (integracion)

## Estado

PLANIFICADO (Ola 2, 2026-06-01). No implementado.
Discovery en `DISCOVERY_OLA2-14-horarios-fichajes-integracion.md` (estado real verificado contra codigo + SQL, no contra documentacion).

**Esto es una INTEGRACION, no un de-mock.** Horarios ya es real (sus 5 secciones estan cableadas a Supabase con RLS y seed real de BACANAL; `data/horarios.ts` no tiene mock). El trabajo consiste en **cerrar la isla**: conectar el horario teorico (turno/patron del dia) con el fichaje real, hacer que el fichaje consuma el catalogo `tipos_fichaje`, y endurecer la integridad/orden de migraciones que sostiene todo eso.

## Objetivo

Que el horario teorico y el fichaje real dejen de ser dos subsistemas que no se hablan:

1. **Vincular el turno teorico al fichaje**: que cada fila de `fichajes` pueda conocer el turno (y sus tramos esperados) que el patron del empleado le asigna ese dia, persistiendo esa referencia (o resolviendola de forma estable) para poder compararla con lo realmente fichado.
2. **Calcular desviaciones/incidencias**: derivar, a partir de turno teorico vs hora_entrada/hora_salida/pausas reales, la desviacion (retraso, salida anticipada, exceso, fichaje fuera de turno) y reflejarla de forma honesta en RRHH y en mi-panel.
3. **Consumir `tipos_fichaje`**: que el fichaje real use el catalogo persistido (ENT/SAL/IPA/FPA/...) en vez de vivir aislado en el enum propio `pendiente|trabajando|pausa|completado`, sin romper el flujo actual.
4. **Endurecer integridad y orden de migraciones**: FK/limpieza para las referencias blandas de turno (`rrhh_descansos.turnos`, `rrhh_patron_semanas.dias`), CHECK de `rrhh_turnos.color`, y verificacion del orden 085 vs 20260514120000.

Todo respetando RLS multi-tenant por `empresa_id`, recibiendo el **UUID (`dbId`)** en las actions (no el slug), y verificando el **schema real en prod** antes de migrar.

## Estimacion de complejidad

**Media-Alta.**

- Backend: alto. Resolver el horario teorico por (empleado, fecha) recorriendo patron -> semana -> dia -> turno (la cadena existe pero falta la funcion inversa); decidir y aplicar el modelo de persistencia del vinculo en `fichajes`; calcular desviaciones con aritmetica de tramos (incluye turnos nocturnos que cruzan medianoche, ya contemplados en `minutosTramo` de `data/horarios.ts`).
- Datos/migracion: medio-alto. Anadir columna(s) a `fichajes` o tabla puente; FK/limpieza de referencias blandas (con medicion previa de huerfanos); CHECK de color; **todo idempotente y verificado contra prod** (schema git de fichajes ya diverge del real).
- Frontend: medio. Mostrar turno teorico + desviacion en `MisFichajesView` (empleado) y en la vista RRHH; sin reescribir el flujo de fichaje.
- Decision/coordinacion: relevante. D8 (alcance: mostrar vs bloquear) condiciona la fase 2; D7 (turnos de calendarios) coordina con OLA2-05.

## Criterio de corte

- Existe una funcion server que, dado (empleadoId, fecha), devuelve el turno teorico del dia (o "sin turno") resolviendo patron -> semana -> dia -> turno, con sus tramos, reutilizando el modelo real (no un mock ni una tercera fuente de turnos).
- El fichaje real queda **vinculado** a ese turno teorico segun el modelo elegido (columna en `fichajes` o tabla puente), verificado en BD por UUID de empresa.
- Se calcula y muestra la **desviacion** turno-vs-fichaje (retraso/salida anticipada/exceso/fuera de turno) en `MisFichajesView` (empleado) y en la vista RRHH correspondiente, de forma honesta (sin inventar datos cuando no hay turno asignado).
- El fichaje **consume `tipos_fichaje`** (al menos: el estado/codigo de cada evento se referencia al catalogo real por empresa), sin romper `getMiFichajeHoy`/`listarMisFichajes`/`getMiPanelResumen` ni el render existente.
- La integridad blanda queda endurecida: `rrhh_turnos.color` con CHECK; referencias `turno_id` de descansos/patrones con FK o con limpieza al borrar turno (segun lo que permita el modelo text+jsonb); `deleteTurno` ya no deja huerfanos.
- El orden 085 vs 20260514120000 queda verificado/garantizado (idempotencia) y `tipos_ausencia` tiene `limite_dias/conteo_dias/remunerada` en prod.
- Ningun punto pasa el slug a una query real; las actions reciben/derivan el UUID.
- Cierre alineado con la fila "OLA2-14" del `EXECUTION_PLAN_OLA2.md`.

## Modo operativo

- taskId: **OLA2-14**
- taskMode: **code**
- reviewMode: **standard**
- sourcePlan: `docs/rrhh-consolidacion/ola2-demock/EXECUTION_PLAN_OLA2.md`
- dependsOn: ninguna dura (horarios y fichajes ya son reales). Coordinacion con **OLA2-05** por D7 (turnos de la pestana Laboral).

## Contexto previo obligatorio

Leer antes de ejecutar:

1. `docs/rrhh-consolidacion/ola2-demock/DISCOVERY_OLA2-14-horarios-fichajes-integracion.md` (este discovery: estado real, gap central, schema git != real, deuda y verificaciones pendientes).
2. `src/features/rrhh/actions/patrones-actions.ts` (`getEmpleadosPorTurno` lin 50-160: la cadena empleado->patron->semana->dia->turno; CRUD de patrones/semanas/empleados).
3. `src/features/rrhh/actions/turnos-actions.ts` (`rowToTurno`, CRUD; `deleteTurno` lin 161-173 sin limpieza de huerfanos; `makeTurnoId` -> id text).
4. `src/features/rrhh/actions/descansos-actions.ts` (`turnos: string[]` jsonb, referencia blanda).
5. `src/features/rrhh/actions/horarios-config-actions.ts` (CRUD real de `tipos_fichaje` y `tipos_ausencia`; `TipoFichajeRow`).
6. `src/features/rrhh/data/horarios.ts` (tipos + helpers puros: `minutosTramo`, `calcularDuracionTurno`, `formatTurnoHorario`; `TurnoTono`/`TURNO_TONOS`; **conservar**, alimentan el calculo de desviacion).
7. `src/features/mi-panel/actions/mi-panel-actions.ts` (fichaje real: `ficharEntradaPersonal` 178-267, `ficharSalidaPersonal` 269-328, pausas 330-362, `getMiFichajeHoy` 137-176, `listarMisFichajes` 364-401, `autoCerrarFichajesHuerfanos` 112-135, `getMiPanelResumen` 1276-).
8. `src/features/mi-panel/types/index.ts` (`MiFichajeHoy` 28-38: `estado: string`, `incidencia: string|null`; aqui se anaden los campos de turno teorico/desviacion).
9. `src/features/mi-panel/components/MisFichajesView.tsx` (render del estado: `ESTADO_COLOR` 13-18, `deriveEstadoMostrado` 28-33; punto donde mostrar turno teorico + desviacion).
10. Migraciones: `056_fichajes.sql`, `20260514130000_rrhh_centros_y_geolocalizacion.sql`, `20260515100000_rename_centros_to_locales.sql`, `20260515150000_rrhh_patrones.sql`, `085_horarios_tipos_ausencia_y_fichaje.sql`, `20260514120000_tipos_ausencia_sesame_alignment.sql`, `20260526230000_rrhh_horarios_snapshot.sql`, `20260518110000_mensajes_fichajes_rls_canonico.sql`.
11. `EXECUTION_PLAN_OLA2.md` (criterios globales: UUID en actions, RLS real, placeholder honesto, verificar schema prod; D7 y D8).

## Scope IN

- **Funcion de horario teorico**: `getHorarioTeoricoDelDia(empleadoId, fecha)` (server) que resuelve el turno del dia recorriendo `rrhh_patron_empleados` -> `rrhh_patron_semanas` (orden + indice del dia de la semana) -> `dias[indiceDia]` -> `rrhh_turnos`. Reutiliza la cadena ya implementada en `getEmpleadosPorTurno` (sentido inverso). Devuelve turno + tramos esperados o "sin turno". Para patrones `tipo='libre'` y patrones multi-semana, definir y documentar la regla de seleccion de semana/dia.
- **Vinculo turno teorico <-> fichaje**: modelo de persistencia (ver "Modelo de datos propuesto"): columna `turno_id` (text, coherente con PK de `rrhh_turnos`) + snapshot del horario teorico en `fichajes`, **o** tabla puente. Decidir en base a la verificacion de schema real. Poblar el vinculo al fichar entrada (resolviendo el turno teorico de ese dia) sin romper el flujo de geofencing.
- **Calculo de desviacion**: `calcularDesviacionFichaje(...)` (puro o server) que compara tramos teoricos vs hora_entrada/hora_salida/pausas reales y produce {retrasoMin, salidaAnticipadaMin, excesoMin, fueraDeTurno, sinTurno}. Reutilizar `minutosTramo`/`calcularDuracionTurno` de `data/horarios.ts` (ya manejan cruce de medianoche).
- **Consumo de `tipos_fichaje`**: referenciar el catalogo real (por `empresa_id`) en el fichaje. Minimo viable: mapear cada evento/estado a un `tipos_fichaje.codigo` (ENT/SAL/IPA/FPA) y persistir esa referencia, conservando el enum `estado` actual para no romper el render. Definir comportamiento si la empresa edito/desactivo un tipo (fallback honesto).
- **Hardening de integridad**: CHECK en `rrhh_turnos.color` (valores de `TurnoTono`); FK o limpieza de referencias blandas `turno_id` en `rrhh_descansos.turnos` y `rrhh_patron_semanas.dias`; `deleteTurno` deja de generar huerfanos (limpieza explicita o bloqueo si esta referenciado).
- **Orden de migraciones**: garantizar (idempotencia + verificacion) que 085 y 20260514120000 dejan `tipos_ausencia` con `limite_dias/conteo_dias/remunerada` en prod; documentar el orden real verificado.
- **UI**: mostrar turno teorico + desviacion en `MisFichajesView` (empleado) y en la vista RRHH de fichajes; honesto cuando no hay turno (no inventar).
- **Slug -> UUID**: toda action nueva recibe/deriva el UUID de empresa.

## Scope OUT

- **NO crear una tercera representacion de turnos.** La fuente unica es `rrhh_turnos` + patrones. OLA2-05 (Calendarios, pestana Laboral) consume la lectura real que exponga esta task (D7).
- **NO bloquear fichajes fuera de turno por defecto** (ver D8). Por defecto la integracion **muestra** desviacion; el bloqueo es fase opcional posterior gobernada por flag, fuera del corte salvo decision explicita del responsable.
- **NO reescribir el flujo de fichaje** (geofencing, teletrabajo, auto-cierre de huerfanos, calculo de `horas_totales`): se **extiende**, no se sustituye.
- **NO rediseñar el enum `estado`** de `fichajes` ni eliminar `pendiente/trabajando/pausa/completado`: se referencia `tipos_fichaje` **en paralelo**, sin romper el CHECK ni el render existente.
- **NO migrar `rrhh_turnos.id` a uuid** ni cambiar `makeTurnoId`: el id text es el contrato vivo (43 turnos BACANAL ya creados). El `turno_id` en `fichajes` debe ser **text** para casar.
- **NO unificar los dos estilos de RLS** (`to public`+UNION vs `to authenticated`+profiles) en esta task salvo que toque por seguridad; solo se documenta y, si se anade `turno_id`, no se degrada la RLS vigente de `fichajes`.
- **NO tocar la logica de solicitudes/ausencias** (`solicitudes_personal`, alta/aprobacion) ni la presentacion del calendario de OLA2-05 mas alla de la coordinacion de turnos.
- **NO crear el modulo de reservas** ni metricas de ratios (OLA2-13).

## Restricciones

- **Verificar el schema real de `fichajes` y `tipos_ausencia` en prod via Management API antes de migrar** (el schema git de `fichajes` ya diverge del real: faltan geoloc + rename `local_id`). No inferir del codigo.
- Las queries reales reciben/derivan el **UUID de empresa** (`empresaActual.dbId` o derivado server-side, patron de `resolveEmpresaUuid`/`getContext`), nunca el slug.
- `turno_id` en `fichajes` debe ser **text** (coherente con `rrhh_turnos.id`), no uuid.
- RLS multi-tenant real por `empresa_id`; no degradar la RLS vigente de `fichajes` (`20260518110000`). Si se crea tabla puente, RLS estilo `fichajes`/`tipos_fichaje`.
- Migraciones idempotentes (`add column if not exists`, `drop policy if exists`+`create`, `do $$ ... $$` para constraints/FK condicionales) y verificadas. Medir huerfanos antes de anadir FK; si los hay, limpiar o degradar a `not valid` documentado.
- Conservar `data/horarios.ts` (tipos + helpers) y los helpers de tramos; no reintroducir `data/rrhh.ts` como fuente funcional.
- Flujos de lectura/escritura conservan try/catch, error legible y degradan de forma honesta (sin inventar turno/desviacion cuando no hay datos).
- Validacion por ejecutor: `npm run typecheck` y `npm run build` via WSL (`wsl -d Ubuntu bash -c`, NON-login). El agente de arquitectura **no** commitea ni buildea.
- Commits terminan en `_FernandoClaude` (criterio del `EXECUTION_PLAN_OLA2.md`); push directo a `main` tras typecheck+build verdes (lo ejecuta Fernando).
- No versionar peppers/SMTP/claves/service-role; restaurar `next-env.d.ts` si el tooling lo modifica.

## Validacion requerida

1. `npm run typecheck` verde (WSL).
2. `npm run build` verde (WSL).
3. Smoke funcional controlado (dev local), con un empleado de BACANAL asignado a un patron con turno conocido:
   - `getHorarioTeoricoDelDia(empleado, hoy)` devuelve el turno esperado del patron (verificable contra `getEmpleadosPorTurno`).
   - Fichar entrada/salida -> el fichaje queda vinculado al turno teorico (verificar en BD) y la desviacion calculada coincide con la diferencia real de horas.
   - Un empleado **sin** turno ese dia -> la vista muestra "sin turno" de forma honesta (no error, no turno inventado).
   - `MisFichajesView` muestra turno teorico + desviacion; el flujo de fichaje (geofencing/teletrabajo/auto-cierre) sigue funcionando igual.
   - El evento de fichaje referencia un `tipos_fichaje.codigo` real de la empresa; `getMiPanelResumen` y `listarMisFichajes` siguen ok.
4. Verificacion BD (Management API/SQL): la fila de `fichajes` tiene el `turno_id`/snapshot correcto y `empresa_id` = UUID; `tipos_ausencia` tiene `limite_dias/conteo_dias/remunerada`; `rrhh_turnos.color` tiene CHECK; no quedan `turno_id` huerfanos tras borrar un turno de prueba.
5. RLS: un usuario de otra empresa no ve ni edita fichajes/turnos ajenos; el vinculo no filtra cross-tenant.

## Dependencias

- **Bloqueantes:** ninguna. Horarios y fichajes ya son reales (Ola E, cierre de islas).
- **Coordinacion (OLA2-05, Calendarios):** D7 — la pestana Laboral consume la lectura real de turnos que exponga esta task; no crear una tercera fuente. Acordar el contrato de lectura de turnos antes de que OLA2-05 toque `CalendarioLaboral`.
- **Decisiones de negocio:** D8 (alcance: mostrar vs bloquear) y D7 (turnos calendarios) — ver seccion.

## Inputs

- Modelo real de horarios: `rrhh_turnos` (id text, tramos jsonb), `rrhh_cuadrantes`, `rrhh_descansos`, `rrhh_patrones`/`rrhh_patron_semanas` (dias jsonb de turno_id)/`rrhh_patron_empleados`.
- Catalogo real `tipos_fichaje` (085) + sus actions (`horarios-config-actions.ts`).
- Tabla real `fichajes` (056 + geoloc `20260514130000` + rename `20260515100000`): schema vivo a confirmar en prod.
- Cadena ya implementada `getEmpleadosPorTurno` (patrones-actions.ts) — base para la funcion inversa.
- Helpers puros de tramos: `minutosTramo`, `calcularDuracionTurno`, `formatTurnoHorario` (`data/horarios.ts`).
- Fichaje real: `mi-panel-actions.ts` (entrada/salida/pausas) + `MiFichajeHoy` (`mi-panel/types`).
- Empresa activa por UUID: `empresaActual.dbId` (cliente) o derivacion server-side.

## Outputs esperados

- 1 migracion idempotente y verificada que: (a) anade el vinculo turno teorico a `fichajes` (columna `turno_id` text + snapshot horario, o tabla puente con RLS); (b) anade CHECK a `rrhh_turnos.color`; (c) FK o salvaguarda de las referencias blandas `turno_id` (descansos/patrones) segun lo medido; (d) garantiza/verifica el orden 085 vs 20260514120000 sobre `tipos_ausencia`.
- `getHorarioTeoricoDelDia(empleadoId, fecha)` y `calcularDesviacionFichaje(...)` (firmas en la seccion siguiente), en el feature `rrhh` (horario teorico) y/o reutilizables desde `mi-panel`.
- Fichaje vinculado al turno teorico y referenciando `tipos_fichaje` (extension de `mi-panel-actions.ts`), sin romper el flujo actual.
- `MiFichajeHoy` ampliado con turno teorico + desviacion; `MisFichajesView` (y vista RRHH) mostrando ambos honestamente.
- `deleteTurno` sin huerfanos.
- Actualizacion de la fila "OLA2-14" en `EXECUTION_PLAN_OLA2.md` al cerrar.

## Riesgos conocidos

- **Schema git != real en `fichajes`** (geoloc + rename `local_id` no estan en 056): migrar sobre el supuesto del git rompe. Mitigacion: Management API antes de tocar.
- **Orden de migraciones 085 vs 20260514120000**: si `limite_dias/conteo_dias/remunerada` no estan en prod, las actions ya en uso fallan. Mitigacion: verificar y reforzar idempotencia.
- **`rrhh_*` reconstruidas desde prod tras reverts** (snapshot `20260526230000`, reverts `acccf62`/`d805a7b`): cualquier migracion nueva sobre estas tablas debe respetar PK text y RLS `to public`+UNION; no reintroducir el schema inferido revertido.
- **Referencias blandas con huerfanos preexistentes**: anadir FK directa puede fallar si ya hay `turno_id` invalidos en descansos/patrones. Mitigacion: medir y limpiar antes, o `not valid` documentado.
- **Turnos nocturnos / multi-tramo / patrones libres**: el calculo de desviacion debe manejar cruce de medianoche (cubierto por `minutosTramo`) y la seleccion de semana/dia en patrones multi-semana y `tipo='libre'`; regla mal definida -> desviaciones erroneas.
- **D8 mal resuelto (bloquear por defecto)**: bloquear fichajes fuera de turno en hosteleria impide registrar trabajo real y genera incidencias laborales. Mitigacion: por defecto solo mostrar.
- **Dos estilos de RLS**: usuarios multi-empresa pueden ver distinto entre turnos (`user_empresas`+profiles) y fichajes (solo profiles); no agravar la inconsistencia al cablear el vinculo.

## Modelo de datos propuesto

> **VERIFICAR SCHEMA REAL en prod (Management API) antes de aplicar.** El schema git de `fichajes` (056) ya diverge del vivo (faltan geoloc de `20260514130000` y el rename `centro_id`->`local_id` de `20260515100000`). Confirmar columnas vivas, que `local_id` existe, y que no hay ya `turno_id`/`tipo_fichaje_id` aplicado a mano.

Dos opciones (decidir tras la verificacion; la A es la recomendada por simplicidad y por el camino "una fila por dia por empleado" que ya asume 056):

- **Opcion A - columnas en `fichajes` (recomendada):**
  - `turno_id text references public.rrhh_turnos(id) on delete set null` — turno teorico del dia (text para casar con PK de `rrhh_turnos`).
  - `horario_teorico jsonb` — snapshot de los tramos esperados (y codigo/nombre del turno) en el momento del fichaje, para que el calculo de desviacion sea estable aunque el turno se edite/borre despues (los tramos viven en `rrhh_turnos.tramos` jsonb).
  - opcional `tipo_fichaje_id uuid references public.tipos_fichaje(id) on delete set null` y/o `tipo_fichaje_codigo text` — referencia al catalogo del evento principal, **sin** eliminar `estado`.
  - Indices: `idx_fichajes_turno` sobre `(turno_id)`.
- **Opcion B - tabla puente `fichaje_horario_teorico`** (`fichaje_id` FK, `turno_id` text, `horario_teorico` jsonb, `empresa_id` uuid, RLS estilo `fichajes`): elegir solo si la verificacion muestra que conviene no tocar `fichajes` o si se necesita historico multi-evento por fichaje.

**Consumo de `tipos_fichaje`**: mapear cada evento (entrada/salida/inicio-pausa/fin-pausa) a un `tipos_fichaje.codigo` real de la empresa (ENT/SAL/IPA/FPA), persistiendo la referencia en el fichaje (columna o, si se modela por evento, en la tabla puente). Fallback honesto si la empresa desactivo/edito ese tipo (no romper; degradar a `estado` actual).

**Hardening de integridad (en la misma migracion):**
- `alter table public.rrhh_turnos add constraint rrhh_turnos_color_check check (color in ('stone','emerald','violet','rose','teal','sky','amber'))` — idempotente via `drop constraint if exists` previo (valores de `TurnoTono`). Verificar antes que no haya filas con color fuera del enum.
- Referencias blandas `turno_id` en `rrhh_descansos.turnos[]` y `rrhh_patron_semanas.dias[]` (jsonb de text, **sin FK posible directa sobre elementos de array**): no se puede una FK sobre elementos jsonb. Salvaguarda real = **limpieza al borrar turno** en `deleteTurno` (eliminar el id de los arrays de descansos/patrones de la empresa) o **bloqueo** si el turno esta referenciado, mas (opcional) un trigger/funcion de limpieza. Documentar la decision.
- `tipos_ausencia`: garantizar (idempotente) `limite_dias/conteo_dias/remunerada` y el orden 085 -> 20260514120000.

## Interfaces publicas propuestas

```ts
// rrhh: resuelve el turno teorico del dia recorriendo
// empleado -> rrhh_patron_empleados -> rrhh_patron_semanas (orden + indice del dia)
// -> dias[indiceDia] -> rrhh_turnos. Inversa de getEmpleadosPorTurno.
export async function getHorarioTeoricoDelDia(
  empleadoId: string,
  fecha: string, // ISO yyyy-mm-dd
): Promise<{
  ok: boolean;
  data: {
    turnoId: string | null;
    turno: Turno | null;            // de data/horarios.ts (tramos incluidos)
    tramosEsperados: TurnoTramo[];  // vacio si sin turno
    sinTurno: boolean;
  };
  error?: string;
}>;

// calculo puro (o server): teorico vs real. Reutiliza minutosTramo/calcularDuracionTurno.
export type DesviacionFichaje = {
  retrasoMin: number;            // entrada tardia vs inicio teorico
  salidaAnticipadaMin: number;   // salida antes del fin teorico
  excesoMin: number;             // tiempo trabajado por encima del teorico
  fueraDeTurno: boolean;         // fichaje sin solape con ningun tramo teorico
  sinTurno: boolean;             // no habia turno asignado ese dia
};

export function calcularDesviacionFichaje(input: {
  tramosEsperados: TurnoTramo[];
  horaEntrada: string | null; // timestamptz/ISO
  horaSalida: string | null;
  pausaInicio: string | null; // time HH:mm:ss
  pausaFin: string | null;
}): DesviacionFichaje;
```

Firmas auxiliares previsibles: extension de `ficharEntradaPersonal` (resolver y persistir `turno_id`/snapshot + `tipo_fichaje_codigo`), extension de `getMiFichajeHoy`/`listarMisFichajes` (devolver turno teorico + desviacion), y ampliacion de `MiFichajeHoy`.

## Flujo operativo esperado

**Fase 1 - Vincular el turno teorico al fichaje.**
Implementar `getHorarioTeoricoDelDia` (inversa de `getEmpleadosPorTurno`), definiendo la regla de seleccion de semana/dia para patrones multi-semana y `tipo='libre'`. Verificar el schema real de `fichajes`. Aplicar la migracion del vinculo (Opcion A/B). En `ficharEntradaPersonal`, resolver el turno teorico del dia y persistir `turno_id` + `horario_teorico` (snapshot) sin alterar el flujo de geofencing/teletrabajo.

**Fase 2 - Calcular desviaciones/incidencias.**
Implementar `calcularDesviacionFichaje` (puro, reutilizando los helpers de tramos; manejar cruce de medianoche y multi-tramo). Exponer la desviacion en `getMiFichajeHoy`/`listarMisFichajes` y en la lectura RRHH. Mostrarla en `MisFichajesView` y en la vista RRHH de forma honesta (caso "sin turno"). Segun D8, derivar una `incidencia` informativa (no bloqueante por defecto).

**Fase 3 - Consumir `tipos_fichaje`.**
Mapear cada evento de fichaje a un `tipos_fichaje.codigo` real de la empresa (ENT/SAL/IPA/FPA), persistir la referencia, conservar el enum `estado` y el render. Fallback honesto si el tipo fue editado/desactivado.

**Fase 4 - Hardening de integridad y migraciones.**
CHECK de `rrhh_turnos.color`; limpieza/bloqueo de referencias blandas `turno_id` en `deleteTurno` (descansos/patrones), eliminando huerfanos; verificar/garantizar orden 085 vs 20260514120000 y columnas de `tipos_ausencia`. Todo idempotente y verificado.

## Decisiones de negocio pendientes

- **D8 (alcance de la integracion):** ¿solo **mostrar** la desviacion turno-vs-fichaje (informativo), o tambien **validar/bloquear** el fichaje fuera de turno (gating)? **Recomendacion del discovery: empezar por mostrar, no bloquear.** En hosteleria los turnos cambian de ultima hora (refuerzos, guardias, coberturas); bloquear impediria registrar trabajo realmente efectuado (riesgo laboral) y choca con el geofencing ya existente. El bloqueo queda como **fase opcional posterior**, gobernada por un flag configurable por empresa, fuera del corte de OLA2-14 salvo decision explicita del responsable.
- **D7 (turnos en calendarios):** la pestana Laboral de OLA2-05 no crea una tercera representacion de turnos; **consume la lectura real** de `rrhh_turnos`/patrones que expone esta task. Coordinar el contrato de lectura antes de que OLA2-05 toque `CalendarioLaboral`.

## Paths del proyecto

- `src/features/rrhh/actions/patrones-actions.ts`
- `src/features/rrhh/actions/turnos-actions.ts`
- `src/features/rrhh/actions/descansos-actions.ts`
- `src/features/rrhh/actions/horarios-config-actions.ts`
- `src/features/rrhh/data/horarios.ts`
- `src/features/mi-panel/actions/mi-panel-actions.ts`
- `src/features/mi-panel/types/index.ts`
- `src/features/mi-panel/components/MisFichajesView.tsx`
- `supabase/migrations/056_fichajes.sql`
- `supabase/migrations/20260514130000_rrhh_centros_y_geolocalizacion.sql`
- `supabase/migrations/20260515100000_rename_centros_to_locales.sql`
- `supabase/migrations/20260515150000_rrhh_patrones.sql`
- `supabase/migrations/085_horarios_tipos_ausencia_y_fichaje.sql`
- `supabase/migrations/20260514120000_tipos_ausencia_sesame_alignment.sql`
- `supabase/migrations/20260526230000_rrhh_horarios_snapshot.sql`
- `supabase/migrations/20260518110000_mensajes_fichajes_rls_canonico.sql`
- (nueva migracion OLA2-14: vinculo turno<->fichaje + hardening)

## Agentes recomendados

- **Arquitectura/planificacion** (este contrato): cerrado.
- **Ejecutor de codigo** (taskMode code): implementa funciones + migracion + UI; corre typecheck/build en WSL.
- **review-rls-multi-tenant**: revisar la RLS del vinculo (columna en `fichajes` o tabla puente) y que no se filtre cross-tenant.
- **create-supabase-table-rls-base**: solo si se opta por la tabla puente (Opcion B).
- **Verificacion Management API** (Fernando/ejecutor): confirmar schema real de `fichajes` y `tipos_ausencia` antes de migrar (regla del proyecto).

## Checklist de cierre

- [ ] Schema real de `fichajes` y `tipos_ausencia` verificado en prod (Management API) antes de migrar.
- [ ] `getHorarioTeoricoDelDia(empleadoId, fecha)` implementada y coherente con `getEmpleadosPorTurno`; regla de semana/dia documentada (multi-semana y `libre`).
- [ ] Migracion idempotente aplicada: vinculo turno<->fichaje (`turno_id` text + snapshot, o tabla puente con RLS) + CHECK color + salvaguarda de referencias blandas + verificacion orden 085/20260514120000.
- [ ] `ficharEntradaPersonal` persiste el turno teorico sin romper geofencing/teletrabajo/auto-cierre.
- [ ] `calcularDesviacionFichaje` calcula retraso/salida anticipada/exceso/fuera-de-turno/sin-turno (cruce de medianoche y multi-tramo cubiertos).
- [ ] `MiFichajeHoy` ampliado; `MisFichajesView` y vista RRHH muestran turno teorico + desviacion de forma honesta.
- [ ] Fichaje referencia `tipos_fichaje` (codigo real) con fallback honesto; `getMiPanelResumen`/`listarMisFichajes` intactos.
- [ ] `deleteTurno` no deja huerfanos en descansos/patrones.
- [ ] D8 resuelto con el responsable (por defecto: mostrar, no bloquear); D7 coordinado con OLA2-05.
- [ ] Ninguna query real recibe el slug; UUID en todas las actions.
- [ ] `npm run typecheck` y `npm run build` verdes (WSL).
- [ ] Estado de blindaje declarado y fila "OLA2-14" del `EXECUTION_PLAN_OLA2.md` actualizada.

## Siguiente paso sugerido

Resolver **D8** con el responsable (recomendado: solo mostrar desviacion en OLA2-14, bloqueo como fase posterior con flag). En paralelo, el ejecutor verifica via Management API el schema real de `fichajes` (confirmar `local_id`, ausencia de `turno_id`, geoloc) y de `tipos_ausencia` (`limite_dias/conteo_dias/remunerada`). Con eso fijado, arrancar la Fase 1 (funcion de horario teorico + migracion del vinculo). Coordinar con OLA2-05 el contrato de lectura de turnos (D7) antes de que esa task toque la pestana Laboral.

## Ruta canonica

docs/rrhh-consolidacion/ola2-demock/Full-TASK-OLA2-14-horarios-fichajes-integracion.md
