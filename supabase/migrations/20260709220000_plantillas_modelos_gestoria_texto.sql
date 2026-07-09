-- ============================================================
-- 20260709220000_plantillas_modelos_gestoria_texto.sql — PRP-072
-- Actualiza el TEXTO de las plantillas de solicitud de modelos a
-- la gestoría en empresas que ya las tengan sembradas:
--   1) Quita la lista concreta de modelos del cuerpo (303/111,
--      390/347/190/…) — se pedían "los modelos" sin enumerarlos.
--   2) Sustituye cualquier "-Q" heredado por "-T" en asunto y
--      cuerpo (el label del periodo es Txx, no Qxx).
-- Idempotente: solo reemplaza si encuentra el patrón antiguo.
-- No toca plantillas ya personalizadas por el usuario más allá
-- del reemplazo textual concreto.
-- ============================================================

-- 1) Trimestrales: quitar "(303, 111, etc.)"
UPDATE public.reclutamiento_email_plantillas
SET cuerpo = REPLACE(
      cuerpo,
      'Os pedimos que subáis los modelos presentados (303, 111, etc.) con el botón de abajo',
      'Os pedimos que subáis los modelos presentados con el botón de abajo'
    )
WHERE clave = 'gestoria_modelos_trimestral'
  AND cuerpo LIKE '%(303, 111, etc.)%';

-- 2) Anuales: quitar la lista larga de modelos
UPDATE public.reclutamiento_email_plantillas
SET cuerpo = REPLACE(
      cuerpo,
      'Os pedimos que subáis los modelos presentados (390, 347, 190, 200, Pérdidas y Ganancias, Balance y Libro Mayor) con el botón de abajo',
      'Os pedimos que subáis los modelos presentados con el botón de abajo'
    )
WHERE clave = 'gestoria_modelos_anual'
  AND cuerpo LIKE '%(390, 347, 190, 200, Pérdidas y Ganancias, Balance y Libro Mayor)%';

-- 3) Cambiar "-Q" por "-T" en el label del periodo (asunto y cuerpo),
--    por si alguna plantilla o texto guardado heredó el formato antiguo.
UPDATE public.reclutamiento_email_plantillas
SET asunto = REGEXP_REPLACE(asunto, '(\d{4})-Q([1-4])', '\1-T\2', 'g'),
    cuerpo = REGEXP_REPLACE(cuerpo, '(\d{4})-Q([1-4])', '\1-T\2', 'g')
WHERE asunto ~ '\d{4}-Q[1-4]'
   OR cuerpo ~ '\d{4}-Q[1-4]';
