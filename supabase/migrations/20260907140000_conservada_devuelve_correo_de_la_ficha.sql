-- Una reserva CONSERVADA se quedaba con el correo que se había DESCARTADO.
--
-- Mientras la revisión está abierta, la reserva lleva el correo que escribió
-- quien reservó: la confirmación tiene que llegarle a él, porque puede no ser
-- el titular de la ficha. Al decidir "conservar" se está diciendo que SÍ es el
-- titular, así que ese correo queda descartado y todo lo que venga después
-- —la valoración, sobre todo— debe ir al de la ficha.
--
-- El código reasignaba `cliente_email` a su propio valor, que no cambia nada:
-- la reserva se quedaba con el correo descartado de por vida y la solicitud de
-- valoración se iba a una dirección que el restaurante había rechazado.
--
-- Los correos YA enviados no se tocan: `reserva_email_envios` guarda el
-- destinatario real de cada uno, así que el histórico sigue contando la verdad.
--
-- Idempotente: iguala dos columnas; repetirlo no cambia nada.

UPDATE public.reservas r
SET cliente_email = c.email
FROM public.clientes_sala c
WHERE c.id = r.cliente_id
  AND r.vinculacion_estado = 'CONSERVADA'
  AND c.email IS NOT NULL
  AND r.cliente_email IS DISTINCT FROM c.email;
