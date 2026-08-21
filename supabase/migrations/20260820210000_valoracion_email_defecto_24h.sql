-- El plazo por defecto de la solicitud de valoración pasa de 20 h a 24 h:
-- "un día después" es más fácil de razonar que "20 horas" y cae a la misma
-- hora de la visita, sin madrugar al cliente.
ALTER TABLE empresa_reservas_config
  ALTER COLUMN valoracion_email_horas_despues SET DEFAULT 24;

-- Las empresas que ya existían se quedaron con el defecto anterior (20). Se
-- actualizan solo esas: si alguien hubiera elegido otro plazo a propósito, su
-- decisión no se toca.
UPDATE empresa_reservas_config
  SET valoracion_email_horas_despues = 24
  WHERE valoracion_email_horas_despues = 20;
