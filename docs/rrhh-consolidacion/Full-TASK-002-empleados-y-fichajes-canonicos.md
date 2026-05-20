# Full-TASK-002 - Empleados y fichajes canonicos

## Estado

Pendiente.

## Objetivo

Consolidar empleados, ficha y fichajes/mi-panel como nucleo canonico empleado-supervisor, eliminando dependencia de mocks en flujos criticos.

## Estimacion de complejidad

Alta. Cruza identidad, multiempresa, acciones server, UI RRHH y experiencia de empleado.

## Criterio de corte

Alta/edicion/estado/baja de empleado, ficha real, fichaje personal y supervision RRHH operan sobre el mismo modelo por empresa y empleado.

## Modo operativo

- taskId: TASK-002
- taskMode: code
- reviewMode: standard
- sourceTask: docs/rrhh-consolidacion/TASK-002-empleados-y-fichajes-canonicos.md

## Contexto previo obligatorio

- `TASK-001` debe estar cerrada.
- Revisar los cambios cerrados en hub/ficha antes de tocar nuevas capas.
- Leer los apartados de empleados, fichajes, mi-panel y multiempresa del informe inicial.

## Scope IN

- Alta real de empleados.
- Edicion y estado de empleados.
- Multiempresa mediante `user_empresas`.
- Fichaje personal desde `mi-panel`.
- Supervision y correccion de fichajes desde RRHH.
- Local asignado, geolocalizacion y teletrabajo.

## Scope OUT

- Firmas.
- Reclutamiento.
- Accesos apps.
- Rehacer horarios completos.

## Restricciones

- `empleados.user_id` sigue siendo obligatorio.
- `user_empresas` es fuente canonica de pertenencia.
- No mover datos criticos a localStorage.
- No introducir nuevos mocks.

## Validacion requerida

- `npm run typecheck`.
- `npm run build`.
- Smoke alta empleado con email personal.
- Smoke alta multiempresa.
- Smoke cambio de estado.
- Smoke entrada, pausa, salida y fichaje manual.

## Dependencias

- `docs/rrhh-consolidacion/TASK-001-cierre-bloque-runtime-iniciado.md`.

## Inputs

- `src/features/rrhh/actions/empleados-actions.ts`.
- `src/features/rrhh/actions/fichajes-actions.ts`.
- `src/features/mi-panel/actions/mi-panel-actions.ts`.
- Migraciones `065`, `068`, `072`, `20260518000000`, `056`, `20260514130000`, `20260515100000`, `20260518110000`.

## Outputs esperados

- Flujo canonico documentado por codigo.
- Correcciones runtime necesarias.
- Lista de gaps no bloqueantes para fases posteriores.

## Riesgos conocidos

- Doble via RRHH/mi-panel puede divergir.
- `profiles` usa patrones historicos `id` y `user_id`; verificar query real antes de tocar.
- Estados de fichajes deben respetar constraints vigentes.

## Artefactos relacionados

- `docs/rrhh-consolidacion/TASK-002-empleados-y-fichajes-canonicos.md`.
- `docs/PLAN_RRHH_CONSOLIDACION_2026-05-20.md`.

## Paths del proyecto

- `src/app/(main)/rrhh/empleados/page.tsx`
- `src/app/(main)/rrhh/empleados/[id]/page.tsx`
- `src/features/rrhh/components/empleados/EmpleadosView.tsx`
- `src/features/rrhh/actions/empleados-actions.ts`
- `src/features/rrhh/actions/fichajes-actions.ts`
- `src/features/mi-panel/actions/mi-panel-actions.ts`
- `src/app/api/cron/cerrar-fichajes-huerfanos/route.ts`

## Agentes recomendados

- ejecutor.
- detective si aparece divergencia de esquema.
- qa-gate al final.

## Checklist de cierre

- Empleado creado tiene auth user, profile, role, user_empresas y empleado.
- Baja temporal/definitiva exige fecha cuando aplica.
- Fichaje personal y RRHH escriben campos compatibles.
- Historial RRHH y mi-panel leen el mismo empleado.
- Errores criticos se muestran de forma accionable.

## Modelo de datos propuesto

Mantener:

- `empleados.user_id` como enlace a usuario.
- `empleados.empresa_id` como empresa principal.
- `user_empresas` como accesos.
- `fichajes.empleado_id` como user id del empleado segun implementacion actual.

## Interfaces publicas propuestas

- `createEmpleado(input)`
- `updateEmpleado(id, updates)`
- `setEmpleadoEstado(input)`
- `listEmpleados()`
- `ficharEntradaPersonal()`
- `ficharSalidaPersonal(fichajeId)`
- `crearFichajeManual(input)`
- `listFichajesEmpleado(empleadoId, rango?)`

## Flujo operativo esperado

1. Confirmar contrato de identidad.
2. Corregir divergencias entre RRHH y mi-panel.
3. Validar multiempresa.
4. Validar fichajes y cierres.

## Notas tecnicas

Si aparece una incompatibilidad real de esquema, parar y documentar antes de improvisar migracion.

## Siguiente paso sugerido

Ejecutar `TASK-003-horarios-y-solicitudes-discovery.md`.

## Resultado validado


## Duracion real


## Ruta canonica

docs/rrhh-consolidacion/Full-TASK-002-empleados-y-fichajes-canonicos.md
