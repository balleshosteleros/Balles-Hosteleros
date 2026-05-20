# Execution Plan - RRHH consolidacion

Fecha: 2026-05-20
Repo: `Balles-Hosteleros`
Plan origen: `docs/PLAN_RRHH_CONSOLIDACION_2026-05-20.md`
Informe base: `docs/INFORME_RRHH_EVALUACION_INICIAL_2026-05-20.md`

## Proposito

Este directorio convierte la consolidacion de RRHH en contratos ejecutables para el siguiente agente. No es una reescritura del modulo ni una orden de tocar runtime inmediatamente.

El corte definitivo es:

- cerrar primero el bloque runtime que ya esta en curso
- separar el nucleo empleados/fichajes de los frentes sensibles
- hacer discovery donde el modelo aun no esta suficientemente verificado
- mantener `accesos apps` fuera de la consolidacion principal de RRHH

## Estado real de partida

Hay cambios runtime no commiteados en curso que deben tratarse como base de continuidad, no como algo a revertir:

- `src/app/(main)/rrhh/page.tsx`: hub RRHH ya implementado con `getRrhhDashboard()`.
- `src/features/rrhh/actions/dashboard-actions.ts`: lectura agregada server-side para metricas, alertas y altas recientes.
- `src/app/(main)/rrhh/empleados/[id]/page.tsx`: ficha de empleado ya carga perfil, empresas, fichajes, solicitudes y horario actual reales.
- `src/features/rrhh/actions/empleados-actions.ts`: lecturas nuevas por empleado para solicitudes y horario actual, mas flujo de alta/estado existente.
- `src/features/rrhh/actions/fichajes-actions.ts`: lecturas por empleado y registro manual ajustados al esquema real de `fichajes`.
- `src/features/mi-panel/actions/mi-panel-actions.ts`: ajustes parciales en fichajes personales y cierre de huerfanos.
- `src/features/rrhh/components/empleados/FichaTabsContent.tsx`: tabs de fichajes, solicitudes y horarios aceptan datos reales, pero aun conservan fallback heredado.
- `src/app/api/cron/cerrar-fichajes-huerfanos/route.ts`: debe quedar alineado con la constraint real de `fichajes.estado`; las incidencias viven en `fichajes.incidencia`, no como estado persistido.
- `src/features/rrhh/data/fichajes.ts` y `src/features/rrhh/components/fichajes/FichajesView.tsx`: deben aceptar estados reales de BD (`trabajando`, `pausa`, `completado`) y detectar incidencias por campo `incidencia`.

Validaciones ya ejecutadas durante el primer bloque:

- `npm run typecheck`: pasa.
- `npm run build`: pasa.
- Avisos no bloqueantes observados en build: `metadataBase` no configurado y edge runtime desactiva static generation en paginas afectadas.

Por tanto, este plan no empieza desde cero. La primera tarea es cerrar y validar documentalmente ese bloque, no volver a planificarlo como pendiente.

## TASKs

| Task | Full-TASK | Modo | Estado inicial | Corte |
| --- | --- | --- | --- | --- |
| `TASK-001-cierre-bloque-runtime-iniciado.md` | `Full-TASK-001-cierre-bloque-runtime-iniciado.md` | code | en curso | Cerrar Fase 0/Fase 1 y Fases 2-4 parcial ya tocadas: hub, dashboard actions, ficha real, lecturas por empleado y correcciones de fichajes. |
| `TASK-002-empleados-y-fichajes-canonicos.md` | `Full-TASK-002-empleados-y-fichajes-canonicos.md` | code | pendiente | Consolidar empleados, ficha y fichajes/mi-panel como nucleo canonico empleado-supervisor sin mocks en flujos criticos. |
| `TASK-003-horarios-y-solicitudes-discovery.md` | `Full-TASK-003-horarios-y-solicitudes-discovery.md` | discovery | pendiente | Verificar modelo empleado -> patron -> calendario -> solicitud antes de ampliar runtime. |
| `TASK-004-firmas-hardening-operativo.md` | `Full-TASK-004-firmas-hardening-operativo.md` | discovery | pendiente | Auditar firmas como submodulo sensible: storage, tokens, OTP, eventos, cron, permisos y smokes requeridos. |
| `TASK-005-reclutamiento-a-empleado.md` | `Full-TASK-005-reclutamiento-a-empleado.md` | code | pendiente condicionado | Conectar reclutamiento con el alta canonica de empleados sin duplicar identidad, permisos ni onboarding. |
| `TASK-006-accesos-apps-exclusion-y-remediacion.md` | `Full-TASK-006-accesos-apps-exclusion-y-remediacion.md` | discovery | pendiente fuera de ola | Documentar exclusion del plan RRHH principal y preparar remediacion separada de seguridad. |

## Orden operativo

1. Ejecutar `TASK-001` solo para cerrar el bloque ya iniciado, respetando los cambios runtime existentes.
2. Hacer checkpoint de commit cuando `TASK-001` quede validada por el ejecutor.
3. Ejecutar `TASK-002` sobre la base ya cerrada.
4. Ejecutar `TASK-003` antes de cualquier cambio runtime profundo en horarios/solicitudes.
5. Ejecutar `TASK-004` antes de tratar firmas como cerrado funcionalmente.
6. Ejecutar `TASK-005` solo despues de estabilizar empleados y confirmar el contrato de promocion.
7. Mantener `TASK-006` fuera del hilo principal salvo que el usuario pida remediacion de seguridad.

## Dependencias

- `TASK-001` no depende de nuevas decisiones: es cierre de lo ya iniciado.
- `TASK-002` depende de `TASK-001`.
- `TASK-003` depende de `TASK-001`; sus hallazgos pueden alimentar despues cambios de `TASK-002` o una task nueva.
- `TASK-004` depende de `TASK-001` para tener hub/ficha consistentes, pero no depende de `TASK-002`.
- `TASK-005` depende de `TASK-002` y de que `TASK-004` no detecte un bloqueo transversal de auth/service role.
- `TASK-006` no bloquea la consolidacion RRHH porque es una exclusion deliberada.

## Criterios globales de corte

- Ninguna task debe reintroducir `src/features/rrhh/data/rrhh.ts` como fuente funcional de verdad.
- Los tabs sin backend real deben mostrar acceso contextual o placeholder honesto, no simulacion de datos.
- `user_empresas` y `empleados.user_id` se mantienen como contratos canonicos.
- Los flujos que escriben datos criticos deben conservar try/catch y errores legibles.
- Las validaciones tecnicas recomendadas para ejecutores son `npm run typecheck` y `npm run build`, pero este trabajo documental no las ejecuta.
- Los crons y service-role se tratan como hardening operativo, no como detalle menor de UI.
- Si un build modifica `next-env.d.ts` por tooling (`.next/dev/types` vs `.next/types`), restaurarlo antes del checkpoint salvo que se decida versionar ese cambio.

## Fuera de alcance

- No editar runtime desde este plan documental.
- No ejecutar tests en esta pasada.
- No incluir `accesos apps` dentro del nucleo RRHH.
- No instalar dependencias.
- No hacer cambios en `.env`, `.next`, `node_modules` ni artefactos temporales.

## Decision de descomposicion

La primera version agrupaba demasiado: unia hub, ficha, empleados, fichajes, horarios, solicitudes, firmas y reclutamiento en cuatro bloques amplios. Esta version separa por riesgo y por madurez real:

- lo ya tocado queda en una task de cierre
- el nucleo laboral queda en una task de consolidacion
- horarios/solicitudes pasan primero por discovery porque el modelo existe pero la trazabilidad completa no esta probada
- firmas se aisla por seguridad, storage y auditoria
- reclutamiento se separa porque promociona identidades y debe alinearse con el alta canonica
- accesos apps queda explicitamente excluido del plan principal
