# TASK-004 - Firmas hardening operativo

## Estado

Pendiente.

## Objetivo

Auditar y cerrar el plan de hardening de firmas antes de declararlo submodulo consolidado.

## Modo operativo

- taskId: TASK-004
- taskMode: discovery
- reviewMode: standard
- sourcePlan: docs/rrhh-consolidacion/EXECUTION_PLAN.md

## Scope IN

- Revisar `src/features/rrhh/actions/firmas-actions.ts`.
- Revisar servicios de firma en `src/features/rrhh/services/firmas/`.
- Revisar cron `src/app/api/cron/firmas-expirar/route.ts`.
- Verificar contratos de storage, PDF, hash, token, OTP, eventos, expiracion y permisos por empresa.
- Proponer checklist de smoke controlado y variables requeridas.

## Scope OUT

- Implementar firma electronica avanzada no existente.
- Cambiar modelo legal sin aprobacion explicita.
- Tocar `accesos apps`.

## Criterio de corte

Firmas queda clasificado con gaps concretos, smokes requeridos y condiciones de seguridad/operacion para pasar a runtime.

## Dependencias

- `TASK-001-cierre-bloque-runtime-iniciado.md`.

## Validacion esperada por ejecutor

- Revisión estatica.
- Checklist de entorno y smoke sin exponer secretos.
