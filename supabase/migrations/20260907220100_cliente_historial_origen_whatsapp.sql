-- La actividad del cliente admite un origen más: el nombre sacado de WhatsApp.
--
-- Cuando un contacto entra por WhatsApp, su nombre es el del perfil, y muchas
-- veces hay que descifrarlo: quitarle los emojis, pasar las letras de fantasía
-- a normales ("ℙ𝕒𝕓𝕝𝕠" → "Pablo") o juntar un nombre deletreado ("C L a u d i a"
-- → "Claudia"). Lo hace `shared/lib/nombre-desde-perfil.ts`.
--
-- Ese nombre NO lo escribió nadie del equipo, y en la ficha se vería igual que
-- uno confirmado por teléfono. Por eso queda anotado en la actividad del
-- cliente con su propio origen: quien lo mire sabe que salió de un perfil y
-- puede confirmarlo o corregirlo. El texto original se conserva en
-- `clientes_sala.nombre_whatsapp`.
--
-- Idempotente.

ALTER TABLE public.cliente_historial
  DROP CONSTRAINT IF EXISTS cliente_historial_origen_chk;

ALTER TABLE public.cliente_historial
  ADD CONSTRAINT cliente_historial_origen_chk
  CHECK (origen IN (
    'MANUAL',
    'AUTOMATICO',
    'PORTAL_PUBLICO',
    'GOOGLE_RWG',
    'PERFIL_WHATSAPP'
  ));

COMMENT ON COLUMN public.cliente_historial.origen IS
  'De dónde vino el cambio. PERFIL_WHATSAPP = el dato se dedujo del nombre de perfil de WhatsApp, no lo escribió una persona: está sin confirmar.';
