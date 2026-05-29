# TASK-005 - Reclutamiento a empleado

## Estado

Implementado (commit `e94b897`, en `main`, 2026-05-29). `npm run typecheck` y `npm run build` verdes. **Pendiente: smoke candidato → empleado en BACANAL** (el núcleo es testeable ya; solo la entrega real del magic link por email espera credenciales SMTP de SiteGround). Ver "Estado de ejecución" abajo.

## Estado de ejecución (2026-05-29)

### Hecho (commit `e94b897`)
- **Núcleo compartido** `src/features/rrhh/services/empleados-core.ts`: `altaUsuarioEmpleado()` (cascada `auth.user → profile → user_roles → user_empresas → empleado` con validación de local y rollback vía `deleteUser`) + `requireAdminUser()` movido aquí. Única fuente de verdad del alta.
- **`createEmpleado`** delega en el núcleo (sin cambio de comportamiento observable).
- **`promoverCandidato`** alineado con el alta canónica — 7 gaps cerrados: authz (`requireAdminUser`), `user_empresas` (alta nueva + reactivación), `local_id` obligatorio, `rol_label`, rollback completo, devuelve `tempPassword`, redirect del magic link a `NEXT_PUBLIC_APP_URL`. El magic link por email queda como extra no bloqueante.
- **UI** `CandidatosRealesTab`: selector de local obligatorio + diálogo de credenciales temporales tras el alta nueva.

### Pendiente — smoke candidato → empleado (BACANAL)
| Smoke | ¿Email/SMTP? | Estado sin credenciales |
|---|---|---|
| Alta nueva candidato → empleado (+ `tempPassword` visible) | No | ✅ Ejecutable |
| Idempotencia (candidato ya promovido / doble click) | No | ✅ Ejecutable |
| Duplicado por email/DNI → reactivación (+ backfill `user_empresas`) | No | ✅ Ejecutable |
| Coherencia `user_empresas` / `user_roles` / `empleados.user_id` / `local_id` | No | ✅ Ejecutable |
| Authz: usuario no admin/director no puede promover | No | ✅ Ejecutable |
| Login del empleado con `tempPassword` | No | ✅ Ejecutable |
| Entrega real del magic link por email | Sí | ⛔ Bloqueado hasta credenciales SMTP SiteGround |

### Siguiente paso
Correr el smoke en BACANAL (cuentas de `SMOKE_USERS_RRHH.md`) → escribir handoff → cerrar TASK-005 (o abrir task de onboarding si el smoke revela gap, según "Siguiente paso sugerido" del Full-TASK).

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
