# TASK-001 - Cierre bloque runtime iniciado

## Estado

En curso. Hay cambios runtime existentes que esta task debe cerrar, no revertir.

## Objetivo

Cerrar el primer bloque ya implementado parcialmente: baseline, hub `/rrhh`, dashboard server-side, ficha de empleado con datos reales, lecturas por empleado y correcciones de fichajes.

## Modo operativo

- taskId: TASK-001
- taskMode: code
- reviewMode: standard
- sourcePlan: docs/rrhh-consolidacion/EXECUTION_PLAN.md

## Scope IN

- Revisar coherencia del hub `src/app/(main)/rrhh/page.tsx`.
- Revisar contrato de `src/features/rrhh/actions/dashboard-actions.ts`.
- Revisar ficha real en `src/app/(main)/rrhh/empleados/[id]/page.tsx`.
- Revisar lecturas por empleado en `empleados-actions.ts` y `fichajes-actions.ts`.
- Alinear fallback legacy de `FichaTabsContent.tsx` para que no finja datos reales.
- Cerrar discrepancias entre cierre de fichajes huerfanos en `mi-panel` y cron.
- Alinear `FichajesView` y `ResumenTiles` con incidencias reales por campo `incidencia`, no por estado inventado.

## Scope OUT

- Rehacer UI de RRHH desde cero.
- Ampliar firmas, horarios o reclutamiento mas alla de lo ya conectado.
- Tocar `accesos apps`.

## Criterio de corte

El bloque iniciado queda listo para checkpoint: el hub y la ficha muestran datos reales cuando existen, los fallbacks son honestos, y las correcciones de fichajes respetan el esquema vigente.

## Dependencias

- Ninguna task previa.

## Validacion esperada por ejecutor

- `npm run typecheck`
- `npm run build`
- Smoke manual de `/rrhh`, `/rrhh/empleados` y `/rrhh/empleados/[id]` con empleado real.
- Verificar cron de fichajes huerfanos contra constraint de `supabase/migrations/056_fichajes.sql`.
