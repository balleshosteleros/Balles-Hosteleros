-- =====================================================================
-- empleados = FUENTE ÚNICA de datos personales.
-- usuarios queda SOLO como cuenta de acceso (login/rol/permisos).
--
-- Una persona con acceso a varias empresas tiene una ficha de empleado
-- por empresa, pero los DATOS PERSONALES son un REFLEJO (idénticos en
-- todas). Lo LABORAL (puesto, depto, local, jornada, validadores...)
-- es propio de cada empresa y NO se espeja.
--
-- 1) Añade a empleados las columnas de datos personales que faltaban.
-- 2) Trigger: al editar datos personales en una ficha, se replican a
--    todas las fichas del mismo user_id.
-- Idempotente.
-- =====================================================================

-- 1) Columnas faltantes en empleados -----------------------------------
ALTER TABLE public.empleados
  ADD COLUMN IF NOT EXISTS tipo_documento   text,
  ADD COLUMN IF NOT EXISTS genero           text,
  ADD COLUMN IF NOT EXISTS estado_civil     text,
  ADD COLUMN IF NOT EXISTS telefono_empresa text,
  ADD COLUMN IF NOT EXISTS codigo_postal    text,
  ADD COLUMN IF NOT EXISTS ciudad           text,
  ADD COLUMN IF NOT EXISTS provincia        text,
  ADD COLUMN IF NOT EXISTS pais             text,
  ADD COLUMN IF NOT EXISTS banco_codigo     text,
  ADD COLUMN IF NOT EXISTS banco_nombre     text,
  ADD COLUMN IF NOT EXISTS titular_cuenta   text,
  ADD COLUMN IF NOT EXISTS iban_verificado  boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS talla_camiseta   text,
  ADD COLUMN IF NOT EXISTS talla_pantalon   text;

-- talla_uniforme ya existía (texto libre). Conservamos camiseta/pantalón
-- separadas como en el portal; talla_uniforme refleja la de camiseta.

-- Checks coherentes con usuarios (mismos valores permitidos)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'empleados_genero_check') THEN
    ALTER TABLE public.empleados
      ADD CONSTRAINT empleados_genero_check
      CHECK (genero IS NULL OR genero = ANY (ARRAY['mujer','hombre']));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'empleados_estado_civil_check') THEN
    ALTER TABLE public.empleados
      ADD CONSTRAINT empleados_estado_civil_check
      CHECK (estado_civil IS NULL OR estado_civil = ANY (ARRAY['soltero','casado','pareja_hecho','divorciado','viudo','otro']));
  END IF;
END $$;

-- 2) Trigger de sincronización entre fichas del mismo user_id ----------
CREATE OR REPLACE FUNCTION public.empleados_sync_datos_personales()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.user_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Replica datos PERSONALES a las DEMÁS fichas del mismo user_id.
  -- Solo toca filas con algún valor distinto (evita writes/recursión).
  UPDATE public.empleados e SET
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
         e.tipo_documento               IS DISTINCT FROM NEW.tipo_documento
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
END $$;

DROP TRIGGER IF EXISTS trg_empleados_sync_datos_personales ON public.empleados;
CREATE TRIGGER trg_empleados_sync_datos_personales
  AFTER UPDATE OF
    tipo_documento, dni_nie, fecha_nacimiento, nacionalidad, genero, estado_civil,
    numero_ss, telefono, telefono_empresa, email_personal, direccion, codigo_postal,
    ciudad, provincia, pais, iban, banco_codigo, banco_nombre, titular_cuenta,
    iban_verificado, contacto_emergencia_nombre, contacto_emergencia_relacion,
    contacto_emergencia_telefono, talla_uniforme, talla_camiseta, talla_pantalon
  ON public.empleados
  FOR EACH ROW
  EXECUTE FUNCTION public.empleados_sync_datos_personales();

COMMENT ON FUNCTION public.empleados_sync_datos_personales() IS
  'Replica datos PERSONALES (no laborales) entre todas las fichas de empleado del mismo user_id. empleados es la fuente única de verdad; usuarios es solo acceso.';
