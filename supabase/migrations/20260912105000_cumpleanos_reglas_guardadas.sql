-- Las reglas que MANDAN están en la campaña, no en el seed.
--
-- `reglasDe()` lee `diasAntes`, `diasValidezDespues` y `amigosParaGratis` del
-- payload de cada campaña y solo cae al seed si no están. Como el sembrado las
-- escribió, cambiar el seed no cambiaba nada: el motor siguió mandando a diez
-- días y pidiendo diez amigos.
--
-- Aquí se ponen los valores acordados: siete días antes, siete después (catorce
-- en total) y nueve amigos, que con quien cumple hacen mesa de diez — la única
-- cifra con la que el 10% del cupón es EXACTAMENTE su parte.
--
-- Idempotente.
update campanas_marketing
set payload = payload
      || jsonb_build_object(
           'diasAntes', 7,
           'diasValidezDespues', 7,
           'amigosParaGratis', 9
         )
where payload->>'claveSeed' like 'CUMPLEANOS%'
  and (
    payload->>'diasAntes' is distinct from '7'
    or payload->>'diasValidezDespues' is distinct from '7'
    or payload->>'amigosParaGratis' is distinct from '9'
  );
