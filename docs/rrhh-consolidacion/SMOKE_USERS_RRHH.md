# Usuarios de smoke RRHH

## RRHH admin reusable

- email: `rrhh-smoke-admin-1779371949310@example.com`
- user_id: `876a732d-29ac-479a-9425-d9ee489ee5e8`

Scope:

- acceso a `HABANA`
- acceso a `BACANAL`
- rol app: `director`
- pensado para smoke RRHH por UI

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

## Procedimiento de reutilizacion

Antes de reutilizar estos usuarios:

1. Resetear la password por admin/Supabase.
2. Verificar que `handle_new_user()` sigue alineado con el rol real del proyecto.
3. Confirmar que el empleado sigue teniendo `rol_label`, empresa principal y `local_id` correctos.

## Notas

- Estos usuarios se crearon para smoke manual y automatizado de RRHH.
- Si el flujo de alta o de onboarding cambia, conviene revalidar este documento.
- Si se quiere usar el empleado para smoke de fichajes, revisar antes los gates de onboarding/formacion detectados en `SMOKE_REPORT_RRHH_2026-05-21.md`.
