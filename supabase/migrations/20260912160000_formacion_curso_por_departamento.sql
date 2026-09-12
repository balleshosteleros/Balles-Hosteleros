-- Un curso de formación por DEPARTAMENTO.
--
-- Hasta ahora los cursos iban por PUESTO: 55 entre las tres empresas (CAMARERO,
-- COCINERO, ABOGADO…), todos vacíos. Pero la formación se organiza por
-- departamento, no puesto a puesto: el temario de SALA es el mismo para el
-- camarero y para el jefe de sala.
--
-- Los cursos por puesto NO se tocan: siguen existiendo y pueden llevar lo
-- específico de cada puesto el día que haga falta.
--
-- Idempotente.

ALTER TABLE formacion_cursos ADD COLUMN IF NOT EXISTS departamento_id UUID
  REFERENCES departamentos(id) ON DELETE CASCADE;

-- Un solo curso por departamento. Es lo que hace idempotente el alta
-- automática: volver a pasarla no duplica nada.
CREATE UNIQUE INDEX IF NOT EXISTS formacion_cursos_departamento_uniq
  ON formacion_cursos (departamento_id)
  WHERE departamento_id IS NOT NULL;

ALTER TABLE formacion_cursos DROP CONSTRAINT IF EXISTS formacion_cursos_ambito_check;
ALTER TABLE formacion_cursos
  ADD CONSTRAINT formacion_cursos_ambito_check
  CHECK (ambito = ANY (ARRAY['general', 'puesto', 'departamento', 'escuela']));
