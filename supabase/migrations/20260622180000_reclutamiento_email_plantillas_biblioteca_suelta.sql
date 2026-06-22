-- Reclutamiento: las plantillas de EMAIL pasan a ser una BIBLIOTECA SUELTA.
--
-- Antes: `reclutamiento_email_plantillas` tenía 1 fila por (empresa_id, estado)
-- — cada plantilla estaba atada a un estado fijo del pipeline. Eso impedía
-- reutilizar correos en estados nuevos (plantillas de estado personalizadas).
--
-- Ahora: cada plantilla de email es independiente, identificada por `nombre`.
-- La asociación email↔estado vive EN la plantilla de estados (cada estado lleva
-- un `email_plantilla_id` por defecto dentro del jsonb `estados`) y, como
-- override por vacante, en `vacantes.email_plantillas` ({ estado_key: email_id }).
--
-- Esta migración CONSERVA los datos: convierte las 10 filas por estado en
-- plantillas con nombre y rellena automáticamente la asociación por defecto en
-- la plantilla de estados predeterminada y en las vacantes existentes.

-- ─────────────────────────────────────────────────────────────────────────
-- 1) Backfill de la asociación por defecto en las plantillas de ESTADOS.
--    Para cada item de `estados`, añade email_plantilla_id = id del email cuyo
--    `estado` (modelo viejo) coincide con la `key` del estado. Se hace ANTES de
--    eliminar la columna `estado`.
-- ─────────────────────────────────────────────────────────────────────────
DO $$
DECLARE
  pt        RECORD;
  item      jsonb;
  nuevos    jsonb;
  email_id  uuid;
BEGIN
  FOR pt IN SELECT id, empresa_id, estados FROM public.reclutamiento_plantillas_estado LOOP
    nuevos := '[]'::jsonb;
    FOR item IN SELECT * FROM jsonb_array_elements(COALESCE(pt.estados, '[]'::jsonb)) LOOP
      IF NOT (item ? 'email_plantilla_id') THEN
        SELECT id INTO email_id
          FROM public.reclutamiento_email_plantillas
          WHERE empresa_id = pt.empresa_id AND estado = (item->>'key')
          LIMIT 1;
        IF email_id IS NOT NULL THEN
          item := item || jsonb_build_object('email_plantilla_id', email_id::text);
        END IF;
      END IF;
      nuevos := nuevos || item;
    END LOOP;
    UPDATE public.reclutamiento_plantillas_estado SET estados = nuevos WHERE id = pt.id;
  END LOOP;
END $$;

-- ─────────────────────────────────────────────────────────────────────────
-- 2) Backfill de `vacantes.email_plantillas`: los valores eran el `estado` del
--    email (modelo viejo); se convierten al id de la plantilla de email.
-- ─────────────────────────────────────────────────────────────────────────
DO $$
DECLARE
  v         RECORD;
  k         text;
  val       text;
  nuevo_map jsonb;
  email_id  uuid;
BEGIN
  FOR v IN SELECT id, empresa_id, email_plantillas FROM public.vacantes
           WHERE email_plantillas IS NOT NULL AND email_plantillas <> '{}'::jsonb LOOP
    nuevo_map := '{}'::jsonb;
    FOR k, val IN SELECT key, value FROM jsonb_each_text(v.email_plantillas) LOOP
      -- Si ya es un uuid (valor nuevo), lo respeta; si no, lo trata como estado.
      SELECT id INTO email_id FROM public.reclutamiento_email_plantillas
        WHERE empresa_id = v.empresa_id AND (id::text = val OR estado = val)
        LIMIT 1;
      IF email_id IS NOT NULL THEN
        nuevo_map := nuevo_map || jsonb_build_object(k, email_id::text);
      END IF;
    END LOOP;
    UPDATE public.vacantes SET email_plantillas = nuevo_map WHERE id = v.id;
  END LOOP;
END $$;

-- ─────────────────────────────────────────────────────────────────────────
-- 3) Reestructura `reclutamiento_email_plantillas`: añade `nombre`, lo rellena
--    desde el estado, y elimina la dependencia del estado.
-- ─────────────────────────────────────────────────────────────────────────
ALTER TABLE public.reclutamiento_email_plantillas
  ADD COLUMN IF NOT EXISTS nombre text;

UPDATE public.reclutamiento_email_plantillas
SET nombre = CASE estado
  WHEN 'nuevo'              THEN 'Nuevo'
  WHEN 'elegido'            THEN 'Elegido'
  WHEN 'entrevista'         THEN 'Entrevista'
  WHEN 'teorica'            THEN 'Teórica'
  WHEN 'practica'           THEN 'Práctica'
  WHEN 'prueba'             THEN 'Prueba'
  WHEN 'empleado'           THEN 'Empleado'
  WHEN 'papelera'           THEN 'Papelera'
  WHEN 'no_se_presenta'     THEN 'No se presenta'
  WHEN 'suspenso_formacion' THEN 'Suspenso Formación'
  ELSE COALESCE(NULLIF(estado, ''), 'Plantilla')
END
WHERE nombre IS NULL OR nombre = '';

ALTER TABLE public.reclutamiento_email_plantillas
  ALTER COLUMN nombre SET NOT NULL;

-- La clave deja de ser el estado.
ALTER TABLE public.reclutamiento_email_plantillas
  DROP CONSTRAINT IF EXISTS reclutamiento_email_plantillas_unq;
ALTER TABLE public.reclutamiento_email_plantillas
  DROP CONSTRAINT IF EXISTS reclutamiento_email_plantillas_estado_chk;
ALTER TABLE public.reclutamiento_email_plantillas
  DROP COLUMN IF EXISTS estado;

-- Identidad por nombre dentro de la empresa (la usa el sync aditivo).
ALTER TABLE public.reclutamiento_email_plantillas
  ADD CONSTRAINT reclutamiento_email_plantillas_nombre_unq UNIQUE (empresa_id, nombre);

COMMENT ON TABLE public.reclutamiento_email_plantillas IS
  'Biblioteca de plantillas de correo de Reclutamiento por empresa (sueltas, identificadas por nombre). La asociación a estados vive en reclutamiento_plantillas_estado.estados[].email_plantilla_id y en vacantes.email_plantillas.';

-- ─────────────────────────────────────────────────────────────────────────
-- 4) Plantillas de estados: se elimina la columna `descripcion` (sin uso).
-- ─────────────────────────────────────────────────────────────────────────
ALTER TABLE public.reclutamiento_plantillas_estado
  DROP COLUMN IF EXISTS descripcion;
