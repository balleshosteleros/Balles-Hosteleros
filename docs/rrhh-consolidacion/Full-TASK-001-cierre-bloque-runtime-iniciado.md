# Full-TASK-001 - Cierre bloque runtime iniciado

## Estado

En curso. Esta task continua cambios runtime ya existentes.

## Objetivo

Cerrar el bloque Fase 0/Fase 1 y Fases 2-4 parcial ya iniciado: hub RRHH, dashboard server-side, ficha con datos reales, lecturas por empleado y correcciones de fichajes.

## Estimacion de complejidad

Media. El riesgo no es construir desde cero, sino no romper cambios no commiteados ni mezclar mocks con datos reales.

## Criterio de corte

El hub y la ficha funcionan como superficies reales; los fallbacks legacy quedan honestamente marcados; fichajes por empleado y solicitudes leen datos reales; las diferencias entre cierre de huerfanos en `mi-panel` y cron quedan resueltas contra la constraint vigente.

## Modo operativo

- taskId: TASK-001
- taskMode: code
- reviewMode: standard
- sourceTask: docs/rrhh-consolidacion/TASK-001-cierre-bloque-runtime-iniciado.md

## Contexto previo obligatorio

- Leer `docs/INFORME_RRHH_EVALUACION_INICIAL_2026-05-20.md`.
- Leer `docs/PLAN_RRHH_CONSOLIDACION_2026-05-20.md`.
- Leer `docs/rrhh-consolidacion/EXECUTION_PLAN.md`.
- Revisar `git status` antes de editar; hay cambios runtime en curso que no se deben revertir.

## Scope IN

- Revisar `/rrhh` como hub real.
- Revisar agregados de dashboard.
- Revisar ficha individual con perfil, empresas, fichajes, solicitudes, firmas y horario.
- Revisar mapeos de datos reales a componentes heredados.
- Revisar consistencia de estados de fichaje huerfano.

## Scope OUT

- No ampliar firmas, reclutamiento ni accesos apps.
- No redisenar todo RRHH.
- No reemplazar componentes legacy que solo sirven como placeholders no criticos.

## Restricciones

- No revertir cambios existentes.
- No usar mocks como fuente de verdad funcional.
- No instalar dependencias.
- No tocar `.env`.

## Validacion requerida

- `npm run typecheck`.
- `npm run build`.
- Smoke manual de `/rrhh`.
- Smoke manual de `/rrhh/empleados/[id]` con empleado real.
- Confirmar que empty states no simulan datos.
- Confirmar que `fichajes.estado` solo persiste valores permitidos por `056_fichajes.sql`.

## Dependencias

- Ninguna task previa.

## Inputs

- `docs/PLAN_RRHH_CONSOLIDACION_2026-05-20.md`.
- Cambios runtime actuales en hub, actions y ficha.
- Esquema de `empleados`, `fichajes`, `solicitudes_personal`, `rrhh_patron_empleados` y `firmas_documentos`.

## Outputs esperados

- Bloque runtime cerrado.
- Checkpoint recomendable de commit.
- Nota breve de cualquier gap que pase a `TASK-002` o `TASK-003`.

## Riesgos conocidos

- `FichaTabsContent.tsx` conserva fallback heredado.
- `src/features/rrhh/data/rrhh.ts` sigue existiendo y no debe confundirse con verdad funcional.
- `FichajesView` y resumen de `mi-panel` deben contar incidencias desde `fichajes.incidencia`, no desde un estado fuera de constraint.

## Artefactos relacionados

- `docs/rrhh-consolidacion/EXECUTION_PLAN.md`.
- `docs/rrhh-consolidacion/TASK-001-cierre-bloque-runtime-iniciado.md`.

## Paths del proyecto

- `src/app/(main)/rrhh/page.tsx`
- `src/features/rrhh/actions/dashboard-actions.ts`
- `src/app/(main)/rrhh/empleados/[id]/page.tsx`
- `src/features/rrhh/actions/empleados-actions.ts`
- `src/features/rrhh/actions/fichajes-actions.ts`
- `src/features/mi-panel/actions/mi-panel-actions.ts`
- `src/features/rrhh/components/empleados/FichaTabsContent.tsx`
- `src/features/rrhh/components/fichajes/FichajesView.tsx`
- `src/features/rrhh/data/fichajes.ts`
- `src/app/api/cron/cerrar-fichajes-huerfanos/route.ts`

## Agentes recomendados

- ejecutor para cierre runtime.
- qa-gate para validar el checkpoint.

## Checklist de cierre

- Hub muestra metricas reales o ceros honestos.
- Ficha no bloquea si no hay datos secundarios.
- Fichajes por empleado consultan por `empleado.user_id`.
- Solicitudes por empleado consultan por `user_id`.
- Horario actual lee patron activo o muestra ausencia real de patron.
- Cron y autocierre de `mi-panel` no escriben estados invalidos.
- Incidencias se muestran por campo `incidencia`.
- No queda claim de Fase 2-4 completa si solo esta parcial.

## Modelo de datos propuesto

No aplica en esta task salvo correcciones menores. Mantener contratos actuales.

## Interfaces publicas propuestas

- `getRrhhDashboard()`
- `getEmpleadoConPerfil(empleadoId)`
- `listFichajesEmpleado(empleadoId, rango?)`
- `listSolicitudesEmpleado(empleadoId)`
- `getEmpleadoHorarioActual(empleadoId)`

## Flujo operativo esperado

1. Revisar cambios existentes.
2. Corregir inconsistencias sin ampliar alcance.
3. Ejecutar validaciones.
4. Recomendar commit de checkpoint.

## Notas tecnicas

El objetivo es cerrar un punto limpio de rollback antes de continuar con consolidaciones mas profundas.

## Siguiente paso sugerido

Ejecutar `TASK-002-empleados-y-fichajes-canonicos.md`.

## Resultado validado


## Duracion real


## Ruta canonica

docs/rrhh-consolidacion/Full-TASK-001-cierre-bloque-runtime-iniciado.md
