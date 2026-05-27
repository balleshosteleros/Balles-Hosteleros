-- ============================================================
-- 20260526210000_visita_defaults_persuasivos.sql
--
-- Ajusta los DEFAULT de `visita_config` con copy persuasivo
-- estilo aerolínea (genera más conversión que un "Bienvenidos a X").
-- Solo afecta a empresas NUEVAS; respeta lo que ya hay guardado.
-- ============================================================

ALTER TABLE public.visita_config
  ALTER COLUMN bienvenida_titulo SET DEFAULT 'Antes de pedir, déjate sorprender.';

ALTER TABLE public.visita_config
  ALTER COLUMN bienvenida_subtitulo SET DEFAULT
$$Los 3 platos secretos del chef
10% en tu próxima visita
Acceso anticipado a nuestros eventos$$;

ALTER TABLE public.visita_config
  ALTER COLUMN popup_titulo SET DEFAULT 'Estás a un paso de descubrirlo';

ALTER TABLE public.visita_config
  ALTER COLUMN popup_subtitulo SET DEFAULT
    'Te enviamos los 3 platos secretos y un descuento del 10% para tu próxima visita. Sin spam.';

ALTER TABLE public.visita_config
  ALTER COLUMN popup_boton_texto SET DEFAULT 'Sí, los quiero descubrir';
