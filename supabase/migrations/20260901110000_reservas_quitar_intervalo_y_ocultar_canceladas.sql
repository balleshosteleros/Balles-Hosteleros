-- Reservas: el intervalo deja de ser configurable y "ocultar canceladas" desaparece.
--
--   * Los huecos de reserva van SIEMPRE en 00, 15, 30 y 45 (grid fijo de 15 min).
--     Está aplicado en código (RESERVA_SLOT_MIN), no en configuración: nadie
--     puede elegir 5/10/30/45/60 ni horas intermedias.
--   * La visibilidad de reservas canceladas se decide con el filtro de estados
--     de la vista de reservas, no con una preferencia guardada.
--
-- Idempotente.

ALTER TABLE public.empresa_reservas_config
  DROP CONSTRAINT IF EXISTS empresa_reservas_config_intervalo_reserva_min_chk;

ALTER TABLE public.empresa_reservas_config
  DROP COLUMN IF EXISTS intervalo_reserva_min,
  DROP COLUMN IF EXISTS ocultar_canceladas;
