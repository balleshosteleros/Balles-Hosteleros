-- Permiso de correo a todos los clientes de los restaurantes.
--
-- Decisión de Iván (12-09-2026). La migración de CoverManager trajo el permiso
-- tal y como venía —unos lo tenían y otros no, según hubieran reservado por la
-- web o por teléfono—, y eso dejaba fuera a dos tercios de la casa.
--
-- Quien se marca AHORA queda señalado como `CLIENTE_PREVIO` con su fecha, así
-- que en todo momento se puede distinguir a quien marcó la casilla él mismo
-- (`RESERVA_WEB`, `WEB_SORTEO`, o el permiso que vino de Cover, sin origen) de
-- quien entra por esta decisión. Sin eso, se perdería para siempre quién dijo
-- que sí de verdad, que es lo único que se puede enseñar ante una reclamación.
--
-- NUNCA toca a quien se dio de baja: la baja deja fecha en
-- `marketing_baja_email_at` y esa es la negativa expresa que no se revierte.
--
-- Solo los restaurantes. BALLES es la gestora y sus contactos no son clientes
-- de mesa: meterlos aquí sería escribirles sin haber pisado nunca el local.
--
-- Idempotente.
update clientes_sala c
set acepta_marketing_email = true,
    marketing_optin_at = now(),
    marketing_optin_origen = 'CLIENTE_PREVIO'
from empresas e
where e.id = c.empresa_id
  and e.nombre in ('BACANAL', 'HABANA')
  and c.marketing_baja_email_at is null
  and coalesce(c.acepta_marketing_email, false) = false;
