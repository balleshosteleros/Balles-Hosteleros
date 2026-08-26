-- ─────────────────────────────────────────────────────────────────────
-- Auth: reparar campos de token en NULL (deben ser cadena vacia '')
-- ─────────────────────────────────────────────────────────────────────
--
-- Contexto: el usuario bgarcal24@gmail.com (alta del 08-jul-2026, hecha por
-- SQL directo y no por la API de Auth) tenia confirmation_token, recovery_token,
-- email_change_token_new y email_change a NULL en vez de cadena vacia.
--
-- GoTrue (el servicio de Auth, escrito en Go) no sabe leer un NULL en esas
-- columnas: al listar usuarios falla con "Database error finding users" y
-- ABORTA EL LOTE ENTERO. Consecuencia: la columna "ultima conexion" de
-- Ajustes → Usuarios salia vacia para los 27 usuarios por culpa de 1 solo.
--
-- Idempotente: si no hay filas con NULL no toca nada.
--
-- NOTA: no se ponen DEFAULT '' ni NOT NULL en auth.users porque el rol de
-- la aplicacion no es owner de esa tabla (la gestiona Supabase). La defensa
-- real vive en dos sitios:
--   1. El alta SIEMPRE debe hacerse con admin.auth.admin.createUser() desde
--      el codigo (nunca INSERT manual en auth.users) — ver empleados-core.ts
--      y admin.ts. La API de GoTrue rellena estos campos correctamente.
--   2. getEmployees() en src/actions/admin.ts tiene un repliegue: si el lote
--      falla, recorre los usuarios de uno en uno y salta solo al corrupto,
--      en lugar de perder la ultima conexion de todos.

UPDATE auth.users
SET confirmation_token          = coalesce(confirmation_token, ''),
    recovery_token              = coalesce(recovery_token, ''),
    email_change_token_new      = coalesce(email_change_token_new, ''),
    email_change_token_current  = coalesce(email_change_token_current, ''),
    phone_change_token          = coalesce(phone_change_token, ''),
    reauthentication_token      = coalesce(reauthentication_token, ''),
    email_change                = coalesce(email_change, ''),
    phone_change                = coalesce(phone_change, '')
WHERE confirmation_token IS NULL
   OR recovery_token IS NULL
   OR email_change_token_new IS NULL
   OR email_change_token_current IS NULL
   OR phone_change_token IS NULL
   OR reauthentication_token IS NULL
   OR email_change IS NULL
   OR phone_change IS NULL;
