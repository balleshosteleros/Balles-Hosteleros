-- Carta digital: se elimina la función de horarios (no se editaba ni se mostraba).
-- La columna no tenía datos en uso. Idempotente.
ALTER TABLE public.empresas DROP COLUMN IF EXISTS carta_horarios;
