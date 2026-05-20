# Handoff de commits - RRHH consolidacion

Fecha de cierre: 2026-05-20
Repo: `Balles-Hosteleros`
Rama: `main`

Este documento resume, en orden real, lo que se ha hecho en cada commit de la sesion para que el siguiente desarrollador pueda retomar sin reconstruir contexto.

## 1. `1eb23f8` - `Align mi-panel fichajes with RRHH geo and telework rules _Fernando`

Objetivo:
- Alinear el fichaje personal con las reglas reales de RRHH.

Que se hizo:
- `src/features/mi-panel/actions/mi-panel-actions.ts`
- `src/features/mi-panel/components/FichajeBar.tsx`

Resultado:
- `mi-panel` deja de operar con una logica aislada.
- El fichaje personal respeta local asignado, geolocalizacion y teletrabajo igual que RRHH.

## 2. `78c92e6` - `Remove mock employee status and legacy ficha fallback in RRHH _Fernando`

Objetivo:
- Eliminar estados inventados y fallback legacy en la ficha de empleado.

Que se hizo:
- `src/app/(main)/rrhh/empleados/[id]/page.tsx`
- `src/features/rrhh/components/empleados/EmpleadosView.tsx`
- `src/features/rrhh/components/empleados/FichaEmpleadoHeader.tsx`
- `src/features/rrhh/components/empleados/FichaTabsContent.tsx`
- `src/features/rrhh/components/empleados/SubmoduloPorEmpleadoPlaceholder.tsx`
- `src/features/rrhh/components/empleados/empleado-ui.ts`

Resultado:
- El listado y la ficha dejan de fingir estados fijos.
- Los flujos criticos ya no dependen del mock de ficha heredado.

## 3. `f64caf8` - `Add employee status and labor management to RRHH ficha _Fernando`

Objetivo:
- Llevar la gestion basica del empleado a la ficha real.

Que se hizo:
- `src/app/(main)/rrhh/empleados/[id]/page.tsx`
- `src/features/rrhh/actions/empleados-actions.ts`
- `src/features/rrhh/components/empleados/FichaEmpleadoHeader.tsx`
- `src/features/rrhh/components/empleados/GestionEmpleadoCard.tsx`

Resultado:
- Se pueden editar `departamento`, `puesto` y `notas`.
- Se puede cambiar `estado`.
- La baja exige `fecha_baja`.
- Se puede eliminar el registro de `empleados`.
- Las actions revalidan la ficha individual tras guardar.

## 4. `eb45552` - `Add employee local and telework management to RRHH ficha _Fernando`

Objetivo:
- Alinear la ficha con la asignacion de local principal y teletrabajo.

Que se hizo:
- `src/app/(main)/rrhh/empleados/[id]/page.tsx`
- `src/features/rrhh/components/empleados/GestionEmpleadoCard.tsx`

Resultado:
- La ficha permite editar `local_id`.
- La ficha permite editar `permite_teletrabajo`.

## 5. `aed56de` - `Align RRHH multiempresa access and manual fichajes _Fernando`

Objetivo:
- Consolidar multiempresa y corregir el fichaje manual.

Que se hizo:
- `src/app/(main)/rrhh/empleados/[id]/page.tsx`
- `src/features/rrhh/actions/empleados-actions.ts`
- `src/features/rrhh/actions/fichajes-actions.ts`
- `src/features/rrhh/components/empleados/GestionEmpleadoCard.tsx`

Resultado:
- Se puede editar el acceso multiempresa real via `user_empresas`.
- La empresa principal del empleado queda protegida.
- `crearFichajeManual()` guarda `pausa_inicio` y `pausa_fin` en ISO.
- `horas_totales` del fichaje manual descuenta la pausa cuando existe.

## 6. `f507401` - `Improve RRHH fichaje supervision and incident resolution _Fernando`

Objetivo:
- Dar supervision util a RRHH sobre las incidencias de fichajes.

Que se hizo:
- `src/features/rrhh/actions/fichajes-actions.ts`
- `src/features/rrhh/components/fichajes/FichajesView.tsx`

Resultado:
- Las filas de incidencias son clicables y abren el detalle del fichaje.
- RRHH puede editar observaciones del fichaje.
- RRHH puede resolver una incidencia cerrandola y marcando el fichaje como `completado`.

## 7. `70a26d1` - `Use real RRHH fichajes data for export and canonical IO states _Fernando`

Objetivo:
- Evitar que la exportacion de fichajes use un dataset mock y alinear el IO con el contrato real.

Que se hizo:
- `src/features/rrhh/components/fichajes/FichajesView.tsx`
- `src/features/rrhh/io/fichajes.io.ts`

Resultado:
- La exportacion usa los fichajes que la vista ya ha cargado de verdad.
- El IO de fichajes solo acepta estados canonicamente vigentes:
  - `pendiente`
  - `trabajando`
  - `pausa`
  - `completado`

## Estado actual

- `lint`: OK
- `typecheck`: OK
- `build`: OK
- El arbol quedo limpio al final de la sesion.

## Bloqueo para smoke completo

No se pudo cerrar un smoke funcional real del flujo completo porque:
- no habia credenciales de prueba en `.env.local`
- el bypass local de UI no salta el middleware privado para `/rrhh` y `/mi-panel`

Para el siguiente paso, el smoke necesita:
- credenciales reales con acceso a RRHH y al menos un empleado para `mi-panel`, o
- autorizacion para crear un usuario temporal de smoke y limpiarlo despues

