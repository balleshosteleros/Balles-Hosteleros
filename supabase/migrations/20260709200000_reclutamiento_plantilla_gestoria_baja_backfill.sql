-- Backfill ADITIVO: siembra la plantilla de email «Gestoría · baja de trabajador»
-- (clave gestoria_baja) en toda empresa que ya tenga la plantilla de alta a la
-- gestoría, para que la BAJA VOLUNTARIA (offboarding) pueda avisar a la gestoría
-- con los datos del trabajador y su ÚLTIMO DÍA (fecha efectiva de la baja).
-- Idempotente: no inserta si la clave ya existe en la empresa.
INSERT INTO public.reclutamiento_email_plantillas
  (empresa_id, clave, nombre, destino, destino_email, asunto, cuerpo, activa)
SELECT
  ga.empresa_id,
  'gestoria_baja',
  'Gestoría · baja de trabajador',
  'gestoria',
  NULL,
  'Baja de trabajador · {{candidato_nombre_completo}} · {{empresa_nombre}}',
  'Hola,' || chr(10) || chr(10) ||
  'Os comunicamos que el siguiente trabajador causa BAJA en la empresa ({{tipo_baja}}). Su último día efectivo de trabajo será el {{fecha_baja}} y la baja será oficial el {{fecha_baja_oficial}}. Os enviamos los datos para que tramitéis la baja:' || chr(10) || chr(10) ||
  '{{gestoria_datos}}' || chr(10) || chr(10) ||
  'Gracias,' || chr(10) ||
  '{{empresa_nombre}}',
  true
FROM public.reclutamiento_email_plantillas ga
WHERE ga.clave = 'gestoria_alta'
  AND NOT EXISTS (
    SELECT 1 FROM public.reclutamiento_email_plantillas x
    WHERE x.empresa_id = ga.empresa_id AND x.clave = 'gestoria_baja'
  );
