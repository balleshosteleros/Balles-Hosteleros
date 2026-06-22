-- Unifica/separa códigos de turno para que cada código represente un único
-- rol/horario (evita ambigüedad en el cuadrante y en la leyenda del PDF).
--
-- BACANAL:
--   • JEFE COCINA 2 VIERNES usaba "JF2" mientras el resto del puesto usa "JC2".
--     Se unifica la nomenclatura de jefes de cocina a "JC" + número.
--   • "ART" cubría dos turnos distintos de artistas (comidas mediodía y cenas
--     noche). Se separan en AR1 (comidas) y AR2 (cenas).
--
-- Idempotente: cada UPDATE comprueba el código de origen.

update rrhh_turnos set codigo = 'JC2' where id = 'bt-jf2-vie'     and codigo = 'JF2';
update rrhh_turnos set codigo = 'AR1' where id = 'bt-art-comidas' and codigo = 'ART';
update rrhh_turnos set codigo = 'AR2' where id = 'bt-art-cenas'   and codigo = 'ART';
