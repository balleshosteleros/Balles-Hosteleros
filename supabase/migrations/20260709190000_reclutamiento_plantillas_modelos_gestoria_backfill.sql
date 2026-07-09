-- ============================================================
-- 20260709190000_..._backfill.sql — PRP-072
-- Backfill ADITIVO: siembra las plantillas de solicitud de
-- modelos a la gestoría (trimestral y anual) en toda empresa
-- que ya tenga la plantilla de alta a la gestoría.
-- Idempotente (NOT EXISTS por (empresa_id, clave)).
-- ============================================================

INSERT INTO public.reclutamiento_email_plantillas
  (empresa_id, clave, nombre, destino, destino_email, asunto, cuerpo, activa)
SELECT
  ga.empresa_id, v.clave, v.nombre, 'gestoria', NULL, v.asunto, v.cuerpo, true
FROM public.reclutamiento_email_plantillas ga
CROSS JOIN (
  VALUES
    (
      'gestoria_modelos_trimestral',
      'Gestoría · Solicitud modelos trimestrales',
      'Modelos trimestrales {{periodo_label}} · {{empresa_nombre}}',
      'Hola,' || chr(10) || chr(10) ||
      'Ya ha vencido el plazo de presentación de los modelos trimestrales del periodo {{periodo_label}} de {{empresa_nombre}}.' || chr(10) || chr(10) ||
      'Os pedimos que subáis los modelos presentados (303, 111, etc.) desde el siguiente enlace, que los integrará automáticamente en el software:' || chr(10) || chr(10) ||
      '{{enlace_modelos}}' || chr(10) || chr(10) ||
      'Gracias por vuestra colaboración.' || chr(10) ||
      '{{empresa_nombre}}'
    ),
    (
      'gestoria_modelos_anual',
      'Gestoría · Solicitud modelos anuales',
      'Modelos anuales {{periodo_label}} · {{empresa_nombre}}',
      'Hola,' || chr(10) || chr(10) ||
      'Ya ha vencido el plazo de presentación de los modelos anuales del ejercicio {{periodo_label}} de {{empresa_nombre}}.' || chr(10) || chr(10) ||
      'Os pedimos que subáis los modelos presentados (390, 347, 190, 200, Pérdidas y Ganancias, Balance y Libro Mayor) desde el siguiente enlace, que los integrará automáticamente en el software:' || chr(10) || chr(10) ||
      '{{enlace_modelos}}' || chr(10) || chr(10) ||
      'Gracias por vuestra colaboración.' || chr(10) ||
      '{{empresa_nombre}}'
    )
) AS v(clave, nombre, asunto, cuerpo)
WHERE ga.clave = 'gestoria_alta'
  AND NOT EXISTS (
    SELECT 1 FROM public.reclutamiento_email_plantillas x
    WHERE x.empresa_id = ga.empresa_id AND x.clave = v.clave
  );
