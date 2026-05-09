-- ============================================================
-- 101_estudios_apertura_ocupacion.sql
--
-- Añade el bloque `ocupacion` a `estudios_apertura`. Persiste la
-- estimación de ocupación del local (matriz día × franja horaria)
-- por escenario (Conservador / Realista / Optimista, ampliable).
--
-- Estructura JSON esperada:
--   {
--     "escenarios": [
--       {
--         "id": "esc-realista",
--         "nombre": "Realista",
--         "color": "hsl(150 60% 45%)",
--         "matriz": {
--           "lunes":     { "desayuno": 30, "comida": 70, "cena": 60 },
--           "martes":    { ... },
--           …
--         }
--       },
--       …
--     ],
--     "escenarioActivoId": "esc-realista"
--   }
--
-- Las RLS heredan de la fila (ya cubierto por 099). No hay storage
-- nuevo.
-- ============================================================

ALTER TABLE public.estudios_apertura
  ADD COLUMN IF NOT EXISTS ocupacion jsonb NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public.estudios_apertura.ocupacion IS
  'Estimación de ocupación: matriz día × franja horaria (desayuno/comida/cena, 6h cada una desde 06:00) por escenario.';
