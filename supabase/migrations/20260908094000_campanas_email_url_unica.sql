-- El correo ya guardado apuntaba a su enlace del mes.
--
-- Las doce campañas del calendario se generaron con el HTML dentro (`payload`)
-- y el botón "Reservar mesa" llevaba grabada la URL de su mes:
-- `/reservar/email_enero`. Al dejar un solo enlace EMAIL, esas URLs quedaban
-- apuntando a una palabra clave que ya no existe. Aquí se reescriben.
--
-- Idempotente: cuando no queda ninguna URL con mes, no cambia nada.
update campanas_marketing
set payload = regexp_replace(payload::text, '/reservar/email_[a-z]+', '/reservar/email', 'g')::jsonb
where payload::text like '%/reservar/email\_%';
