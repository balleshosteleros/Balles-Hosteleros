-- ============================================================
-- 20260826240000_cierres_plazo_maximo_3_dias.sql
-- Cierres (Gerencia): el plazo para apuntar con fecha atrasada baja a
-- un MÁXIMO DURO de 3 días.
--
-- Motivo: el efectivo acumulado se calcula en cadena sobre los apuntes
-- ordenados por fecha. Meter un cierre antiguo recalcula todo lo posterior
-- y altera el saldo de caja actual. La ventana se queda corta a propósito.
--
-- · default: 7 → 3
-- · CHECK: 0..365 → 0..3 (0 sigue significando "sin bloqueo")
-- · filas existentes con más de 3 días se recortan a 3
-- Idempotente.
-- ============================================================

-- El CHECK viejo se quita ANTES de recortar los datos: si no, el UPDATE
-- chocaría con la restricción nueva al validarla sobre filas antiguas.
alter table public.cierres_config
  drop constraint if exists cierres_config_dias_bloqueo_chk;

alter table public.cierres_config
  alter column dias_bloqueo set default 3;

-- Plazos guardados por encima del tope (7 por defecto histórico, o lo que
-- se hubiera configurado) pasan a 3. El 0 se respeta: es "sin bloqueo".
update public.cierres_config
  set dias_bloqueo = 3
  where dias_bloqueo > 3;

alter table public.cierres_config
  add constraint cierres_config_dias_bloqueo_chk
  check (dias_bloqueo >= 0 and dias_bloqueo <= 3);
