-- Alinea el blindaje de altas con los valores reales observados en Supabase Auth admin.
-- Sin esto, createUser/inviteUserByEmail/generateLink pueden fallar con
-- "Database error creating new user" aunque el alta venga por la vía admin.
-- En este proyecto se observó `caller_role=none` en auth_logs para altas
-- disparadas por /admin/users, así que se admite también ese valor.

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  caller_role text;
BEGIN
  caller_role := coalesce(
    current_setting('request.jwt.claim.role', true),
    current_setting('role', true),
    ''
  );

  IF caller_role NOT IN ('service_role', 'supabase_admin', 'supabase_auth_admin', 'none') THEN
    RAISE EXCEPTION 'Alta de usuario no permitida. El registro es por invitación desde RRHH.'
      USING ERRCODE = '42501';
  END IF;

  INSERT INTO public.profiles (id, user_id, email, full_name, nombre, avatar_url)
  VALUES (
    NEW.id,
    NEW.id,
    NEW.email,
    coalesce(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name'),
    coalesce(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name'),
    NEW.raw_user_meta_data->>'avatar_url'
  );
  RETURN NEW;
END;
$function$;
