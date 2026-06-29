-- PRP-070 · Fase 1 — Rediseño de fases del pipeline de reclutamiento.
--
-- Unifica los estados "teorica" y "practica" en un único estado "formacion".
-- Las fases nuevas (Contratación, Prueba, Empleado) no requieren migración de
-- datos: ningún candidato existente está en ellas todavía.
--
-- El estado del candidato es texto libre desde 20260623131000 (sin constraint),
-- así que basta con reasignar el valor. Idempotente: solo afecta a filas que aún
-- estén en los estados legacy.

-- 1) Candidatos en "teorica" o "practica" → "formacion".
UPDATE public.candidatos
SET estado = 'formacion'
WHERE estado IN ('teorica', 'practica');

-- 2) Historial de actividad: normaliza referencias a los estados legacy en las
--    columnas de estado nuevo/anterior, conservando la traza pero alineándola
--    con el modelo actual. Solo si la tabla y columnas existen.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'candidato_historial'
      AND column_name = 'estado_nuevo'
  ) THEN
    UPDATE public.candidato_historial
    SET estado_nuevo = 'formacion'
    WHERE estado_nuevo IN ('teorica', 'practica');
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'candidato_historial'
      AND column_name = 'estado_anterior'
  ) THEN
    UPDATE public.candidato_historial
    SET estado_anterior = 'formacion'
    WHERE estado_anterior IN ('teorica', 'practica');
  END IF;
END $$;
