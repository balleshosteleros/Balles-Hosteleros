-- Onboarding: alinea las plantillas de email con el modelo unificado (PRP-070).
--
-- 1) Crea las plantillas de email «Formación» y «Contratación» en cada empresa
--    (si no existen ya). El estado `formacion` unifica la antigua Teórica+Práctica
--    y el estado `contratacion` envía un correo genérico de bienvenida a la fase.
-- 2) Elimina las plantillas huérfanas «Teórica» y «Práctica» (residuo del rediseño
--    de onboarding: ya no las crea el seed y ningún estado/vacante las referencia).
-- 3) Backfill de `email_plantilla_id` en los estados de la plantilla de
--    reclutamiento: asocia cada estado sin email a su plantilla por nombre
--    (label del estado = nombre de la plantilla), incluyendo ahora Formación y
--    Contratación. Idempotente: no pisa ids ya asignados por el cliente.

-- ── 1) Crear «Formación» y «Contratación» por empresa (si faltan) ──
INSERT INTO reclutamiento_email_plantillas (empresa_id, nombre, asunto, cuerpo, activa)
SELECT e.id, v.nombre, v.asunto, v.cuerpo, true
FROM empresas e
CROSS JOIN (
  VALUES
    (
      'Formación',
      'Accede a tu formación — {{empresa_nombre}}',
      E'Hola {{candidato_nombre}},\n\n¡Enhorabuena! Superaste la entrevista y avanzamos contigo. Antes de continuar con el proceso, debes completar la formación. Es obligatoria.\n\nEn la formación conocerás la empresa, las normas internas, nuestra forma de trabajar, los procedimientos básicos y lo que esperamos del puesto.\n\n👉 Es imprescindible usar un ordenador con pantalla grande (no funciona bien en móvil).\n👉 Revisa todo el contenido con atención antes de continuar.\n\nAccede a la formación aquí:\n[Acceder a la formación]({{enlace_formacion}})\n\nCuando termines, Recursos Humanos revisará tu avance para continuar con el proceso. Si te surge cualquier duda, escríbenos a {{empresa_email}}.\n\n¡Nos vemos pronto, {{candidato_nombre}}!\n{{empresa_nombre}}'
    ),
    (
      'Contratación',
      'Iniciamos tu contratación — {{empresa_nombre}}',
      E'Hola {{candidato_nombre}},\n\n¡Enhorabuena! Iniciamos oficialmente tu proceso de contratación en {{empresa_nombre}}. A partir de ahora vamos a gestionar tu alta y la documentación de tu contrato.\n\nNormalmente en un plazo de 1 a 3 días desde la recepción de este correo recibirás DOS documentos para firmar:\n\n1. El CONTRATO LABORAL, con el que se comunica tu alta de forma legal al Estado.\n2. El CONTRATO INTERNO, con el que confirmas que aceptas las políticas internas de la empresa para sus trabajadores.\n\nCuando te lleguen, revísalos y fírmalos cuanto antes para no retrasar tu incorporación. Es importante que estés atento/a a tu bandeja de entrada (revisa también la carpeta de spam).\n\nSi te surge cualquier duda durante este proceso, escríbenos a {{empresa_email}}.\n\n¡Bienvenido/a, {{candidato_nombre}}! Estamos deseando tenerte en el equipo.\n{{empresa_nombre}}'
    )
) AS v(nombre, asunto, cuerpo)
WHERE EXISTS (
  -- Solo empresas que ya tienen biblioteca de plantillas de reclutamiento.
  SELECT 1 FROM reclutamiento_email_plantillas p WHERE p.empresa_id = e.id
)
AND NOT EXISTS (
  SELECT 1 FROM reclutamiento_email_plantillas p
  WHERE p.empresa_id = e.id AND p.nombre = v.nombre
);

-- ── 2) Eliminar plantillas huérfanas «Teórica» y «Práctica» ──
-- Seguro: no las referencia ningún estado (email_plantilla_id) ni override de
-- vacante. Si alguna estuviera referenciada, este DELETE no la tocaría porque el
-- backfill posterior nunca las reasigna; aun así se filtran por seguridad.
DELETE FROM reclutamiento_email_plantillas em
WHERE em.nombre IN ('Teórica', 'Práctica')
  AND NOT EXISTS (
    SELECT 1 FROM reclutamiento_plantillas_estado pe
    CROSS JOIN LATERAL jsonb_array_elements(pe.estados) e
    WHERE pe.empresa_id = em.empresa_id
      AND (e->>'email_plantilla_id') = em.id::text
  )
  AND NOT EXISTS (
    SELECT 1 FROM vacantes v
    WHERE v.empresa_id = em.empresa_id
      AND v.email_plantillas::text LIKE '%' || em.id || '%'
  );

-- ── 3) Backfill estado→email por nombre (incluye Formación y Contratación) ──
UPDATE reclutamiento_plantillas_estado pe
SET estados = sub.nuevos_estados
FROM (
  SELECT
    pe.id,
    jsonb_agg(
      CASE
        WHEN (e.value ->> 'email_plantilla_id') IS NULL AND em.id IS NOT NULL
          THEN e.value || jsonb_build_object('email_plantilla_id', em.id::text)
        ELSE e.value
      END
      ORDER BY e.ord
    ) AS nuevos_estados
  FROM reclutamiento_plantillas_estado pe
  CROSS JOIN LATERAL jsonb_array_elements(pe.estados) WITH ORDINALITY AS e(value, ord)
  LEFT JOIN reclutamiento_email_plantillas em
    ON em.empresa_id = pe.empresa_id
   AND em.nombre = (e.value ->> 'label')
  GROUP BY pe.id
) AS sub
WHERE pe.id = sub.id
  AND pe.estados IS DISTINCT FROM sub.nuevos_estados;
