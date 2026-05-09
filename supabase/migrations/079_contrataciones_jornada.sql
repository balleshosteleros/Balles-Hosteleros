ALTER TABLE public.contrataciones
  ADD COLUMN IF NOT EXISTS jornada_horas integer
  CHECK (jornada_horas IS NULL OR (jornada_horas >= 1 AND jornada_horas <= 40));
