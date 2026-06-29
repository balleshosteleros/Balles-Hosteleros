-- Experiencia previa del candidato (selector obligatorio en el portal de empleo).
-- 4 tramos: sin experiencia + 3 rangos, el último abierto.
--   sin_experiencia | menos_1 | de_1_a_5 | mas_5
-- Idempotente: se puede ejecutar varias veces sin error.

ALTER TABLE public.candidatos
  ADD COLUMN IF NOT EXISTS experiencia_previa text;

-- Solo aceptamos los 4 valores canónicos (o NULL para datos antiguos).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'candidatos_experiencia_previa_chk'
  ) THEN
    ALTER TABLE public.candidatos
      ADD CONSTRAINT candidatos_experiencia_previa_chk
      CHECK (experiencia_previa IS NULL OR experiencia_previa IN
        ('sin_experiencia', 'menos_1', 'de_1_a_5', 'mas_5'));
  END IF;
END $$;

COMMENT ON COLUMN public.candidatos.experiencia_previa IS
  'Tramo de experiencia previa declarado por el candidato: sin_experiencia | menos_1 | de_1_a_5 | mas_5';
