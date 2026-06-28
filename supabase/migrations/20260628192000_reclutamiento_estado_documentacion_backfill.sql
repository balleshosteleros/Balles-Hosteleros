-- Backfill del estado «Documentación» (fase Formación, antes de Teórica) en las
-- plantillas de estado YA EXISTENTES de cada empresa.
--
-- El sync canónico (src/lib/seeds/sync.ts) también lo añade en runtime de forma
-- aditiva, pero esta migración garantiza el estado en BD de inmediato, idempotente:
--   · Inserta el item `documentacion` en `estados` SOLO si la plantilla aún no lo
--     tiene (por key), justo antes de `teorica` (o al final si no hay teorica).
--   · Asocia por defecto la plantilla de email «Documentación» de la misma
--     empresa, si existe (si no, queda sin email por defecto → null).
--   · No reescribe label/orden/email de los estados existentes (respeta
--     personalizaciones del cliente).

-- ── 0) Sembrar la plantilla de email «Documentación» en cada empresa que no la
--    tenga (mismo texto que el seed canónico reclutamiento-email-plantillas.ts).
INSERT INTO public.reclutamiento_email_plantillas (empresa_id, nombre, asunto, cuerpo, activa)
SELECT e.id,
  'Documentación',
  'Documentación necesaria para tu incorporación — {{empresa_nombre}}',
  'Hola {{candidato_nombre}},

¡Enhorabuena! Pasas a la siguiente fase del proceso. Antes de empezar la formación, necesitamos que nos aportes tu documentación para poder gestionar tu alta.

Tendrás que adjuntar (puedes hacer una foto con el móvil o subir un archivo):
A. Tu DNI o NIE, por las dos caras (anverso y reverso). Si eres extranjero/a, vale el pasaporte.
B. Un documento donde se vea tu número de cuenta bancaria (IBAN).
C. Un documento donde se vea tu número de la Seguridad Social.

👉 Entra en este enlace personal y sigue los pasos:
{{enlace_documentacion}}

Nuestro sistema leerá automáticamente los números de tus documentos y te los mostrará para que los revises y confirmes que son correctos. Es muy rápido.

Si te surge cualquier duda, escríbenos a {{empresa_email}}.

¡Gracias y nos vemos pronto, {{candidato_nombre}}!
{{empresa_nombre}}',
  true
FROM public.empresas e
WHERE NOT EXISTS (
  SELECT 1 FROM public.reclutamiento_email_plantillas p
  WHERE p.empresa_id = e.id AND p.nombre = 'Documentación'
);

-- ── 1) Insertar el estado `documentacion` antes de `teorica` en las plantillas
DO $$
DECLARE
  pt          RECORD;
  item        jsonb;
  nuevos      jsonb;
  insertado   boolean;
  email_id    uuid;
  nuevo_item  jsonb;
BEGIN
  FOR pt IN
    SELECT id, empresa_id, estados FROM public.reclutamiento_plantillas_estado
  LOOP
    -- ¿Ya tiene el estado documentacion? → no tocar.
    IF EXISTS (
      SELECT 1 FROM jsonb_array_elements(COALESCE(pt.estados, '[]'::jsonb)) e
      WHERE e->>'key' = 'documentacion'
    ) THEN
      CONTINUE;
    END IF;

    -- Email por defecto «Documentación» de esta empresa (si existe).
    SELECT id INTO email_id
      FROM public.reclutamiento_email_plantillas
      WHERE empresa_id = pt.empresa_id AND nombre = 'Documentación'
      LIMIT 1;

    nuevo_item := jsonb_build_object(
      'key', 'documentacion',
      'label', 'Documentación',
      'color', 'hsl(145, 63%, 42%)',
      'fase', 'formacion',
      'orden', 4
    );
    IF email_id IS NOT NULL THEN
      nuevo_item := nuevo_item || jsonb_build_object('email_plantilla_id', email_id::text);
    END IF;

    -- Reconstruye el array insertando documentacion justo ANTES de teorica.
    nuevos := '[]'::jsonb;
    insertado := false;
    FOR item IN SELECT * FROM jsonb_array_elements(COALESCE(pt.estados, '[]'::jsonb)) LOOP
      IF NOT insertado AND item->>'key' = 'teorica' THEN
        nuevos := nuevos || nuevo_item;
        insertado := true;
      END IF;
      nuevos := nuevos || item;
    END LOOP;
    -- Si no había teorica, lo añade al final.
    IF NOT insertado THEN
      nuevos := nuevos || nuevo_item;
    END IF;

    UPDATE public.reclutamiento_plantillas_estado
      SET estados = nuevos
      WHERE id = pt.id;
  END LOOP;
END $$;

-- ── 2) Renumerar `orden` = posición en el array (evita el empate documentacion=4
--    / teorica=4 al insertar) y asociar el email «Documentación» al item si le
--    falta. Idempotente: respeta keys, labels, colores y otros emails.
DO $$
DECLARE
  pt        RECORD;
  item      jsonb;
  nuevos    jsonb;
  idx       int;
  email_id  uuid;
BEGIN
  FOR pt IN SELECT id, empresa_id, estados FROM public.reclutamiento_plantillas_estado LOOP
    SELECT id INTO email_id
      FROM public.reclutamiento_email_plantillas
      WHERE empresa_id = pt.empresa_id AND nombre = 'Documentación'
      LIMIT 1;

    nuevos := '[]'::jsonb;
    idx := 0;
    FOR item IN SELECT * FROM jsonb_array_elements(COALESCE(pt.estados, '[]'::jsonb)) LOOP
      idx := idx + 1;
      item := item || jsonb_build_object('orden', idx);
      IF item->>'key' = 'documentacion' AND email_id IS NOT NULL
         AND NOT (item ? 'email_plantilla_id' AND item->>'email_plantilla_id' IS NOT NULL) THEN
        item := item || jsonb_build_object('email_plantilla_id', email_id::text);
      END IF;
      nuevos := nuevos || item;
    END LOOP;

    UPDATE public.reclutamiento_plantillas_estado SET estados = nuevos WHERE id = pt.id;
  END LOOP;
END $$;
