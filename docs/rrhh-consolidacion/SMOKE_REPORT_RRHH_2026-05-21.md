# Smoke report RRHH - 2026-05-21

## Objetivo

Ejecutar un smoke real de `TASK-002-empleados-y-fichajes-canonicos.md` sobre:

- login RRHH
- alta real de empleado
- reentrada con empleado creado
- acceso a `mi-panel`

## Validaciones tecnicas previas

- `npm run build`: compila.
- `npm run typecheck`: OK.

## Fixes aplicados para poder ejecutar el smoke

### 1. Trigger de altas en Supabase

Se detecto que `public.handle_new_user()` estaba bloqueando las altas admin de Supabase Auth.

Hallazgo real en logs:

- `caller_role=none`

Se dejo migracion en:

- `supabase/migrations/20260521140000_allow_supabase_auth_admin_handle_new_user.sql`

Nota:

- en la base activa se tuvo que permitir tambien `none` para que `admin.createUser()` funcionara en este proyecto.

### 2. Usuario RRHH temporal de smoke

Se creo un usuario reusable de RRHH para futuras pruebas.

Ver:

- `docs/rrhh-consolidacion/SMOKE_USERS_RRHH.md`

## Resultado del smoke

### A. Login RRHH

Resultado: OK.

- el usuario RRHH temporal entra correctamente
- `/rrhh/empleados` carga
- el modulo RRHH queda operativo por UI

### B. Alta real de empleado desde `/rrhh/empleados/nuevo`

Resultado: OK con hallazgos.

Flujo comprobado:

- apertura del formulario
- alta real desde UI
- dialogo de credenciales temporales devuelto por backend
- redireccion al listado tras confirmar

### C. Reentrada con empleado creado

Resultado: FAIL inicial, luego OK con remediacion manual para continuar el smoke.

Problema detectado:

- el empleado se creo con `user_roles.role='empleado'`
- pero `profiles.rol_label` quedo `null`
- `checkProfileGuard()` exige `rol_label`
- el login devolvia el mensaje generico `Usuario o contraseña incorrectos.`

Remediacion manual aplicada al usuario de smoke para continuar:

- reset de password a uno conocido
- `profiles.rol_label='EMPLEADO'`

Esto confirma un bug real del flujo de alta canonica: el usuario creado no queda listo para acceder.

### D. Acceso a `mi-panel`

Resultado: OK parcial.

- tras corregir `rol_label`, el empleado entra en la app
- cae primero en `/primer-acceso`, como era esperable
- para seguir el smoke se dejo el empleado en estado operativo minimo:
  - `perfil_completado=true`
  - `avatar_obligatorio=false`
  - `local_id` asignado
  - `permite_teletrabajo=true`
- con eso `mi-panel` carga

### E. Fichaje personal

Resultado: FAIL funcional / bloqueado por onboarding adicional.

Hallazgo:

- `mi-panel` no muestra el flujo normal de fichaje
- en su lugar aparece una pantalla de bienvenida/formacion:
  - `Bienvenido a Balles Hosteleros`
  - `Antes de empezar a trabajar, necesitas completar tu formación de entrada`
- por tanto no se pudo ejecutar entrada/pausa/salida reales dentro de este smoke

## Hallazgos principales

### 1. Bug de seguridad/operativa en altas auth

- `handle_new_user()` no aceptaba el `caller_role` real del proyecto
- efecto: altas RRHH/admin fallaban con `Database error creating new user`

### 2. Bug de alta canonica de empleado

- `createEmpleado()` deja `profiles.rol_label` a `null`
- efecto: el usuario recien creado no puede iniciar sesion aunque exista en auth y tenga `user_roles`

### 3. Bug de multiempresa/local principal en el alta

- en el formulario se marco `HABANA` como empresa principal
- pero el selector de local principal mostro solo `Restaurante Bacanal`
- el empleado creado no aparecio al filtrar `Smoke` en el listado activo de `HABANA`
- esto sugiere divergencia entre:
  - empresa principal efectiva
  - acceso multiempresa
  - locales disponibles por empresa
  - listado RRHH por empresa activa

### 4. Bloqueo funcional de `mi-panel` por onboarding/formacion

- aunque el perfil quede completado, el empleado sigue entrando por una vista de bienvenida/formacion
- el smoke no llego al CTA usable de `Fichar entrada`

## Estado del usuario de smoke creado por RRHH

Usuario:

- ver `SMOKE_USERS_RRHH.md`

Estado final dejado para reuso:

- auth user creado
- profile existente
- `rol_label='EMPLEADO'`
- acceso a HABANA y BACANAL
- empleado con `local_id` de HABANA
- `permite_teletrabajo=true`
- `perfil_completado=true`

## Siguiente paso recomendado

1. Corregir `createEmpleado()` para dejar `profiles.rol_label` no nulo.
2. Auditar por que el alta mezcla el local de BACANAL con la empresa principal HABANA.
3. Verificar por que el empleado no aparece en el listado filtrado de la empresa activa esperada.
4. Auditar el gating posterior de `mi-panel` para separar:
   - primer acceso
   - onboarding formativo
   - fichaje operativo
