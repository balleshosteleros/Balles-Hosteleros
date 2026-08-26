-- `candidatos.tipo_documento`: qué documento aporta la persona (DNI, NIE o
-- pasaporte).
--
-- Se pregunta en el formulario de documentación del proceso de selección, justo
-- encima de la subida del documento, que es donde la persona lo tiene delante.
-- Antes se preguntaba al entrar por primera vez al software, lo que obligaba a
-- decir dos veces lo mismo: primero se subía el documento y después, ya
-- contratado, se preguntaba cuál era.
--
-- Al contratar se copia a `empleados.tipo_documento`, igual que el resto de la
-- documentación.

ALTER TABLE public.candidatos
  ADD COLUMN IF NOT EXISTS tipo_documento text;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'candidatos_tipo_documento_chk'
  ) THEN
    ALTER TABLE public.candidatos
      ADD CONSTRAINT candidatos_tipo_documento_chk
      CHECK (tipo_documento IS NULL OR tipo_documento IN ('DNI', 'NIE', 'PASAPORTE'));
  END IF;
END $$;
