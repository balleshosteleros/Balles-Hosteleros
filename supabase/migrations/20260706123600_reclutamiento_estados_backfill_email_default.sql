-- Backfill: enlaza cada estado de la plantilla de reclutamiento con su plantilla
-- de email por defecto (`email_plantilla_id`).
--
-- PROBLEMA: el email por estado solo se sembraba cuando la plantilla de estados
-- se creaba de cero. Las empresas que ya tenían la plantilla cuando aún no
-- existían las plantillas de email suelta se quedaron con los estados SIN
-- `email_plantilla_id`. Consecuencia: al inscribirse un candidato, la resolución
-- de la plantilla «Nuevo» (portal público) devolvía null y el correo automático
-- NUNCA se enviaba ni quedaba registrado en la ficha del candidato.
--
-- Este backfill rellena `email_plantilla_id` en los estados que hoy no lo tienen
-- (ausente o null), resolviendo por nombre: el `label` del estado coincide con
-- el `nombre` de la plantilla de email de la misma empresa (p. ej. estado
-- «Nuevo» → plantilla de email «Nuevo»). Idempotente: NO pisa un id ya presente
-- (respeta cualquier elección previa del cliente) y solo asigna cuando existe la
-- plantilla de email correspondiente en la empresa.

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
  -- Solo actualiza plantillas donde algún estado va a cambiar (evita reescrituras
  -- innecesarias y hace la migración segura de re-ejecutar).
  AND pe.estados IS DISTINCT FROM sub.nuevos_estados;
