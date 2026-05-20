# Full-TASK-003 - Horarios y solicitudes discovery

## Estado

Pendiente.

## Objetivo

Verificar si horarios y solicitudes pueden consolidarse con el modelo actual o si requieren una task posterior de implementacion/migracion.

## Estimacion de complejidad

Media-alta. Hay backend real, pero falta demostrar trazabilidad completa.

## Criterio de corte

Queda una matriz clara de modelo actual, gaps, riesgos y siguiente task recomendada.

## Modo operativo

- taskId: TASK-003
- taskMode: discovery
- reviewMode: standard
- sourceTask: docs/rrhh-consolidacion/TASK-003-horarios-y-solicitudes-discovery.md

## Contexto previo obligatorio

- Leer `docs/PLAN_RRHH_CONSOLIDACION_2026-05-20.md`.
- Revisar `TASK-001` cerrada.
- No hacer runtime salvo correcciones triviales explicitamente decididas.

## Scope IN

- Patrones, semanas y asignaciones.
- Turnos, cuadrantes y descansos, especialmente si las actions apuntan a tablas sin migracion versionada localizada.
- Tipos de ausencia y fichaje.
- Solicitudes personales empleado/RRHH.
- Calendario mensual de mi-panel.
- Relacion entre solicitud aprobada y reflejo operativo.

## Scope OUT

- Implementacion de calendario completo.
- Redisenar UI de horarios.
- Mezclar firmas o reclutamiento.

## Restricciones

- Discovery primero, codigo despues.
- No inventar tablas nuevas sin evidencia.
- No asumir que un componente visible implica flujo cerrado.

## Validacion requerida

- Revision estatica de migrations/actions/components.
- Documento de gaps.
- Si hay propuesta de runtime posterior, debe incluir paths y criterio de corte.

## Dependencias

- `docs/rrhh-consolidacion/TASK-001-cierre-bloque-runtime-iniciado.md`.

## Inputs

- `supabase/migrations/085_horarios_tipos_ausencia_y_fichaje.sql`.
- `supabase/migrations/20260515150000_rrhh_patrones.sql`.
- `supabase/migrations/050_mi_panel_solicitudes.sql`.
- `src/features/rrhh/actions/patrones-actions.ts`.
- `src/features/rrhh/actions/horarios-config-actions.ts`.
- `src/features/rrhh/actions/turnos-actions.ts`.
- `src/features/rrhh/actions/descansos-actions.ts`.
- `src/features/mi-panel/actions/mi-panel-actions.ts`.
- `src/features/rrhh/components/solicitudes/SolicitudesView.tsx`.

## Outputs esperados

- Matriz `tabla/accion/UI/estado/gap`.
- Decision: implementar con esquema actual o crear migracion/task nueva.
- Riesgos de multiempresa y RLS.

## Riesgos conocidos

- El tab de horarios de ficha aun puede mostrar informacion heredada.
- `turnos-actions.ts` usa `rrhh_turnos` y `rrhh_cuadrantes`; `descansos-actions.ts` usa `rrhh_descansos`. Hay que confirmar migraciones/versionado antes de runtime.
- Solicitudes aprobadas se reflejan en calendario personal, pero no necesariamente en planificacion RRHH completa.
- Patrones pueden estar activos sin asignacion suficiente.

## Artefactos relacionados

- `docs/rrhh-consolidacion/TASK-003-horarios-y-solicitudes-discovery.md`.

## Paths del proyecto

- `src/app/(main)/rrhh/horarios/page.tsx`
- `src/app/(main)/rrhh/solicitudes/page.tsx`
- `src/features/rrhh/components/horarios/HorariosView.tsx`
- `src/features/rrhh/components/solicitudes/SolicitudesView.tsx`
- `src/features/rrhh/actions/patrones-actions.ts`
- `src/features/rrhh/actions/horarios-config-actions.ts`
- `src/features/rrhh/actions/turnos-actions.ts`
- `src/features/rrhh/actions/descansos-actions.ts`
- `src/features/mi-panel/actions/mi-panel-actions.ts`

## Agentes recomendados

- detective para contrastar esquema.
- planificador si se deriva una task nueva.
- ejecutor solo despues del discovery.

## Checklist de cierre

- Cadena empleado -> patron verificada.
- Cadena solicitud -> aprobacion -> calendario verificada.
- Gaps con RLS/multiempresa documentados.
- Decision de runtime posterior tomada.

## Modelo de datos propuesto

No fijar cambios hasta completar discovery. Modelo candidato:

- `rrhh_patrones`
- `rrhh_patron_semanas`
- `rrhh_patron_empleados`
- `rrhh_turnos` si existe o se aprueba migracion
- `rrhh_cuadrantes` si existe o se aprueba migracion
- `rrhh_descansos` si existe o se aprueba migracion
- `tipos_ausencia`
- `tipos_fichaje`
- `solicitudes_personal`

## Interfaces publicas propuestas

- `listPatrones()`
- `getEmpleadosPorTurno()`
- `listTiposAusencia()`
- `listTiposFichaje()`
- `crearSolicitudPersonal(input)`
- `listarSolicitudesEmpresa(filtro)`
- `aprobarSolicitud(id, notas?)`
- `rechazarSolicitud(id, notas?)`

## Flujo operativo esperado

1. Mapear tablas y acciones.
2. Contrastar UI actual.
3. Detectar gaps.
4. Emitir propuesta de siguiente task.

## Notas tecnicas

Esta task protege de construir sobre supuestos. Si el modelo ya basta, la siguiente task debe ser mas pequena y concreta.

## Siguiente paso sugerido

Si el discovery queda verde, crear task de runtime para cerrar horarios/solicitudes.

## Resultado validado


## Duracion real


## Ruta canonica

docs/rrhh-consolidacion/Full-TASK-003-horarios-y-solicitudes-discovery.md
