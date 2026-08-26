-- Contratar volvía a fallar con "Database error creating new user".
--
-- PROBLEMA: `handle_new_user()` daba bypass a las altas administrativas mirando
-- si el rol era `service_role`/`supabase_admin` (ver 20260820190000, línea 50).
-- Esa comprobación NUNCA se cumple en el alta desde RRHH: `auth.admin.createUser`
-- no escribe en `auth.users` con la service key —la petición va a GoTrue, y quien
-- hace el INSERT es GoTrue con SU rol, `supabase_auth_admin`—. Así que el alta
-- caía por la rama de OAuth, que exige que el correo YA exista en `usuarios`…
-- justo lo que el alta está creando en ese momento. Imposible de satisfacer:
-- contratar quedó bloqueado (Juan Felipe Aguilar, 26-ago-2026).
--
-- Ya pasó antes y se arregló igual (20260521140000), pero la migración de
-- 20-ago-2026 lo reintrodujo al reorganizar el trigger.
--
-- LO QUE HAY QUE DISTINGUIR: las dos vías llegan como `supabase_auth_admin`, así
-- que el rol no las separa. Lo que sí las separa es el PROVEEDOR:
--   · Alta desde RRHH → `provider = 'email'` (createUser con contraseña).
--   · Login con Google → `provider = 'google'`.
-- Verificado en producción: la cuenta que se quiso bloquear (bamu1847, 19-ago) y
-- las demás cuentas Google son `provider='google'`; las 6 altas hechas desde RRHH
-- son `provider='email'` con contraseña. La señal es limpia.
--
-- REGLA QUE QUEDA:
--   · Alta administrativa (service_role/supabase_admin) → pasa. Igual que antes.
--   · Alta por RRHH (`provider='email'`) → pasa, sin exigir usuario previo. Es la
--     corrección. No abre autorregistro: el endpoint de signup público está
--     cerrado y solo se llega aquí con la service key desde el servidor.
--   · Google/OAuth → SIGUE exigiendo usuario dado de alta y activo. Intacto el
--     blindaje de 20260805150000 y 20260820190000: `usuarios.email` es la fuente
--     única del acceso y nadie entra con Google sin estar invitado.
--
-- Idempotente: CREATE OR REPLACE.

CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  caller_role text;
  proveedor text;
  invitado boolean;
BEGIN
  caller_role := coalesce(
    current_setting('request.jwt.claim.role', true),
    current_setting('role', true),
    ''
  );

  proveedor := coalesce(NEW.raw_app_meta_data->>'provider', '');

  -- Altas administrativas (seeds, scripts con service key).
  IF caller_role IN ('service_role', 'supabase_admin') THEN
    INSERT INTO public.usuarios (id, user_id, email, full_name, nombre, avatar_url)
    VALUES (NEW.id, NEW.id, NEW.email,
      coalesce(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name'),
      coalesce(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name'),
      NEW.raw_user_meta_data->>'avatar_url');
    RETURN NEW;
  END IF;

  -- Nadie debería poder autorregistrarse por otras vías.
  IF caller_role NOT IN ('supabase_auth_admin', 'none') THEN
    RAISE EXCEPTION 'Alta de usuario no permitida. El registro es por invitación desde RRHH.'
      USING ERRCODE = '42501';
  END IF;

  IF NEW.email IS NULL OR btrim(NEW.email) = '' THEN
    RAISE EXCEPTION 'Esta cuenta no tiene acceso al sistema.'
      USING ERRCODE = '42501';
  END IF;

  -- Alta creada por RRHH (`createUser` → provider 'email'): es el acto de dar de
  -- alta al usuario, así que exigir que ya exista sería contradictorio.
  IF proveedor = 'email' THEN
    INSERT INTO public.usuarios (id, user_id, email, full_name, nombre, avatar_url)
    VALUES (NEW.id, NEW.id, NEW.email,
      coalesce(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name'),
      coalesce(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name'),
      NEW.raw_user_meta_data->>'avatar_url');
    RETURN NEW;
  END IF;

  -- Resto (Google y cualquier OAuth futuro): solo entra quien YA está dado de
  -- alta y activo. `usuarios.email` es la fuente única del acceso.
  SELECT EXISTS (
    SELECT 1 FROM public.usuarios u
    WHERE lower(u.email) = lower(NEW.email)
      AND coalesce(u.estado_acceso, 'Activo') = 'Activo'
  ) INTO invitado;

  IF NOT invitado THEN
    -- Mensaje genérico a propósito: no confirmamos a un tercero si un correo
    -- concreto existe o no en el sistema (evita enumeración de cuentas).
    RAISE EXCEPTION 'Esta cuenta no tiene acceso al sistema.'
      USING ERRCODE = '42501';
  END IF;

  INSERT INTO public.usuarios (id, user_id, email, full_name, nombre, avatar_url)
  VALUES (NEW.id, NEW.id, NEW.email,
    coalesce(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name'),
    coalesce(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name'),
    NEW.raw_user_meta_data->>'avatar_url');
  RETURN NEW;
END;
$function$;
