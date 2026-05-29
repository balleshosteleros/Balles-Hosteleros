# Full-TASK-005 - Reclutamiento a empleado

## Estado

Implementado (commit `e94b897`, en `main`, 2026-05-29). typecheck + build verdes. Pendiente: smoke candidato → empleado en BACANAL (núcleo testeable ya; entrega del magic link por email espera credenciales SMTP de SiteGround). Detalle de ejecución y desglose del smoke en `TASK-005-reclutamiento-a-empleado.md`.

## Objetivo

Conectar reclutamiento con el alta canonica de empleados, evitando duplicados de usuario, profile, empleado o pertenencia multiempresa.

## Estimacion de complejidad

Alta. Toca auth, service role, candidatos, empleados, notificaciones y emails.

## Criterio de corte

Un candidato seleccionado puede convertirse en empleado siguiendo el contrato canonico de identidad y acceso.

## Modo operativo

- taskId: TASK-005
- taskMode: code
- reviewMode: standard
- sourceTask: docs/rrhh-consolidacion/TASK-005-reclutamiento-a-empleado.md

## Contexto previo obligatorio

- `TASK-002` debe estar cerrada.
- Confirmar que no hay bloqueo transversal de service role detectado en `TASK-004`.
- Revisar `createEmpleado()` antes de modificar `promoverCandidato()`.

## Scope IN

- Vacantes y candidatos reales.
- Candidatura publica, rate limit y storage de CVs.
- Promocion candidato -> empleado.
- Deteccion de duplicados por email/DNI.
- Reactivacion de empleado existente.
- Profile, `user_roles`, `user_empresas`, notificaciones y magic link.

## Scope OUT

- Rehacer kanban.
- Crear onboarding completo.
- Accesos apps.

## Restricciones

- No duplicar reglas de alta si se pueden reutilizar o alinear.
- No crear usuarios sin rollback.
- No saltarse pertenencia empresa.

## Validacion requerida

- `npm run typecheck`.
- `npm run build`.
- Smoke controlado de candidato seleccionado -> empleado.
- Verificar candidato ya promovido.
- Verificar duplicado por email/DNI.

## Dependencias

- `docs/rrhh-consolidacion/TASK-002-empleados-y-fichajes-canonicos.md`.
- `docs/rrhh-consolidacion/TASK-004-firmas-hardening-operativo.md` sin bloqueo transversal de auth/service-role.

## Inputs

- `src/features/rrhh/actions/reclutamiento-actions.ts`.
- `src/features/rrhh/actions/promocion-actions.ts`.
- `src/features/rrhh/actions/empleados-actions.ts`.
- `src/app/empleo/[slug]/page.tsx`.
- `src/app/api/empleo/candidatura/route.ts`.
- Migraciones y storage asociados a `vacantes`, `candidatos`, `candidaturas_rate_limit` y bucket `cvs-candidatos`.

## Outputs esperados

- Promocion alineada con alta canonica.
- Gaps de onboarding documentados.
- No duplicidad de identidad.

## Riesgos conocidos

- `promoverCandidato()` crea auth user y empleado por su cuenta.
- El codigo espera `candidaturas_rate_limit` y bucket `cvs-candidatos`; confirmar versionado y entorno antes de smoke.
- Puede faltar upsert de `user_empresas` si no esta alineado con `createEmpleado()`.
- Emails/magic link dependen de configuracion externa.

## Artefactos relacionados

- `docs/rrhh-consolidacion/TASK-005-reclutamiento-a-empleado.md`.

## Paths del proyecto

- `src/features/rrhh/actions/promocion-actions.ts`
- `src/features/rrhh/actions/reclutamiento-actions.ts`
- `src/features/rrhh/actions/candidatos-actions.ts`
- `src/features/rrhh/actions/vacantes-actions.ts`
- `src/features/rrhh/components/reclutamiento/CandidatosRealesTab.tsx`
- `src/features/rrhh/components/reclutamiento/ReclutamientoView.tsx`
- `src/app/api/empleo/candidatura/route.ts`

## Agentes recomendados

- ejecutor.
- detective para duplicados/auth.
- qa-gate para smoke final.

## Checklist de cierre

Código implementado (commit `e94b897`); cada punto queda **por verificar en el smoke**:

- Promocion idempotente. (código ✓ — lock CAS sobre `promovido_at`)
- Duplicados manejados. (código ✓ — email/DNI → reactivación)
- `user_empresas` coherente. (código ✓ — upsert en alta nueva y reactivación)
- `user_roles` coherente. (código ✓ — rol `empleado` vía núcleo)
- Candidato queda enlazado a empleado. (código ✓ — `candidatos.empleado_id`)
- Notificacion y magic link fallan sin romper alta. (código ✓ — try/catch; el alta ya usa `tempPassword`)

## Modelo de datos propuesto

Mantener:

- `candidatos.empleado_id`
- `candidatos.promovido_at`
- `empleados.user_id`
- `user_empresas`
- `user_roles`

## Interfaces publicas propuestas

- `promoverCandidato(input)`
- `createEmpleado(input)` como referencia canonica.
- `listVacantesConCandidatos(empresaSlug?)`

## Flujo operativo esperado

1. Comparar alta directa y promocion.
2. Alinear identidad y pertenencia.
3. Probar duplicados.
4. Validar notificaciones/magic link de forma controlada.

## Notas tecnicas

La promocion debe ser una extension del nucleo empleados, no un segundo sistema de alta.

## Siguiente paso sugerido

Cerrar reclutamiento como submodulo integrado o abrir task de onboarding si se detecta gap.

## Resultado validado

Implementado y validado en estático (typecheck + build verdes, commit `e94b897`). Smoke runtime candidato → empleado pendiente en BACANAL.

## Duracion real


## Ruta canonica

docs/rrhh-consolidacion/Full-TASK-005-reclutamiento-a-empleado.md
