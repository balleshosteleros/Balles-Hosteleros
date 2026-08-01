-- Sincroniza NOMBRE y APELLIDOS entre las fichas de empleado y el perfil de
-- usuario, para que "empleado" y "usuario" salgan SIEMPRE del mismo sitio y
-- muestren lo mismo.
--
-- Problema detectado: existían divergencias (p. ej. "Iván" en empleados vs
-- "Ivan" en usuarios; "Alberto Cielicka" en una empresa vs "Albero Cieliczka"
-- en otra). Causa: el trigger `empleados_sync_datos_personales` replicaba los
-- datos personales (DNI, teléfono, IBAN...) entre las fichas del mismo user_id
-- PERO NO el nombre/apellidos, y NINGÚN trigger los propagaba a `usuarios`.
--
-- Fuente única: `empleados` (regla de datos personales del proyecto). Al cambiar
-- nombre/apellidos en cualquier ficha, se propaga:
--   1) a TODAS las demás fichas del mismo user_id (espejo multi-empresa), y
--   2) al perfil de sesión (`usuarios`).
--
-- Idempotente: CREATE OR REPLACE + DROP/CREATE del trigger. Guardas
-- IS DISTINCT FROM para no disparar updates en cascada innecesarios.

-- 1) Extender el sync de datos personales entre fichas para incluir nombre/apellidos.
CREATE OR REPLACE FUNCTION public.empleados_sync_datos_personales()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.user_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Espejo a las demás fichas del mismo empleado (otras empresas).
  UPDATE public.empleados e SET
    nombre                       = NEW.nombre,
    apellidos                    = NEW.apellidos,
    tipo_documento               = NEW.tipo_documento,
    dni_nie                      = NEW.dni_nie,
    fecha_nacimiento             = NEW.fecha_nacimiento,
    nacionalidad                 = NEW.nacionalidad,
    genero                       = NEW.genero,
    estado_civil                 = NEW.estado_civil,
    numero_ss                    = NEW.numero_ss,
    telefono                     = NEW.telefono,
    telefono_empresa             = NEW.telefono_empresa,
    email_personal               = NEW.email_personal,
    direccion                    = NEW.direccion,
    codigo_postal                = NEW.codigo_postal,
    ciudad                       = NEW.ciudad,
    provincia                    = NEW.provincia,
    pais                         = NEW.pais,
    iban                         = NEW.iban,
    banco_codigo                 = NEW.banco_codigo,
    banco_nombre                 = NEW.banco_nombre,
    titular_cuenta               = NEW.titular_cuenta,
    iban_verificado              = NEW.iban_verificado,
    contacto_emergencia_nombre   = NEW.contacto_emergencia_nombre,
    contacto_emergencia_relacion = NEW.contacto_emergencia_relacion,
    contacto_emergencia_telefono = NEW.contacto_emergencia_telefono,
    talla_uniforme               = NEW.talla_uniforme,
    talla_camiseta               = NEW.talla_camiseta,
    talla_pantalon               = NEW.talla_pantalon,
    updated_at                   = now()
  WHERE e.user_id = NEW.user_id
    AND e.id <> NEW.id
    AND (
         e.nombre                       IS DISTINCT FROM NEW.nombre
      OR e.apellidos                    IS DISTINCT FROM NEW.apellidos
      OR e.tipo_documento               IS DISTINCT FROM NEW.tipo_documento
      OR e.dni_nie                      IS DISTINCT FROM NEW.dni_nie
      OR e.fecha_nacimiento             IS DISTINCT FROM NEW.fecha_nacimiento
      OR e.nacionalidad                 IS DISTINCT FROM NEW.nacionalidad
      OR e.genero                       IS DISTINCT FROM NEW.genero
      OR e.estado_civil                 IS DISTINCT FROM NEW.estado_civil
      OR e.numero_ss                    IS DISTINCT FROM NEW.numero_ss
      OR e.telefono                     IS DISTINCT FROM NEW.telefono
      OR e.telefono_empresa             IS DISTINCT FROM NEW.telefono_empresa
      OR e.email_personal               IS DISTINCT FROM NEW.email_personal
      OR e.direccion                    IS DISTINCT FROM NEW.direccion
      OR e.codigo_postal                IS DISTINCT FROM NEW.codigo_postal
      OR e.ciudad                       IS DISTINCT FROM NEW.ciudad
      OR e.provincia                    IS DISTINCT FROM NEW.provincia
      OR e.pais                         IS DISTINCT FROM NEW.pais
      OR e.iban                         IS DISTINCT FROM NEW.iban
      OR e.banco_codigo                 IS DISTINCT FROM NEW.banco_codigo
      OR e.banco_nombre                 IS DISTINCT FROM NEW.banco_nombre
      OR e.titular_cuenta               IS DISTINCT FROM NEW.titular_cuenta
      OR e.iban_verificado              IS DISTINCT FROM NEW.iban_verificado
      OR e.contacto_emergencia_nombre   IS DISTINCT FROM NEW.contacto_emergencia_nombre
      OR e.contacto_emergencia_relacion IS DISTINCT FROM NEW.contacto_emergencia_relacion
      OR e.contacto_emergencia_telefono IS DISTINCT FROM NEW.contacto_emergencia_telefono
      OR e.talla_uniforme               IS DISTINCT FROM NEW.talla_uniforme
      OR e.talla_camiseta               IS DISTINCT FROM NEW.talla_camiseta
      OR e.talla_pantalon               IS DISTINCT FROM NEW.talla_pantalon
    );

  RETURN NEW;
END $function$;

-- 2) Propagar nombre/apellidos de la ficha al perfil de sesión (usuarios).
CREATE OR REPLACE FUNCTION public.empleados_sync_nombre_a_usuario()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.user_id IS NULL THEN
    RETURN NEW;
  END IF;

  UPDATE public.usuarios u SET
    nombre     = NEW.nombre,
    apellidos  = NEW.apellidos,
    updated_at = now()
  WHERE u.user_id = NEW.user_id
    AND (
         u.nombre    IS DISTINCT FROM NEW.nombre
      OR u.apellidos IS DISTINCT FROM NEW.apellidos
    );

  RETURN NEW;
END $function$;

DROP TRIGGER IF EXISTS trg_empleados_sync_nombre_a_usuario ON public.empleados;
CREATE TRIGGER trg_empleados_sync_nombre_a_usuario
  AFTER INSERT OR UPDATE OF nombre, apellidos ON public.empleados
  FOR EACH ROW
  EXECUTE FUNCTION public.empleados_sync_nombre_a_usuario();

-- 3) El trigger de espejo entre fichas NO incluía nombre/apellidos en su lista
-- UPDATE OF, así que un cambio SOLO de nombre no lo disparaba. Lo recreamos con
-- nombre y apellidos incluidos para que el espejo multi-empresa cubra también el nombre.
DROP TRIGGER IF EXISTS trg_empleados_sync_datos_personales ON public.empleados;
CREATE TRIGGER trg_empleados_sync_datos_personales
  AFTER UPDATE OF
    nombre, apellidos,
    tipo_documento, dni_nie, fecha_nacimiento, nacionalidad, genero, estado_civil,
    numero_ss, telefono, telefono_empresa, email_personal, direccion, codigo_postal,
    ciudad, provincia, pais, iban, banco_codigo, banco_nombre, titular_cuenta,
    iban_verificado, contacto_emergencia_nombre, contacto_emergencia_relacion,
    contacto_emergencia_telefono, talla_uniforme, talla_camiseta, talla_pantalon
  ON public.empleados
  FOR EACH ROW
  EXECUTE FUNCTION public.empleados_sync_datos_personales();
