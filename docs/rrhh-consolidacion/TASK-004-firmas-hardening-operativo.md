# TASK-004 - Firmas hardening operativo

## Estado

✅ Cerrada 2026-05-26. Resultado en [DISCOVERY_TASK004_2026-05-26.md](./DISCOVERY_TASK004_2026-05-26.md).

Conclusión: el módulo está al **~95%** implementado (PRP-036 fases 1–7 todas presentes). Bloqueadores reales para runtime: **4 variables de entorno faltan en `.env.local`** (`FIRMA_TOKEN_PEPPER`, `FIRMA_OTP_PEPPER`, `RESEND_API_KEY`, `NEXT_PUBLIC_APP_URL`). Además se detectan **3 race conditions concretas** (token consumido tardío, hash chain por timestamp, OTP por created_at) y mejoras menores de robustez. Discovery deriva TASK-008 (firmas runtime hardening) con scope acotado: env vars + race fixes + smoke E2E S1–S12.

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
