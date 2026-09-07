-- Una valoración puede llegar por la app o por la web.
--
-- `resenas.origen` ya distinguía la encuesta de la reserva, el WhatsApp y
-- Google. Faltan los dos canales propios:
--
--   · `web`  — el formulario de la página del restaurante. Es el que hace falta
--     para la newsletter con el sorteo mensual: quien deja sus datos ahí entra
--     por la web, no por una reserva.
--   · `app`  — desde la aplicación instalada en el móvil.
--
-- Se ponen como canales propios y no dentro de 'otro' por lo mismo que
-- 'whatsapp': si van a un cajón de sastre, no se puede medir qué trae cada vía
-- ni comparar la nota de quien opina desde la web con la de quien lo hace por
-- WhatsApp.
--
-- Idempotente.

ALTER TABLE public.resenas
  DROP CONSTRAINT IF EXISTS resenas_origen_check;

ALTER TABLE public.resenas
  ADD CONSTRAINT resenas_origen_check
  CHECK (origen IN (
    'manual',
    'encuesta',
    'qr',
    'carta',
    'google',
    'reserva',
    'whatsapp',
    'web',
    'app',
    'otro'
  ));

COMMENT ON COLUMN public.resenas.origen IS
  'Vía por la que llegó la opinión: whatsapp | reserva (encuesta de su reserva) | google | web (formulario de la página) | app | qr | carta | manual | encuesta | otro. NO es `plataforma`, que es el programa del que salió el registro.';
