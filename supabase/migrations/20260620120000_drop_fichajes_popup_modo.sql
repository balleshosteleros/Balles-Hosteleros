-- Retira el modo del aviso de fichar ("ventana" / "siempre").
-- Decisión de producto: el aviso SOLO puede saltar a empleados CON turno ese día
-- y SOLO dentro de la ventana (X min antes / X min después de su hora de entrada).
-- Se elimina el modo "siempre" (avisar todo el día): ya no existe en código.
-- Idempotente.

alter table public.empresa_fichajes_config
  drop column if exists popup_modo;
