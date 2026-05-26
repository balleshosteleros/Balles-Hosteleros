# TASK-003 - Horarios y solicitudes discovery

## Estado

✅ Cerrada 2026-05-26. Resultado en [DISCOVERY_TASK003_2026-05-26.md](./DISCOVERY_TASK003_2026-05-26.md).

Conclusión: **solicitudes** puede cerrarse independientemente. **Horarios** tiene gap crítico — `rrhh_turnos`/`rrhh_cuadrantes`/`rrhh_descansos` sin migración versionada. Discovery deriva una TASK-007 nueva (migración + seed alineado) que debe ejecutarse antes de runtime de planificación.

## Objetivo

Verificar el modelo real de horarios y solicitudes antes de tocar runtime sensible: empleado -> patron -> asignacion -> calendario -> fichaje -> solicitud.

## Modo operativo

- taskId: TASK-003
- taskMode: discovery
- reviewMode: standard
- sourcePlan: docs/rrhh-consolidacion/EXECUTION_PLAN.md

## Scope IN

- Auditar tablas y acciones de `tipos_ausencia`, `tipos_fichaje`, `rrhh_patrones`, `rrhh_patron_semanas` y `rrhh_patron_empleados`.
- Revisar `src/features/rrhh/actions/patrones-actions.ts`.
- Revisar `src/features/rrhh/actions/horarios-config-actions.ts`.
- Verificar si existen migraciones versionadas para `rrhh_turnos`, `rrhh_cuadrantes` y `rrhh_descansos`, usadas por actions.
- Revisar solicitudes personales en `src/features/mi-panel/actions/mi-panel-actions.ts` y `src/features/rrhh/components/solicitudes/SolicitudesView.tsx`.
- Proponer cambios runtime o migraciones solo si el discovery demuestra el gap.

## Scope OUT

- Implementar runtime en esta task salvo correcciones triviales autorizadas por el ejecutor.
- Rehacer el calendario completo.
- Mezclar solicitudes con firmas o reclutamiento.

## Criterio de corte

Queda documentado si el modelo actual permite cerrar horarios/solicitudes con el esquema existente o si hace falta una task posterior de implementacion/migracion.

Debe quedar una respuesta explicita para estas tablas:

- `rrhh_turnos`
- `rrhh_cuadrantes`
- `rrhh_descansos`

## Dependencias

- `TASK-001-cierre-bloque-runtime-iniciado.md`.

## Validacion esperada por ejecutor

- Revisión estatica de paths indicados.
- Matriz de gaps y propuesta de siguiente task si procede.
