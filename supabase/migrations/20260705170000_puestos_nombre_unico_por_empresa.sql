-- Nombre de puesto único por empresa (ignorando mayúsculas/minúsculas y espacios).
-- Dos puestos deben diferenciarse al menos en una letra.
--
-- Se refuerza en BD además de en el servidor (createPuesto/updatePuesto) para
-- blindar la regla ante concurrencia, imports o cualquier ruta alternativa.
-- Idempotente.

CREATE UNIQUE INDEX IF NOT EXISTS puestos_nombre_unico_por_empresa
  ON public.puestos (empresa_id, lower(btrim(nombre)));
