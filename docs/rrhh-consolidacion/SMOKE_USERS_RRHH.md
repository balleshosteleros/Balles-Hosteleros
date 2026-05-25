# Usuarios de smoke RRHH

## RRHH admin reusable

- email: `rrhh-smoke-admin-1779371949310@example.com`
- user_id: `876a732d-29ac-479a-9425-d9ee489ee5e8`

Scope:

- acceso a `HABANA`
- acceso a `BACANAL`
- rol app: `director`
- pensado para smoke RRHH por UI

## RRHH admin no borrar

- email: `rrhh-smoke-admin-no-borrar@example.com`
- user_id: `9846be41-6a0e-4545-bf28-b0b792fc4fd0`

Estado actual dejado para pruebas:

- empresa principal: `HABANA`
- accesos: `HABANA`, `BACANAL`
- rol app: `director`
- `rol_label='DIRECTOR'`
- `es_empleado=false`
- no borrar: cuenta persistente para futuros smokes RRHH

## Empleado smoke reusable

- email: `smoke-employee-1779371949310@example.com`
- user_id: `228a50e2-5c8c-4cb0-92a6-639f3b5ce2e6`
- empleado_id: `71912edd-1196-41f2-9478-be102f8f3059`

Estado actual dejado para pruebas:

- empresa principal: `HABANA`
- accesos: `HABANA`, `BACANAL`
- `rol_label='EMPLEADO'`
- `perfil_completado=true`
- `local_id=9d1ab861-475f-4008-ba8e-4ef0928b4ac6`
- `permite_teletrabajo=true`

## Empleado smoke reusable validado 2026-05-23

- email: `smoke-localfix-20260523@example.com`
- user_id: `6da8b950-ca0c-48dc-82ba-8104e7d38687`
- empleado_id: `9f2850f8-99ae-4e2a-b637-f36bb1912f70`

Estado actual dejado para pruebas:

- empresa principal: `HABANA`
- accesos: `HABANA`
- `rol_label='EMPLEADO'`
- `perfil_completado=true`
- `local_id=dc78dbe5-b5c1-4ff5-a299-b7bb66c22b4a`
- `permite_teletrabajo=true`
- `avatar_url` de smoke ya cargado
- smoke completo validado: alta RRHH -> primer acceso -> onboarding -> fichar entrada -> fichar salida

## Empleado smoke multiempresa validado 2026-05-25

- email: `smoke-multiempresa-20260525141329@example.com`
- user_id: `b919332f-5f51-410c-8c99-212a499faa2b`

Estado actual dejado para pruebas:

- empresa principal: `HABANA`
- accesos: `HABANA`, `BACANAL`
- `rol_label='EMPLEADO'`
- `perfil_completado=true`
- `local_id=9d1ab861-475f-4008-ba8e-4ef0928b4ac6`
- alta UI validada: dialog de credenciales, listado HABANA/BACANAL y reentrada a `mi-panel`

## Procedimiento de reutilizacion

Antes de reutilizar estos usuarios:

1. Resetear la password por admin/Supabase.
2. Verificar que `handle_new_user()` sigue alineado con el rol real del proyecto.
3. Confirmar que el empleado sigue teniendo `rol_label`, empresa principal y `local_id` correctos.
4. Si el smoke se hace en navegador limpio, recordar que el onboarding de formacion depende de `localStorage` y puede reaparecer aunque el resto del perfil este correcto.

## Notas

- Estos usuarios se crearon para smoke manual y automatizado de RRHH.
- Si el flujo de alta o de onboarding cambia, conviene revalidar este documento.
- Si se quiere usar el empleado para smoke de fichajes, revisar antes los gates de onboarding/formacion detectados en `SMOKE_REPORT_RRHH_2026-05-21.md`.
- El usuario `smoke-localfix-20260523@example.com` se dejo expresamente como reusable despues de validar el fix que obliga a asignar local en la empresa principal durante el alta.
