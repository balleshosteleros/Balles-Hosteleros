-- El enlace de reserva se identifica SOLO por su palabra clave.
--
-- El "nombre" era una etiqueta interna que ya no se pide al crear el enlace ni
-- se enseña en ninguna pantalla: en la lista salia la misma palabra dos veces
-- (pildora FACEBOOK + texto "Facebook"). Sin lector, la columna sobra.
--
-- Sin perdida de datos: los 9 enlaces existentes tenian el nombre calcado a su
-- palabra clave (Google, Instagram, Facebook, Email), ninguno con texto propio.
ALTER TABLE public.reserva_links DROP COLUMN IF EXISTS nombre;
