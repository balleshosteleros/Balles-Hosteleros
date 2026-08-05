-- Bloquea el alta de cuentas NO invitadas que llegan por Google (OAuth).
--
-- PROBLEMA: handle_new_user() sólo rechazaba altas cuando el caller era un
-- usuario normal, pero dejaba pasar libremente las de 'supabase_auth_admin'
-- — que es justo el rol con el que GoTrue inserta al entrar por Google. Es
-- decir: cualquier persona del mundo que abriese la web y pulsara "Entrar con
-- Google" quedaba grabada en auth.users + public.usuarios. No podía entrar (el
-- profile-guard la rebotaba al login), pero la fila persistía para siempre.
-- El 2026-08-05 había 4 filas basura de 5 altas por Google, una de ellas de una
-- persona ajena a la empresa.
--
-- REGLA NUEVA: el alta sólo se permite si el correo YA fue dado de alta desde
-- RRHH. Dos formas válidas de estar invitado:
--   1. Figurar en `empleados` (email_personal o email_empresa), que es como
--      RRHH da de alta al personal.
--   2. Tener ya un vínculo en `usuario_empresas` (cuentas de dirección y
--      servicio que no son empleados: agora.demo, fmaroto2016, adrypaz69).
-- Verificado contra los 25 usuarios válidos en producción: los 25 pasan.
--
-- El alta desde el panel de RRHH sigue funcionando porque la API de Auth crea
-- primero la fila de empleado y luego el usuario; y el service_role conserva su
-- bypass explícito para altas administrativas y seeds.

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

  -- Alta vía GoTrue (Google OAuth / email): exigimos invitación previa.
  -- Sin email no hay forma de comprobar la invitación → se rechaza.
  IF NEW.email IS NULL OR btrim(NEW.email) = '' THEN
    RAISE EXCEPTION 'Esta cuenta no tiene acceso al sistema.'
      USING ERRCODE = '42501';
  END IF;

  SELECT (
    EXISTS (
      SELECT 1 FROM public.empleados e
      WHERE lower(e.email_personal) = lower(NEW.email)
         OR lower(e.email_empresa)  = lower(NEW.email)
    )
    OR EXISTS (
      SELECT 1 FROM public.usuarios u
      JOIN public.usuario_empresas ue ON ue.user_id = u.user_id
      WHERE lower(u.email) = lower(NEW.email)
    )
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
