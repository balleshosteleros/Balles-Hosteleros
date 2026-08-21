-- Puntuación desglosada de la visita: comida, servicio y ambiente por separado.
--
-- POR QUÉ desglosar: una nota global no dice qué arreglar. "3 estrellas" puede
-- ser una cocina excelente con un servicio lento, o al revés, y son dos
-- problemas de departamentos distintos. `rating` se mantiene como la media de
-- las tres para que todo lo que ya lee esa columna (pipeline de calidad,
-- estados, dashboards) siga funcionando sin cambios.
--
-- Los tres son opcionales: el cliente puede puntuar solo lo que quiera.
ALTER TABLE resenas
  ADD COLUMN IF NOT EXISTS rating_comida integer,
  ADD COLUMN IF NOT EXISTS rating_servicio integer,
  ADD COLUMN IF NOT EXISTS rating_ambiente integer;

DO $$
BEGIN
  ALTER TABLE resenas DROP CONSTRAINT IF EXISTS resenas_rating_comida_check;
  ALTER TABLE resenas ADD CONSTRAINT resenas_rating_comida_check
    CHECK (rating_comida IS NULL OR (rating_comida >= 1 AND rating_comida <= 5));

  ALTER TABLE resenas DROP CONSTRAINT IF EXISTS resenas_rating_servicio_check;
  ALTER TABLE resenas ADD CONSTRAINT resenas_rating_servicio_check
    CHECK (rating_servicio IS NULL OR (rating_servicio >= 1 AND rating_servicio <= 5));

  ALTER TABLE resenas DROP CONSTRAINT IF EXISTS resenas_rating_ambiente_check;
  ALTER TABLE resenas ADD CONSTRAINT resenas_rating_ambiente_check
    CHECK (rating_ambiente IS NULL OR (rating_ambiente >= 1 AND rating_ambiente <= 5));
END $$;

COMMENT ON COLUMN resenas.rating_comida IS
  'Puntuación 1-5 de la comida. NULL en reseñas de Google o si el cliente no la puntuó.';
COMMENT ON COLUMN resenas.rating_servicio IS
  'Puntuación 1-5 del servicio.';
COMMENT ON COLUMN resenas.rating_ambiente IS
  'Puntuación 1-5 del ambiente.';
