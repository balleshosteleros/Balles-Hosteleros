-- Agenda: fuera el campo WhatsApp y las etiquetas de contacto.
--
-- WhatsApp era un campo aparte que había que rellenar a mano, y en la práctica
-- siempre era el mismo número que el teléfono: de 117 contactos, NINGUNO lo
-- tenía relleno. Ahora el botón de WhatsApp se deduce del teléfono (móviles
-- 6/7; los fijos y los cortos de emergencias 112/091 no lo llevan), así que la
-- columna no aporta nada.
--
-- Las etiquetas eran una sub-clasificación dentro de cada categoría, pero el
-- botón para crearlas solo aparecía tras elegir una categoría concreta, así que
-- nunca se creó ninguna: 0 filas en la tabla, 0 contactos etiquetados. La
-- agenda se queda con las categorías, que sí se usan.

ALTER TABLE IF EXISTS public.contactos_agenda DROP COLUMN IF EXISTS whatsapp;
ALTER TABLE IF EXISTS public.contactos_agenda DROP COLUMN IF EXISTS etiqueta_id;

DROP TABLE IF EXISTS public.contacto_etiquetas;
