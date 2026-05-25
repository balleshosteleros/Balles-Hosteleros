# Handoff RRHH sync y smoke - 2026-05-25

## Estado de cierre

Sesion cerrada tras absorber de forma selectiva los cambios de `origin/main` que afectaban a RRHH, validar por smoke el comportamiento de empresa activa en `/rrhh/empleados` y dejar una cuenta RRHH `no borrar` para futuros smokes.

Branch local actual: `rrhh-sync-origin-c4da3ca`
Branch remota publicada: `rrhh-sync-origin-c4da3ca-v2`
Repo: `https://github.com/balleshosteleros/Balles-Hosteleros.git`

## Cierre final

- `e0d06e7` `Sync RRHH selective upstream changes _Fernando`
- `0894eeb` `Document RRHH no-borrar smoke admin _Fernando`

## Que se hizo

### Sync selectivo de `origin/main`

Se integraron solo los cambios RRHH y dependencias directas, sin absorber el bundle completo remoto:

- `src/lib/supabase/get-context.ts`
  - `getAppContext()` pasa a seguir la empresa activa del selector, no solo `profiles.empresa_id`.
- `src/features/rrhh/actions/empleados-actions.ts`
  - deduplicacion multiempresa por `user_id`, priorizando la ficha de la empresa activa.
- `src/features/rrhh/components/empleados/EmpleadosView.tsx`
  - tabla y filtros alineados con el nuevo contrato multiempresa.
- `src/app/(main)/rrhh/cuestionarios/page.tsx`
- `src/app/(main)/calidad/cuestionarios/page.tsx`
- `src/features/calidad/components/cuestionarios/CuestionariosView.tsx`
- `src/features/calidad/data/cuestionarios.ts`
- `src/features/mi-panel/components/MisCuestionariosView.tsx`
  - compatibilidad de cuestionarios hacia `calidad`, manteniendo la ruta RRHH como punto de entrada.
- `src/features/rrhh/actions/pagos-actions.ts`
- `src/features/rrhh/components/pagos/PagosView.tsx`
- `src/features/rrhh/data/pagos.ts`
- `src/features/rrhh/io/pagos.io.ts`
  - bloque de pagos dejado compilable y visible como WIP, con empleados por empresa activa y filtro por area.
- `src/shared/hooks/use-tab-query.ts`
- `src/features/rrhh/components/AccesosView.tsx`
- `src/features/rrhh/components/salarios/SalariosView.tsx`
- `src/features/rrhh/components/solicitudes/SolicitudesView.tsx`
  - persistencia de tabs por query string.

Ruido eliminado:

- `next-env.d.ts` se restauro para no arrastrar ruido de tooling.

### Cuenta RRHH no borrar

Se creo y dejo operativa una cuenta persistente para smoke RRHH:

- email: `rrhh-smoke-admin-no-borrar@example.com`
- user_id: `9846be41-6a0e-4545-bf28-b0b792fc4fd0`

Estado confirmado:

- empresa principal: `HABANA`
- accesos: `HABANA`, `BACANAL`
- rol app: `director`
- `rol_label='DIRECTOR'`
- `es_empleado=false`

Documentacion actualizada en:

- `docs/rrhh-consolidacion/SMOKE_USERS_RRHH.md`

Nota:

- no se ha dejado la password en el repo;
- antes de reutilizar, resetear password si hace falta y mantener la cuenta como `no borrar`.

### Smoke ejecutado

Smoke validado con `next dev` local y navegador real:

- login con `rrhh-smoke-admin-no-borrar@example.com`: OK
- aterrizaje tras login: `/mis-departamentos`
- acceso a `/rrhh/empleados`: OK

Validacion de empresa activa:

- con empresa activa `HABANA` aparecen `Adrian Paz` y `Alberto Cielicka`
- con empresa activa `BACANAL` desaparecen esos registros de HABANA
- con empresa activa `BACANAL` aparecen `Borja Garrido` y `Albero Cieliczka`
- `Alejandro Mojica` aparece una sola vez en `BACANAL`

Conclusiones del smoke:

- el listado de `/rrhh/empleados` ya sigue la empresa activa real del selector;
- la deduplicacion multiempresa en `listEmpleados()` esta funcionando para el caso validado.

## Validaciones y notas tecnicas

- `git diff --check`: OK sobre el bloque integrado.
- `npm run typecheck`: se intento ejecutar, pero el runner no devolvio senal util; no se deja como validacion confirmada de esta sesion.
- `next dev` local: arrancado y parado correctamente durante el smoke.

Nota de proceso:

- el primer `git push` a `rrhh-sync-origin-c4da3ca` fallo por conflicto de ref remoto:
  - `cannot lock ref 'refs/heads/rrhh-sync-origin-c4da3ca': reference already exists`
- se publico la misma historia en:
  - `rrhh-sync-origin-c4da3ca-v2`

## Donde retomar

Orden recomendado para la siguiente sesion:

1. partir de este handoff;
2. revisar `docs/rrhh-consolidacion/SMOKE_USERS_RRHH.md`;
3. si se quiere seguir cerrando `TASK-002`, extender el smoke desde `/rrhh/empleados` hacia alta real multiempresa y reentrada del empleado;
4. si no hay mas trabajo inmediato de `TASK-002`, abrir el siguiente corte operativo evitando mezclarlo con horarios hasta decidir el recorte/modelado pendiente de `TASK-003`.

## Riesgos pendientes

- `pagos` sigue siendo WIP visible, no un flujo cerrado.
- no queda validacion confirmada de `typecheck` en esta sesion por el comportamiento del runner.
- `TASK-003` mantiene el gap documentado de `rrhh_turnos`, `rrhh_cuadrantes` y `rrhh_descansos`.

## Estado del worktree

- sin cambios tracked pendientes;
- ` .playwright-cli/` sigue sin trackear y se deja fuera de git.
