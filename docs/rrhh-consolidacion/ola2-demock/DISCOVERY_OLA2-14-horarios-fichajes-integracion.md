# DISCOVERY OLA2-14 - Horarios <-> Fichajes (integracion)

- Fecha: 2026-06-01
- Repo: `Balles-Hosteleros`
- Autor: agente de arquitectura (discovery verificado contra codigo + SQL real, no contra documentacion)
- Plan origen: `docs/rrhh-consolidacion/ola2-demock/EXECUTION_PLAN_OLA2.md` (fila OLA2-14)
- Naturaleza: **INTEGRACION**, no de-mock. Horarios ya es real; el gap es que es una **isla** desconectada de `fichajes`.

## Resumen ejecutivo

Horarios RRHH **ya es real**: sus 5 secciones (Turnos, Descansos, Patrones, Tipos de fichaje, Tipos de ausencia) estan cableadas a Supabase con RLS y seed real de BACANAL. `src/features/rrhh/data/horarios.ts` **no contiene mock** (solo tipos y helpers puros). El problema no es "hacer real" sino **conectar dos subsistemas reales que no se hablan**:

1. El **horario teorico** (que turno toca a cada empleado cada dia, via patron) existe y es navegable, pero **nunca se compara con lo fichado**. La tabla `fichajes` no guarda referencia al turno teorico ni al horario esperado.
2. El catalogo `tipos_fichaje` (ENT/SAL/IPA/...) esta persistido y es editable en la UI de Horarios, pero `mi-panel` lo **ignora**: ficha con un enum propio (`pendiente|trabajando|pausa|completado`) y nunca lee el catalogo.

A esto se suma **deuda de integridad blanda** (referencias turno_id sin FK -> huerfanos al borrar turno) y un **riesgo real de orden de migraciones** (las `rrhh_*` se reconstruyeron desde prod tras reverts).

## Estado real verificado (codigo + SQL)

### Horarios YA es real (no es mock)

`src/features/rrhh/data/horarios.ts` (verificado): solo exporta interfaces (`Turno`, `Cuadrante`, `Descanso`, `TipoFichaje`, `TipoAusencia`), el mapa `TURNO_TONOS` y helpers puros (`formatTramo`, `formatTurnoHorario`, `calcularDuracionTurno`, `minutosTramo`). El comentario en lin 55-57 lo declara explicitamente: *"Datos de turnos, descansos, cuadrantes, tipos fichaje y tipos ausencia ahora viven en Supabase ... Este archivo conserva tipos y helpers."* No hay arrays de datos simulados.

Actions reales verificadas:

- `src/features/rrhh/actions/turnos-actions.ts`: CRUD de `rrhh_turnos` y lectura de `rrhh_cuadrantes`. `createTurno` genera `id` text via `makeTurnoId` (`t-<empresa4>-<base36>-<rand>`), no uuid. `updateTurno` mantiene `updated_at` a mano (no hay trigger).
- `src/features/rrhh/actions/descansos-actions.ts`: CRUD de `rrhh_descansos`. `turnos: string[]` se guarda como jsonb de ids de turno (referencia blanda). `id` text via `makeDescansoId`.
- `src/features/rrhh/actions/patrones-actions.ts`: CRUD de `rrhh_patrones` + `rrhh_patron_semanas` + `rrhh_patron_empleados`. Incluye `getEmpleadosPorTurno` (ver abajo).
- `src/features/rrhh/actions/horarios-config-actions.ts`: CRUD de `tipos_ausencia` y `tipos_fichaje` (lectura/escritura real, replicacion multi-empresa).

### Tablas reales (7) con RLS

| Tabla | PK | Migracion canonica | RLS (rol) | Notas |
| --- | --- | --- | --- | --- |
| `rrhh_cuadrantes` | `id` **text** | `20260526230000_rrhh_horarios_snapshot.sql` | `to public`, UNION user_empresas+profiles | Sin trigger updated_at |
| `rrhh_turnos` | `id` **text** | `20260526230000_rrhh_horarios_snapshot.sql` | `to public`, UNION | `color text` **sin CHECK**; `tramos` jsonb; `cuadrante_id` FK->cuadrantes |
| `rrhh_descansos` | `id` **text** | `20260526230000_rrhh_horarios_snapshot.sql` | `to public`, UNION | `turnos` jsonb (**ref blanda a rrhh_turnos.id, sin FK**); `dias` jsonb |
| `rrhh_patrones` | `id` uuid | `20260515150000_rrhh_patrones.sql` | `to authenticated`, solo profiles | `tipo` check (semanal/libre) |
| `rrhh_patron_semanas` | `id` uuid | `20260515150000_rrhh_patrones.sql` | `to authenticated`, join patrones | `dias` jsonb = array de turno_id **text|null** (**ref blanda, sin FK**) |
| `rrhh_patron_empleados` | (patron_id, empleado_id) | `20260515150000_rrhh_patrones.sql` | `to authenticated`, join patrones | FK reales a patrones y empleados |
| `tipos_ausencia` | `id` uuid | `085_horarios_tipos_ausencia_y_fichaje.sql` (+`20260514120000`) | `to ...` (USING profiles) | Ampliada por 20260514120000 |
| `tipos_fichaje` | `id` uuid | `085_horarios_tipos_ausencia_y_fichaje.sql` | USING profiles | Catalogo ENT/SAL/IPA/FPA/MAN/COR/VAL |

Seed real BACANAL: `20260526230100_rrhh_horarios_seed_bacanal_real.sql` (3 cuadrantes + 43 turnos + 12 descansos, segun comentario del snapshot). El propio snapshot (lin 1-32) documenta que estas tablas **se crearon a mano en prod fuera de control de versiones** y que migraciones previas (20260526210000/210100/220000) fueron **revertidas** por desalineacion (schema inferido del codigo, no del estado real). Reverts: commits `acccf62` + `d805a7b`.

### El GAP CENTRAL: `fichajes` no conoce el horario teorico

`supabase/migrations/056_fichajes.sql` (schema base en git) define `fichajes` con: `id, empresa_id, empleado_id, empleado_nombre, fecha, hora_entrada, hora_salida, pausa_inicio, pausa_fin, horas_totales, estado, incidencia, observaciones, departamento, centro, created_at, updated_at`. **No hay `turno_id` ni ninguna columna de horario teorico esperado.**

**ATENCION - schema git != schema real (verificar):** la action `ficharEntradaPersonal` (mi-panel-actions.ts lin 242-257) escribe columnas que **no estan en 056**: `local_id`, `lat_entrada`, `lng_entrada`, `precision_entrada_metros`, `modo_teletrabajo`, y en salida `lat_salida`, `lng_salida`, `precision_salida_metros`. Esas columnas llegan por migraciones posteriores:

- `20260514130000_rrhh_centros_y_geolocalizacion.sql`: anade a `fichajes` -> `centro_id` (FK->centros), `lat/lng/precision_entrada`, `lat/lng/precision_salida`, `modo_teletrabajo`.
- `20260515100000_rename_centros_to_locales.sql`: renombra `fichajes.centro_id` -> `local_id` (y la tabla `centros` -> `locales`).

Conclusion: el schema vivo de `fichajes` es 056 + geoloc + rename. **Ninguna** migracion anade `turno_id`, `tipo_fichaje_id` ni horario teorico. **Verificar el schema real de `fichajes` via Management API antes de migrar** (regla del proyecto): confirmar el set exacto de columnas vivas, que `local_id` existe (no `centro_id`), y que no existe ya algun `turno_id` aplicado a mano.

`estado` en 056 tiene CHECK `in ('pendiente','trabajando','pausa','completado')` -> es el enum propio de mi-panel, **desconectado de `tipos_fichaje`**.

### El vinculo empleado -> patron -> dia -> turno SI existe (pero no toca fichajes)

`getEmpleadosPorTurno` (patrones-actions.ts lin 50-160) recorre la cadena **en sentido turno -> empleados**:

1. `rrhh_patrones` activos de la empresa.
2. `rrhh_patron_empleados` -> empleados asignados a cada patron.
3. `rrhh_patron_semanas.dias` (jsonb array de turno_id|null) -> por cada turno_id, acumula los empleados del patron.
4. Devuelve `Record<turnoId, EmpleadoBasico[]>`.

Es decir: el modelo de datos **ya contiene** la informacion para resolver "que turno teorico tiene el empleado X el dia D" (empleado -> patron -> semana[orden] -> dias[indiceDia] -> turno_id). Lo que **no existe** es:

- La funcion inversa `getHorarioTeoricoDelDia(empleadoId, fecha)` (empleado+fecha -> turno teorico + tramos esperados).
- Cualquier escritura/lectura que conecte ese turno teorico con la fila de `fichajes` de ese dia.

`getEmpleadosPorTurno` **no consulta `fichajes` en absoluto**. Confirma que la isla esta cerrada por ambos lados: horarios no mira fichajes, fichajes no mira horarios.

### `tipos_fichaje` persistido y editable, pero mi-panel lo ignora

- Persistencia + CRUD: `horarios-config-actions.ts` (`listTiposFichaje`/`createTipoFichaje`/`updateTipoFichaje`/`deleteTipoFichaje`), tabla `tipos_fichaje` (085), seed ENT/SAL/IPA/FPA/MAN/COR/VAL.
- Consumo en fichaje real: **ninguno**. `mi-panel-actions.ts` (`ficharEntradaPersonal`, `ficharSalidaPersonal`, `iniciarPausaPersonal`, `finalizarPausaPersonal`) escribe `estado` con el enum literal, sin leer `tipos_fichaje`.
- UI empleado: `MisFichajesView.tsx` mapea colores por el enum (`trabajando`/`pausa`/`completado`/`incidencia` lin 13-18) y deriva `sin cerrar` en cliente (lin 28-33). El tipo `MiFichajeHoy` (mi-panel/types lin 28-38) tiene `estado: string` y `incidencia: string | null`; **no hay** campo de turno teorico ni de desviacion.

### Deuda tecnica menor (a endurecer en esta task)

1. **Integridad referencial blanda**: `rrhh_descansos.turnos[]` y `rrhh_patron_semanas.dias[]` guardan `turno_id` (text) **sin FK** a `rrhh_turnos`. `deleteTurno` (turnos-actions.ts lin 161-173) es un hard delete **sin limpieza** de esas referencias -> quedan ids huerfanos en descansos y patrones. Confirmado tambien en el comentario del snapshot (lin 241: *"turnos jsonb son referencias blandas a rrhh_turnos.id"*).
2. **`rrhh_turnos.color` sin CHECK**: el snapshot lo dice explicito (lin 30-31). Los valores validos viven solo en el enum TS `TurnoTono`; la BD acepta cualquier texto.
3. **Dos estilos de RLS conviven**: `rrhh_cuadrantes/turnos/descansos` usan `to public` + UNION de `user_empresas` y `profiles` (snapshot); `rrhh_patrones/patron_semanas/patron_empleados` usan `to authenticated` + solo `profiles`; `fichajes` usa `to authenticated` + solo `profiles` (`20260518110000_mensajes_fichajes_rls_canonico.sql`). Inconsistencia de criterio multi-empresa (relevante para usuarios con varias empresas).
4. **Riesgo de orden de migraciones (085 vs 20260514120000)**: `085` crea `tipos_ausencia` con su set base; `20260514120000_tipos_ausencia_sesame_alignment.sql` hace `ADD COLUMN ... limite_dias/conteo_dias/remunerada`, `DELETE FROM tipos_ausencia` (borra el seed de 085) y re-seedea 2 filas. Las actions (`mi-panel-actions::crearSolicitudPersonal` lin 770-780 y `horarios-config-actions`) **leen `limite_dias`**. Si en prod no se aplico 20260514120000 (o se aplico en otro orden), esa columna no existe y las lecturas/escrituras fallan. **Verificar en prod via Management API que `tipos_ausencia` tiene `limite_dias`, `conteo_dias`, `remunerada`** antes de tocar nada.

## Decisiones de negocio detectadas

- **D8 (alcance de la integracion):** la conexion turno-vs-fichaje, ¿solo **muestra** la desviacion (informativo), o tambien **valida/bloquea** el fichaje fuera de turno (gating)? Recomendacion del discovery: empezar por **mostrar** (desviacion + incidencia derivada), no bloquear. Bloquear fichajes choca con la realidad de hosteleria (cambios de turno de ultima hora, refuerzos, guardias) y con el flujo de geofencing ya existente; ademas un bloqueo erroneo impide registrar trabajo realmente efectuado (riesgo laboral). Dejar el bloqueo como fase opcional posterior, gobernada por flag configurable.
- **D7 (turnos en calendarios):** la pestana Laboral de OLA2-05 (Calendarios) no debe crear una tercera representacion de turnos. Se delega aqui la **fuente unica de turnos** (`rrhh_turnos` + patrones); OLA2-05 consume la lectura real que exponga Horarios. Coordinar contrato de lectura para no pisar cambios.

## Paths relevantes (verificados)

- `src/features/rrhh/data/horarios.ts` (tipos + helpers; sin mock).
- `src/features/rrhh/actions/patrones-actions.ts` (`getEmpleadosPorTurno`, CRUD patrones).
- `src/features/rrhh/actions/turnos-actions.ts` (CRUD turnos; `deleteTurno` sin limpieza).
- `src/features/rrhh/actions/descansos-actions.ts` (CRUD descansos; `turnos` jsonb).
- `src/features/rrhh/actions/horarios-config-actions.ts` (CRUD tipos_ausencia/tipos_fichaje).
- `src/features/mi-panel/actions/mi-panel-actions.ts` (fichaje real: `ficharEntradaPersonal` 178-267, `ficharSalidaPersonal` 269-328, pausas 330-362, `getMiFichajeHoy` 137-176, `listarMisFichajes` 364-401, `getMiPanelResumen` 1276-).
- `src/features/mi-panel/types/index.ts` (`MiFichajeHoy` 28-38).
- `src/features/mi-panel/components/MisFichajesView.tsx` (render del estado).
- Migraciones: `056_fichajes.sql`, `20260514130000_rrhh_centros_y_geolocalizacion.sql`, `20260515100000_rename_centros_to_locales.sql`, `20260515150000_rrhh_patrones.sql`, `085_horarios_tipos_ausencia_y_fichaje.sql`, `20260514120000_tipos_ausencia_sesame_alignment.sql`, `20260526230000_rrhh_horarios_snapshot.sql`, `20260526230100_rrhh_horarios_seed_bacanal_real.sql`, `20260518110000_mensajes_fichajes_rls_canonico.sql`.

## Verificaciones pendientes para el ejecutor (Management API, antes de migrar)

1. Schema real de `fichajes`: set exacto de columnas vivas; confirmar `local_id` (no `centro_id`); confirmar que **no** existe ya `turno_id`/`tipo_fichaje_id` aplicado a mano; estado del CHECK de `estado`.
2. `tipos_ausencia`: confirmar columnas `limite_dias`, `conteo_dias`, `remunerada` (orden de migraciones 085 vs 20260514120000).
3. `rrhh_turnos`: confirmar PK text, ausencia de CHECK en `color`, y que las RLS vivas coinciden con el snapshot (`to public` + UNION).
4. Estado de huerfanos: ¿hay `turno_id` en `rrhh_descansos.turnos` / `rrhh_patron_semanas.dias` que ya no existan en `rrhh_turnos`? (medir antes de anadir FK/limpieza).

## Ruta canonica

docs/rrhh-consolidacion/ola2-demock/DISCOVERY_OLA2-14-horarios-fichajes-integracion.md
