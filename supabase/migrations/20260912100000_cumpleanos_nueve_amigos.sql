-- La mesa del cumpleaños pasa de once a diez.
--
-- Con once, una parte es el 9% de la cuenta y el cupón del 10% cubría lo suyo
-- "y sobraba un poco". Con diez sale clavado: el 10% ES exactamente su parte,
-- así que "vienes con nueve amigos y no pagas" se sostiene al céntimo.
--
-- El número de amigos viaja como marcador `{{AMIGOS}}` dentro del correo, así
-- que el cuerpo no hay que tocarlo: lo rellena el motor con la regla nueva. Solo
-- el preheader llevaba el número escrito a mano.
--
-- Idempotente.
update campanas_marketing
set payload = jsonb_set(
      payload,
      '{preheader}',
      to_jsonb('Un 10% de descuento por tu cumpleaños. Y si venís diez, no pagas nada.'::text)
    )
where payload->>'claveSeed' = 'CUMPLEANOS'
  and canal = 'email'
  and payload->>'preheader' is distinct from
      'Un 10% de descuento por tu cumpleaños. Y si venís diez, no pagas nada.';
