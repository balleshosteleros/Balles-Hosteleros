-- Datos del contrato en la ficha del CANDIDATO.
--
-- Se piden de una vez en el formulario de documentación del proceso de
-- selección, junto al DNI, el IBAN y la Seguridad Social. Antes se preguntaban
-- después, al entrar por primera vez al software, así que el empleado rellenaba
-- dos formularios en dos momentos distintos y la ficha llegaba incompleta a
-- RRHH hasta que a la persona le daba por entrar.
--
-- No se piden en la CANDIDATURA (el formulario abierto de la oferta): ahí entra
-- cualquiera que ve el anuncio, y pedir el estado civil o el contacto de
-- emergencia a quien solo echa el currículum ni corresponde ni se puede.
--
-- Al contratar se copian a `empleados`, igual que el resto de la documentación.

ALTER TABLE public.candidatos
  ADD COLUMN IF NOT EXISTS codigo_postal text,
  ADD COLUMN IF NOT EXISTS ciudad text,
  ADD COLUMN IF NOT EXISTS provincia text,
  ADD COLUMN IF NOT EXISTS pais text,
  ADD COLUMN IF NOT EXISTS estado_civil text,
  ADD COLUMN IF NOT EXISTS contacto_emergencia_nombre text,
  ADD COLUMN IF NOT EXISTS contacto_emergencia_telefono text,
  ADD COLUMN IF NOT EXISTS contacto_emergencia_relacion text;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'candidatos_estado_civil_chk'
  ) THEN
    ALTER TABLE public.candidatos
      ADD CONSTRAINT candidatos_estado_civil_chk
      CHECK (estado_civil IS NULL OR estado_civil IN
        ('soltero', 'casado', 'pareja_hecho', 'divorciado', 'viudo', 'otro'));
  END IF;
END $$;
