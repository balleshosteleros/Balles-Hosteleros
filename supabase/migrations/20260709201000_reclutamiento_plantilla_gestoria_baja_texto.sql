-- Actualiza el cuerpo de la plantilla «Gestoría · baja de trabajador» al texto
-- nuevo (con {{tipo_baja}} y {{fecha_baja_oficial}}) SOLO si sigue siendo el
-- texto original sembrado por el backfill anterior. Así NO se machaca ninguna
-- edición que el cliente haya hecho a mano.
UPDATE public.reclutamiento_email_plantillas
SET cuerpo =
  'Hola,' || chr(10) || chr(10) ||
  'Os comunicamos que el siguiente trabajador causa BAJA en la empresa ({{tipo_baja}}). Su último día efectivo de trabajo será el {{fecha_baja}} y la baja será oficial el {{fecha_baja_oficial}}. Os enviamos los datos para que tramitéis la baja:' || chr(10) || chr(10) ||
  '{{gestoria_datos}}' || chr(10) || chr(10) ||
  'Gracias,' || chr(10) ||
  '{{empresa_nombre}}'
WHERE clave = 'gestoria_baja'
  AND cuerpo =
    'Hola,' || chr(10) || chr(10) ||
    'Os comunicamos que el siguiente trabajador causa BAJA en la empresa. Su último día efectivo de trabajo será el {{fecha_baja}}. Os enviamos los datos para que tramitéis la baja:' || chr(10) || chr(10) ||
    '{{gestoria_datos}}' || chr(10) || chr(10) ||
    'Gracias,' || chr(10) ||
    '{{empresa_nombre}}';
