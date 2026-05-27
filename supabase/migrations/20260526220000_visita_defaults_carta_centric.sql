-- ============================================================
-- 20260526220000_visita_defaults_carta_centric.sql
--
-- Iteración 2 del copy de la landing: el cliente final QUIERE ver la
-- carta, así que el incentivo principal es "Ver carta + secretos".
-- Reescribe defaults a este enfoque (la suscripción es la llave, no la
-- barrera).
-- ============================================================

ALTER TABLE public.visita_config
  ALTER COLUMN bienvenida_titulo SET DEFAULT 'Desbloquea la carta y nuestros secretos.';

ALTER TABLE public.visita_config
  ALTER COLUMN bienvenida_subtitulo SET DEFAULT
$$La carta completa con fotos
Los 3 platos secretos del chef
10% en tu próxima visita$$;

ALTER TABLE public.visita_config
  ALTER COLUMN popup_titulo SET DEFAULT 'Un último paso para abrir la carta';

ALTER TABLE public.visita_config
  ALTER COLUMN popup_subtitulo SET DEFAULT
    'Te mandamos los 3 platos secretos y un 10% para la próxima. Sin spam.';

ALTER TABLE public.visita_config
  ALTER COLUMN popup_boton_texto SET DEFAULT 'Ver carta + secretos';
