-- Retira el ajuste "Avisar aunque no tenga horario asignado".
-- Decisión de producto: el aviso de fichar SOLO debe saltar a empleados con
-- turno asignado ese día. La columna deja de tener uso en código.
-- Idempotente.

alter table public.empresa_fichajes_config
  drop column if exists popup_sin_horario;
