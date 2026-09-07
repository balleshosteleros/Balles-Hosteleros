-- Una valoración puede haberse recogido por WhatsApp.
--
-- `resenas.origen` dice CÓMO se obtuvo la opinión: un correo de encuesta, el QR
-- de la carta, Google… Faltaba la vía por la que se ha recogido la mayoría de
-- las de BACANAL y HABANA: el equipo escribiendo por WhatsApp al comensal y
-- anotando lo que contestaba. Eso vivía en Go High Level y ahora entra aquí.
--
-- No se aprovecha 'otro' porque no es "otro": es el canal principal de calidad,
-- 17.642 valoraciones entre los dos restaurantes. Metido en un cajón de sastre
-- no se podría separar de lo que sí es residual.
--
-- `plataforma` (go_high_level / cover_manager / google) sigue siendo otra cosa:
-- el programa del que salió el registro. WhatsApp es el canal; GHL, la
-- herramienta que lo guardaba.
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
    'otro'
  ));

COMMENT ON COLUMN public.resenas.origen IS
  'Cómo se recogió la opinión: manual | encuesta (correo) | qr | carta | google | reserva | whatsapp | otro. NO confundir con `plataforma`, que es el programa del que viene el registro.';
