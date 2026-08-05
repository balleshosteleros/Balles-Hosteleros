-- Cierra la ultima via de alta para ex-empleados.
--
-- Un usuario con estado_acceso='Inactivo' (dado de baja) conservaba su fila en
-- usuario_empresas, y ese vinculo contaba como invitacion valida. Resultado:
-- un ex-empleado podia volver a crear cuenta por Google pese a estar de baja.
-- Detectado con la ficha de Adrian Paz (2026-08-05). Ahora el vinculo solo
-- vale si el acceso sigue Activo.
-- Verificado: los 24 usuarios activos pasan; Adrian (Inactivo) queda bloqueado.

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
      WHERE (lower(e.email_personal) = lower(NEW.email)
          OR lower(e.email_empresa)  = lower(NEW.email))
        AND coalesce(e.estado, '') = 'Activo'
    )
    OR EXISTS (
      SELECT 1 FROM public.usuarios u
      JOIN public.usuario_empresas ue ON ue.user_id = u.user_id
      WHERE lower(u.email) = lower(NEW.email)
        AND coalesce(u.estado_acceso, 'Activo') = 'Activo'
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
