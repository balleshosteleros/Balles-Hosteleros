-- Elimina `buscar_cliente_sala_por_contacto`.
--
-- Servía a un único consumidor: la acción del formulario público que, antes de
-- reservar, comprobaba si el email o el teléfono ya tenían ficha y mostraba en
-- pantalla los datos del titular ("este teléfono pertenece a María López,
-- maria@…"). Eso convertía el formulario en una vía para averiguar el nombre y
-- el correo de cualquier cliente probando teléfonos ajenos.
--
-- Ese aviso se ha sustituido por otro que va al correo de quien reserva y que
-- no revela datos del titular. La acción que la llamaba ya no existe, así que
-- la función se retira: mientras siguiera publicada seguiría siendo invocable.
--
-- La deduplicación de clientes NO depende de esto: la hace
-- `find_or_link_cliente_sala`, que se mantiene intacta.
--
-- Idempotente.

DROP FUNCTION IF EXISTS public.buscar_cliente_sala_por_contacto(uuid, text, text);
