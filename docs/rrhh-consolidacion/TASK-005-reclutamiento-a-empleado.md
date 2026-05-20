# TASK-005 - Reclutamiento a empleado

## Estado

Pendiente condicionado.

## Objetivo

Conectar reclutamiento con el alta canonica de empleados sin duplicar identidad, permisos ni onboarding.

## Modo operativo

- taskId: TASK-005
- taskMode: code
- reviewMode: standard
- sourcePlan: docs/rrhh-consolidacion/EXECUTION_PLAN.md

## Scope IN

- Revisar vacantes, candidatos, portal publico y promocion.
- Verificar migraciones/storage esperados por candidatura publica: `candidaturas_rate_limit`, bucket `cvs-candidatos` y columnas modernas de `vacantes`/`candidatos`.
- Alinear `promoverCandidato()` con el contrato vigente de `createEmpleado()`.
- Confirmar que profile, `user_roles`, `user_empresas`, `empleados.user_id` y notificaciones quedan coherentes.
- Conservar deteccion de duplicados por email/DNI y reactivacion.

## Scope OUT

- Rehacer el kanban de reclutamiento.
- Crear nuevo sistema de onboarding completo.
- Mezclar con accesos apps.

## Criterio de corte

Un candidato seleccionado puede convertirse en empleado usando el contrato canonico de identidad y pertenencia, sin romper multiempresa ni generar duplicados.

## Dependencias

- `TASK-002-empleados-y-fichajes-canonicos.md`.
- No debe haber bloqueo transversal de auth/service-role detectado en `TASK-004`.

## Validacion esperada por ejecutor

- `npm run typecheck`
- `npm run build`
- Smoke manual candidato -> empleado en entorno controlado.
