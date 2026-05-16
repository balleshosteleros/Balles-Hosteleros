-- ─────────────────────────────────────────────────────────────────────
-- Blindaje de auth: solo admin puede dar de alta + auto-purga identities
-- ─────────────────────────────────────────────────────────────────────
--
-- Contexto: el trigger handle_new_user previo creaba perfiles automáticos
-- en Grupo Habana para CUALQUIER auth.user nuevo (OAuth Google público
-- incluido). Esto contaminaba la BD y dejaba puertas traseras vía OAuth.
--
-- Cambio 1 — handle_new_user: aborta si el alta no viene de service_role.
-- El alta de usuarios solo se permite desde RRHH/admin con admin client.
-- Quita también el empresa_id hardcoded; los callers TS lo asignan.
--
-- Cambio 2 — nuevo trigger purge_old_identities_on_email_change: cuando
-- cambia el email principal de un user, elimina identities vinculadas
-- con el email anterior. Esto evita situaciones como balleshosteleros@…
-- que quedó como puerta trasera del admin tras un rename de email.

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

  IF caller_role NOT IN ('service_role', 'supabase_admin') THEN
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

CREATE OR REPLACE FUNCTION public.purge_old_identities_on_email_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'auth', 'pg_temp'
AS $function$
BEGIN
  IF NEW.email IS DISTINCT FROM OLD.email THEN
    DELETE FROM auth.identities
    WHERE user_id = NEW.id
      AND identity_data->>'email' <> NEW.email;
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS purge_old_identities_on_email_change ON auth.users;
CREATE TRIGGER purge_old_identities_on_email_change
AFTER UPDATE OF email ON auth.users
FOR EACH ROW
EXECUTE FUNCTION public.purge_old_identities_on_email_change();
