-- El correo del USUARIO es el que da acceso. Fuente única.
--
-- PROBLEMA: `handle_new_user()` validaba el alta contra la FICHA DE EMPLEADO,
-- aceptando indistintamente `email_personal` o `email_empresa`. Un empleado con
-- los dos podía entrar con Google usando su Gmail personal y se le creaba una
-- SEGUNDA cuenta, sin empresa ni rol (esos campos los rellena el alta desde
-- RRHH). Resultado: la misma persona con dos accesos, uno inservible — y sin
-- entender por qué con un correo es GERENCIA y con el otro no ve nada.
-- Ocurrió el 19-ago-2026 con Alejandro Mojica (bamu1847@gmail.com).
--
-- REGLA (Iván, 20-ago-2026): el correo que da acceso es el de `usuarios.email`,
-- que no es "el personal" ni "el de empresa": es EL DE ACCESO. Al dar de alta al
-- usuario se coge el de empresa si lo hay y, si no, el personal — pero a partir
-- de ahí manda esta tabla y solo esta.
--
-- Por qué es mejor que validar contra la ficha:
--   · Un solo sitio que cambiar: se edita el correo del usuario y listo.
--   · Tocar la ficha del empleado NO altera quién puede entrar. Usuario y
--     empleado son cosas distintas (ver la separación ya existente en el
--     modelo) y esto lo respeta en vez de acoplarlos.
--   · Imposible la doble cuenta: hay un único correo de acceso por persona.
--
-- Verificado contra producción antes de aplicar: los 27 usuarios tienen su
-- `usuarios.email` poblado y ya sigue este criterio (los 4 con correo de empresa
-- lo usan; los 20 sin él usan el personal). Nadie activo pierde el acceso; el
-- único bloqueo nuevo es la cuenta suelta bamu1847, que es lo buscado.
--
-- Se conserva el resto: bypass de service_role para altas administrativas y
-- seeds, rechazo del autorregistro, exigencia de estado Activo y mensaje
-- genérico para no revelar qué correos existen.

CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  caller_role text;
  invitado boolean;
BEGIN
  caller_role := coalesce(
    current_setting('request.jwt.claim.role', true),
    current_setting('role', true),
    ''
  );

  -- Altas administrativas (seeds, API de RRHH con service key): bypass total.
  -- Es la vía por la que RRHH crea usuarios: primero la fila, luego el acceso.
  IF caller_role IN ('service_role', 'supabase_admin') THEN
    INSERT INTO public.usuarios (id, user_id, email, full_name, nombre, avatar_url)
    VALUES (NEW.id, NEW.id, NEW.email,
      coalesce(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name'),
      coalesce(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name'),
      NEW.raw_user_meta_data->>'avatar_url');
    RETURN NEW;
  END IF;

  -- Usuario normal (nadie debería poder autorregistrarse): rechazo directo.
  IF caller_role NOT IN ('supabase_auth_admin', 'none') THEN
    RAISE EXCEPTION 'Alta de usuario no permitida. El registro es por invitación desde RRHH.'
      USING ERRCODE = '42501';
  END IF;

  -- Alta vía GoTrue (Google OAuth / email): exigimos usuario dado de alta.
  IF NEW.email IS NULL OR btrim(NEW.email) = '' THEN
    RAISE EXCEPTION 'Esta cuenta no tiene acceso al sistema.'
      USING ERRCODE = '42501';
  END IF;

  -- FUENTE ÚNICA: el correo tiene que ser el de un usuario ya dado de alta y
  -- activo. Ya NO se mira la ficha de empleado: si alguien cambia el correo en
  -- la ficha, el acceso no se ve afectado; para cambiar el acceso se edita el
  -- correo del usuario, que es donde toca.
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
