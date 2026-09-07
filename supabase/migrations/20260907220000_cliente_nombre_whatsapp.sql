-- El nombre que la persona tiene puesto en WhatsApp, guardado tal cual.
--
-- Los 6.294 contactos que vinieron de Go High Level traían como nombre el del
-- perfil de WhatsApp. Al importarlos se limpió para poder usarlo ("Javi
-- Fernandez🤙🏻" → "Javi Fernandez") y en 449 casos se descartó entero, porque
-- era un emoji, una inicial o un punto.
--
-- Ese texto crudo, sin embargo, ES un dato: es como se llama esa persona en el
-- WhatsApp del restaurante, y es lo que ve quien abre la conversación. Si se
-- tira, un "❤️" en el móvil ya no se puede casar con la ficha de nadie.
--
-- Por eso vive aparte, y no encima de `nombre`:
--   · `nombre` es el nombre utilizable — el que va en un correo, en la reserva,
--     en la lista de sala. Puede estar vacío.
--   · `nombre_whatsapp` es el original, intacto, con sus emojis. No se usa para
--     dirigirse al cliente ni para buscar por nombre: es la referencia de por
--     dónde entró y cómo aparece en el chat.
--
-- No editable desde la ficha: no es una opinión del personal, es lo que traía
-- el perfil. Si el cliente cambia su nombre de WhatsApp, eso lo actualizaría
-- una importación, no una persona a mano.
--
-- Idempotente.

ALTER TABLE public.clientes_sala
  ADD COLUMN IF NOT EXISTS nombre_whatsapp text;

COMMENT ON COLUMN public.clientes_sala.nombre_whatsapp IS
  'Nombre del perfil de WhatsApp, tal cual venía (emojis incluidos). Dato de referencia, NO se usa para dirigirse al cliente: para eso está `nombre`, ya limpio. NULL = no entró por WhatsApp o no se conoce.';
