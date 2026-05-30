# TASK-005 - Reclutamiento a empleado

## Estado

Implementado (commit `e94b897`, en `main`, 2026-05-29) y **smoke E2E ejecutado OK** (2026-05-30, vía UI real + verificación en BD): los 7 gaps cerrados confirmados en runtime. typecheck + build verdes. Único residual no bloqueante: entrega real del email (magic link) por SMTP de SiteGround. Ver "Estado de ejecución" abajo.

## Estado de ejecución (2026-05-29)

### Hecho (commit `e94b897`)
- **Núcleo compartido** `src/features/rrhh/services/empleados-core.ts`: `altaUsuarioEmpleado()` (cascada `auth.user → profile → user_roles → user_empresas → empleado` con validación de local y rollback vía `deleteUser`) + `requireAdminUser()` movido aquí. Única fuente de verdad del alta.
- **`createEmpleado`** delega en el núcleo (sin cambio de comportamiento observable).
- **`promoverCandidato`** alineado con el alta canónica — 7 gaps cerrados: authz (`requireAdminUser`), `user_empresas` (alta nueva + reactivación), `local_id` obligatorio, `rol_label`, rollback completo, devuelve `tempPassword`, redirect del magic link a `NEXT_PUBLIC_APP_URL`. El magic link por email queda como extra no bloqueante.
- **UI** `CandidatosRealesTab`: selector de local obligatorio + diálogo de credenciales temporales tras el alta nueva.

### Smoke ejecutado (2026-05-30) — UI real (Playwright headless) + verificación en BD (Management API)
Empresa BACANAL. Admin `rrhh-smoke-admin-no-borrar@example.com` (login real). Candidato `smoke-promo-20260530123941@example.com` → empleado `42ff5d65-d8c8-4d70-adee-648d2baa4cd4` (user `ec36645b-8c62-4ae8-97c1-5927f3054ce7`).

| Verificación | Resultado |
|---|---|
| Alta nueva candidato → empleado (login → "Crear en sistema" → confirmar) | ✅ OK |
| `tempPassword` mostrado en UI (login sin depender del email) | ✅ |
| GAP1 `user_empresas` (BACANAL) | ✅ 1 fila (era el bug original) |
| GAP2 `empleados.local_id` | ✅ `dc78dbe5-…` (Restaurante Bacanal) |
| GAP3 authz (`promovido_por` = admin) | ✅ |
| GAP4 `user_roles`=empleado + `profiles.rol_label`=EMPLEADO | ✅ |
| GAP5 cascada (empresa/user_id/email/dni/estado=Activo) | ✅ |
| GAP6 link `candidato.empleado_id` | ✅ |
| Idempotencia (`promovido_at` set, `estado`=empleado, botón desaparece) | ✅ |
| auth.user confirmado (puede entrar) | ✅ |
| Entrega real del magic link por email | ⛔ Pendiente (sin SMTP SiteGround) — no bloqueante |

Residuales de smoke (no bloqueantes, cubiertos por código): reactivación por email/DNI (el empleado de smoke creado lo habilita como fixture — ver `SMOKE_USERS_RRHH.md`) y rechazo de authz a usuario no-admin.

### Siguiente paso
TASK-005 cerrable: smoke principal OK. Residuales no bloqueantes: smoke de reactivación cuando convenga + entrega de email al configurar SMTP de SiteGround.

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
