-- Puestos: vacaciones 30 días y jornada por defecto en todos los puestos.
--
-- 1) Los puestos sin fila en `puesto_salarios` no tenían condiciones, así que
--    la ficha los pintaba a cero y con la jornada vacía. Se les crea el nivel 1.
-- 2) Se normalizan las vacaciones a "30 días" (había un "30" suelto).
-- 3) La jornada pasa a ser Completa o Partida (antes existía "Parcial").
--
-- Idempotente: se puede reejecutar sin duplicar ni pisar datos ya correctos.

BEGIN;

-- 1) Nivel 1 para los puestos que no tienen condiciones todavía.
INSERT INTO puesto_salarios (
  empresa_id, puesto_id, nivel, salario_bruto,
  jornada_contrato, vacaciones, estado
)
SELECT p.empresa_id, p.id, 1, 0, 'Completa', '30 días', 'activo'
FROM puestos p
WHERE NOT EXISTS (
  SELECT 1 FROM puesto_salarios ps
  WHERE ps.puesto_id = p.id AND ps.nivel = 1
)
ON CONFLICT (puesto_id, nivel) DO NOTHING;

-- 2) Vacaciones: 30 días en todos los puestos que no lo tengan ya puesto.
UPDATE puesto_salarios
SET vacaciones = '30 días', updated_at = now()
WHERE vacaciones IS NULL
   OR btrim(vacaciones) = ''
   OR btrim(vacaciones) = '30';

-- 3) Jornada: solo Completa o Partida. Lo que no sea Partida pasa a Completa
--    ("Parcial" era un valor libre heredado del campo de texto anterior).
UPDATE puesto_salarios
SET jornada_contrato = 'Partida', updated_at = now()
WHERE lower(btrim(coalesce(jornada_contrato, ''))) IN ('partida', 'parcial');

UPDATE puesto_salarios
SET jornada_contrato = 'Completa', updated_at = now()
WHERE coalesce(btrim(jornada_contrato), '') NOT IN ('Completa', 'Partida');

COMMIT;
