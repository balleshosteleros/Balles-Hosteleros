# TASK-006 - Accesos apps exclusion y remediacion

## Estado

Pendiente fuera de ola.

## Objetivo

Dejar documentado que `accesos apps` no forma parte de la consolidacion principal de RRHH y preparar una remediacion separada de seguridad.

## Modo operativo

- taskId: TASK-006
- taskMode: discovery
- reviewMode: standard
- sourcePlan: docs/rrhh-consolidacion/EXECUTION_PLAN.md

## Scope IN

- Revisar `src/features/rrhh/actions/accesos-apps-actions.ts`.
- Revisar migraciones `060_accesos_apps.sql` y `20260517110000_accesos_apps_rls_tenant.sql`.
- Documentar riesgos de almacenamiento, revelado de credenciales, permisos y auditoria.
- Proponer plan separado de remediacion.

## Scope OUT

- No tocar runtime de accesos apps durante la consolidacion RRHH.
- No mover esta funcionalidad al nucleo de empleados/fichajes.
- No gestionar secretos reales.

## Criterio de corte

El equipo tiene una decision explicita: accesos apps queda excluido del plan principal y solo se retoma como frente de seguridad dedicado.

## Dependencias

- Ninguna bloqueante para RRHH.

## Validacion esperada por ejecutor

- Informe corto de riesgos y propuesta de remediacion separada.
