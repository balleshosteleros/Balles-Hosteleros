-- El correo ya escrito llevaba el enlace sin campaña.
--
-- Las campañas se sembraron con el HTML dentro (`payload`) y su botón apunta a
-- `…/reservar/email`. Ahora cada una tiene su palabra, así que el enlace pasa a
-- `…/reservar/email?c=enero` y la mesa se puede atribuir al correo que la trajo.
--
-- Solo toca las que tienen palabra: las de SMS y WhatsApp de cumpleaños no la
-- tienen todavía y se quedan como están.
--
-- Idempotente: el patrón exige un carácter después de `email` que no sea `?`,
-- así que una URL ya reescrita no se vuelve a tocar.
update campanas_marketing
set payload = regexp_replace(
      payload::text,
      '/reservar/email([^?])',
      '/reservar/email?c=' || palabra || '\1',
      'g'
    )::jsonb
where palabra is not null
  and payload::text like '%/reservar/email%';
