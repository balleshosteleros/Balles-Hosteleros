-- El pie del correo decía algo que no es verdad para la mayoría.
--
-- Decía "recibes este correo porque nos diste permiso para escribirte al
-- reservar", pero la mayoría de las fichas nunca marcaron ninguna casilla: son
-- reservas hechas por teléfono y apuntadas a mano. Lo que sí es cierto de todos
-- es que han reservado aquí, y eso —con la baja a un clic— es lo que sostiene
-- el envío. Mentir justo en la línea que explica por qué le escribimos es lo
-- que convierte una baja en una denuncia.
--
-- Idempotente.
update campanas_marketing
set payload = jsonb_set(
      payload,
      '{cuerpoHtml}',
      to_jsonb(
        replace(
          payload->>'cuerpoHtml',
          'Recibes este correo porque nos diste permiso para escribirte al reservar.',
          'Recibes este correo porque eres cliente nuestro y has reservado con nosotros.'
        )
      )
    )
where payload->>'cuerpoHtml' like '%nos diste permiso para escribirte al reservar%';
