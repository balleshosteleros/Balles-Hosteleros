# TASK-002 - Empleados y fichajes canonicos

## Estado

Cerrada — smoke UI validado el 2026-05-25.

### Avance 2026-05-25

- `typecheck`: pasa ✅
- Revisión estática completa: `createEmpleado`, `handle_new_user`, form `/nuevo`, `fichajes-actions`, `mi-panel-actions` ✅
- Smoke listado `/rrhh/empleados` con empresa activa HABANA/BACANAL: validado (sesión anterior) ✅
- Smoke alta multiempresa + reentrada empleado: validado por UI real con alta, visibilidad en HABANA/BACANAL, login y `primer-acceso -> /mi-panel` ✅
- `npm run build`: pasa ✅
- Ajuste aplicado durante el smoke: `listEmpleados()` pasa a leer `empleados` y `user_empresas` con admin client + scope explícito para que la vista multiempresa no pierda accesos secundarios ✅

## Objetivo

Convertir empleados, ficha y fichajes/mi-panel en el nucleo canonico del modulo RRHH, sin depender de mocks en flujos criticos.

## Modo operativo

- taskId: TASK-002
- taskMode: code
- reviewMode: standard
- sourcePlan: docs/rrhh-consolidacion/EXECUTION_PLAN.md

## Scope IN

- Consolidar alta, edicion, estado y baja de empleados.
- Mantener `empleados.user_id` obligatorio y `user_empresas` como pertenencia multiempresa.
- Unificar lectura de fichaje actual, historial, pausas, incidencias y cierre manual entre RRHH y `mi-panel`.
- Alinear geolocalizacion, local asignado y teletrabajo entre acciones RRHH y acciones personales.
- Eliminar mocks de flujos funcionales criticos.

## Scope OUT

- Firmas, reclutamiento y accesos apps.
- Redisenar todo el submodulo de horarios.
- Migraciones no justificadas por una causa raiz confirmada.

## Criterio de corte

Un empleado real puede darse de alta, aparecer en listado/ficha, fichar desde `mi-panel`, ser supervisado o corregido desde RRHH y conservar trazabilidad por empresa.

## Dependencias

- `TASK-001-cierre-bloque-runtime-iniciado.md`.

## Validacion esperada por ejecutor

- `npm run typecheck`
- `npm run build`
- Smoke manual de alta empleado, cambio de estado, fichaje entrada/pausa/salida y fichaje manual RRHH.
