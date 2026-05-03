---
name: Fichajes — tabla creada en migración 056
description: public.fichajes se creó tarde (056_fichajes.sql, 2026-05-02). empleado_id apunta a auth.users, NO a empleados. Patrón "tabla personal del usuario".
type: project
---

`public.fichajes` no existió hasta la migración `056_fichajes.sql` (aplicada 2026-05-02 manualmente vía SQL Editor de Supabase Studio). El módulo RRHH (`026_rrhh_empleados.sql`) creó empleados/contratos/nóminas pero se saltó fichajes. La planificación en `.claude/migrations/005_rrhh.sql` quedó sin aplicar.

**Estructura clave** (compatible con `src/features/mi-panel/actions/mi-panel-actions.ts`):
- `empleado_id uuid → auth.users(id)` — NO referencia a `empleados(id)`. Mismo patrón que `solicitudes_personal` (050).
- `hora_entrada` / `hora_salida` son `timestamptz` (el código manda `toISOString()`).
- `pausa_inicio` / `pausa_fin` son `time` (el código manda `toTimeString().slice(0,8)`).
- `estado check in ('pendiente','trabajando','pausa','completado')`.
- Una fila por día por empleado.
- RLS: read empresa, insert/update own (`empleado_id = auth.uid()`), manage empresa.

**Why:** El código de mi-panel ya estaba escrito asumiendo `auth.users.id`; cambiar el FK a `empleados(id)` habría roto el flujo (no todos los users tienen row en empleados). El comentario en `050_mi_panel_solicitudes.sql:10-11` ya daba por hecho este patrón.

**How to apply:**
- Tablas "personales del usuario logueado" (fichajes, solicitudes_personal): FK a `auth.users(id)`.
- Tablas "de gestión RRHH" (contratos, nóminas, vacaciones, evaluaciones): FK a `empleados(id)`.
- Si una server action devuelve toast "Error desconocido", el handler está enmascarando un `PostgrestError` (no es `Error` instance). Usar `extractErrorMessage()` en `mi-panel-actions.ts` como modelo.
