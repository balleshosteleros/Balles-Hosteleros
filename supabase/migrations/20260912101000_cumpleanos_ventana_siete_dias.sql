-- La campaña de cumpleaños pasa de diez días a siete.
--
-- Siete antes y siete después: el cupón vale la semana previa y la siguiente,
-- que es cuando la gente celebra de verdad. Los días viven en el seed y los usa
-- el motor, pero el correo los lleva ESCRITOS en el cuerpo ("desde hoy —diez
-- días antes— hasta diez días después"), así que ese texto hay que reescribirlo
-- o el correo prometería una cosa y el cupón caducaría otra.
--
-- Idempotente: cuando ya no queda ningún texto con los diez días, no hace nada.
update campanas_marketing
set payload = jsonb_set(
      payload,
      '{cuerpoHtml}',
      to_jsonb(
        replace(
          replace(
            payload->>'cuerpoHtml',
            'Tienes tres semanas para gastarlo: desde hoy —diez días antes— hasta diez días después',
            'Tienes dos semanas para gastarlo: desde hoy —siete días antes— hasta siete días después'
          ),
          'diez días después de tu cumpleaños',
          'siete días después de tu cumpleaños'
        )
      )
    )
where payload->>'claveSeed' = 'CUMPLEANOS'
  and payload->>'cuerpoHtml' like '%diez días%';

-- El nombre de la campaña lo lee el restaurante en la pantalla de Marketing:
-- si dice "10 días antes" y el motor manda a los 7, nadie sabe cuál manda.
update campanas_marketing
set nombre = replace(nombre, 'Aviso 10 días antes', 'Aviso 7 días antes')
where nombre like '%Aviso 10 días antes%';
