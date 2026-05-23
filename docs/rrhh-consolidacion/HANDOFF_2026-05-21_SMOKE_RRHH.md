# Handoff RRHH smoke - 2026-05-21

## Estado de cierre

Sesion cerrada tras ejecutar un smoke real de `TASK-002` sobre RRHH, con fixes operativos en Supabase y documentacion de usuarios/resultado para futuras sesiones.

## Cierre final

- `13ccb72` `Fix RRHH employee creation and access smoke blockers _Fernando`
- `bcb606d` `Add commit suffix hook for Balles repo _Fernando`
- `b6acc40` `Fix employee onboarding redirects _Fernando`
- `e463ddd` `Require primary local for employee creation _Fernando`
- `1f89d30` `Document reusable RRHH smoke employee _Fernando`

Resultado final validado:

- `createEmpleado()` deja `profiles.rol_label="EMPLEADO"`
- el alta obliga a asignar un `local` principal
- `primer-acceso` redirige a `mi-panel`
- el empleado smoke llega a `mi-panel/fichajes`
- el fichaje de entrada y salida queda validado
- el usuario `smoke-localfix-20260523@example.com` queda reusable para futuros smokes

Branch actual: `main`
Repo: `https://github.com/balleshosteleros/Balles-Hosteleros.git`

## Que se hizo

### Validacion tecnica

- `npm run build`: compila.
- `npm run typecheck`: OK.

### Fix de altas auth en Supabase

- Se diagnostico que `public.handle_new_user()` rechazaba las altas admin.
- El valor real observado en logs fue `caller_role=none`.
- Se aplico fix en la base activa para permitir ese caso.
- Se dejo persistido en:
  - `supabase/migrations/20260521140000_allow_supabase_auth_admin_handle_new_user.sql`

### Smoke RRHH ejecutado

- Login RRHH: OK.
- `/rrhh/empleados`: OK.
- Alta real de empleado desde `/rrhh/empleados/nuevo`: OK.
- Reentrada con el empleado creado: fallo inicial por `profiles.rol_label=null`, luego acceso restaurado manualmente para seguir el smoke.
- `mi-panel`: carga, pero queda bloqueado por gating de onboarding/formacion antes de llegar al flujo normal de fichaje.

### Artefactos generados

- `docs/rrhh-consolidacion/SMOKE_REPORT_RRHH_2026-05-21.md`
- `docs/rrhh-consolidacion/SMOKE_USERS_RRHH.md`
- `docs/rrhh-consolidacion/HANDOFF_2026-05-21_SMOKE_RRHH.md`

## Hallazgos clave

### 1. Alta auth rota sin el fix del trigger

- Sintoma: `Database error creating new user`
- Causa confirmada: `handle_new_user()` no aceptaba el `caller_role` real del proyecto

### 2. Alta canonica de empleado incompleta

- `createEmpleado()` deja `profiles.rol_label` a `null`
- Efecto: el usuario creado no puede iniciar sesion aunque exista en auth y tenga `user_roles`

### 3. Divergencia multiempresa/local principal

- En el formulario se marco `HABANA` como principal
- El selector de local principal mostro `Restaurante Bacanal`
- El empleado creado no aparecio filtrando `Smoke` en el listado activo de `HABANA`

### 4. Gating de `mi-panel`

- Aunque el empleado entre, la plataforma lo redirige a onboarding/formacion
- El smoke no llego al CTA utilizable de `Fichar entrada`

## Usuarios de smoke dejados para reuso

Ver:

- `docs/rrhh-consolidacion/SMOKE_USERS_RRHH.md`

Nota:

- No se han dejado contraseñas en el repo
- Antes de reutilizar, resetear password y validar estado segun el documento

## Donde retomar

Orden recomendado:

1. Corregir `createEmpleado()` para poblar `profiles.rol_label`.
2. Auditar el contrato de empresa principal, `user_empresas` y locales en el alta multiempresa.
3. Verificar por que el empleado no entra limpio en el listado de la empresa activa esperada.
4. Revisar el gating posterior de `mi-panel` para separar primer acceso, onboarding formativo y fichaje operativo.

Con el cierre final ya aplicado, estos puntos quedan como referencia historica para futuros cambios, no como bloqueos abiertos de esta sesion.

## Checkpoint recomendado

Este estado es buen punto de commit y rollback porque:

- el smoke ya esta ejecutado
- los fallos estan aislados y documentados
- hay usuario RRHH reusable y fix persistido de trigger
- la siguiente sesion ya no necesita reconstruir contexto
