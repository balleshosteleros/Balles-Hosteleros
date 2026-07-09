-- Backfill ADITIVO: siembra la plantilla de email «Gestoría · cambio de puesto
-- (promoción)» (clave gestoria_cambio_puesto) en toda empresa que ya tenga la
-- plantilla de alta a la gestoría, para que la promoción interna pueda avisar a la
-- gestoría. Idempotente: no inserta si la clave ya existe en la empresa.
INSERT INTO public.reclutamiento_email_plantillas
  (empresa_id, clave, nombre, destino, destino_email, asunto, cuerpo, activa)
SELECT
  ga.empresa_id,
  'gestoria_cambio_puesto',
  'Gestoría · cambio de puesto (promoción)',
  'gestoria',
  NULL,
  'Cambio de puesto · {{candidato_nombre_completo}} · {{empresa_nombre}}',
  'Hola,' || chr(10) || chr(10) ||
  'Os comunicamos que el siguiente trabajador cambia de puesto dentro de la empresa (promoción interna). Os enviamos los datos para que tramitéis la modificación de su contrato:' || chr(10) || chr(10) ||
  '{{gestoria_datos}}' || chr(10) || chr(10) ||
  'Gracias,' || chr(10) ||
  '{{empresa_nombre}}',
  true
FROM public.reclutamiento_email_plantillas ga
WHERE ga.clave = 'gestoria_alta'
  AND NOT EXISTS (
    SELECT 1 FROM public.reclutamiento_email_plantillas x
    WHERE x.empresa_id = ga.empresa_id AND x.clave = 'gestoria_cambio_puesto'
  );
