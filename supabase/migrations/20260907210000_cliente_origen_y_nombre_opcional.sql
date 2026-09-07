-- Por dónde entró el CLIENTE, y el nombre deja de ser obligatorio.
--
-- Hasta ahora el origen solo existía en la reserva (`reservas.origen`): sabíamos
-- por qué canal entró cada mesa, pero no por dónde apareció la persona la
-- primera vez. Y no es lo mismo: un cliente puede darnos sus datos sin reservar
-- nunca — escribiendo por WhatsApp, o dejando el correo en una landing de
-- newsletter. Eso, hasta hoy, no se podía anotar en ningún sitio.
--
-- Catálogo ABIERTO a propósito, igual que `reservas.origen`: los valores se leen
-- con `sala/data/origenes.ts`, que normaliza el texto crudo a una clave estable
-- y le da etiqueta y color. Un CHECK cerrado dejaría fuera cualquier canal nuevo
-- (una campaña, un portal) y habría que tocar código para añadirlo.
--
-- NULL significa "no se sabe por dónde entró", que es distinto de un canal. No
-- se rellena con un cajón "Otros": lo que falta se rotula como que falta.
--
-- El NOMBRE pasa a ser opcional. Los contactos que llegan por WhatsApp traen
-- como nombre lo que la persona tenga puesto en su perfil, que muchas veces es
-- un emoji, una inicial o un punto ("❤️", "S.", "😎🙃🤓"). Eso no es un nombre:
-- guardarlo ensucia la búsqueda y el listado, y peor aún, aparece en un correo
-- o un WhatsApp dirigido a "Hola ❤️". Se deja vacío y en pantalla se lee
-- "Sin nombre" — al cliente se le identifica por su teléfono, que sí es bueno.
--
-- Idempotente: se puede ejecutar las veces que haga falta.

ALTER TABLE public.clientes_sala
  ADD COLUMN IF NOT EXISTS origen text;

COMMENT ON COLUMN public.clientes_sala.origen IS
  'Canal por el que el cliente nos dejó sus datos la PRIMERA vez: WEB, GOOGLE, WHATSAPP, EMAIL (landing/newsletter), TELEFONO, WALKIN, INSTAGRAM… Catálogo abierto, se lee con sala/data/origenes.ts. NO es el origen de sus reservas (eso es reservas.origen). NULL = no se sabe.';

CREATE INDEX IF NOT EXISTS clientes_sala_empresa_origen_idx
  ON public.clientes_sala (empresa_id, origen);

-- El nombre deja de ser obligatorio (ver cabecera).
ALTER TABLE public.clientes_sala
  ALTER COLUMN nombre DROP NOT NULL;

COMMENT ON COLUMN public.clientes_sala.nombre IS
  'Nombre de pila. Puede ser NULL: los contactos que entran por WhatsApp traen el nombre del perfil, que a veces es un emoji o una inicial y no sirve. En pantalla, vacío se lee "Sin nombre".';
