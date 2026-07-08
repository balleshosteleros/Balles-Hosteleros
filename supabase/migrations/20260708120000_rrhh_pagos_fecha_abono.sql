-- Fecha de abono del pago (rrhh_pagos).
-- Hasta ahora "pagado" era solo un booleano toggle: no se sabía CUÁNDO se abonó
-- ni quién lo marcó. Con estas columnas el pago se convierte en un hecho fechado
-- que alimenta el histórico de pagos del empleado ("Abonado el DD/MM").
--
--   pagado_at  -> instante en que RRHH marcó el pago como abonado (UTC).
--   pagado_por -> usuario que lo marcó.
--
-- Ambas se rellenan al marcar pagado y se limpian al desmarcar (ver marcarPagado).
-- Idempotente: re-ejecutable sin error.

alter table public.rrhh_pagos
  add column if not exists pagado_at  timestamptz,
  add column if not exists pagado_por uuid;

comment on column public.rrhh_pagos.pagado_at is
  'Instante en que se marcó el pago como abonado. NULL = aún no pagado. Alimenta el histórico del empleado.';
comment on column public.rrhh_pagos.pagado_por is
  'Usuario que marcó el pago como abonado.';

-- El trigger de bloqueo (liquidación enviada = inmutable) NO debe cubrir estos
-- campos: marcar/desmarcar el pago sucede DESPUÉS de enviar la liquidación y es
-- precisamente una acción permitida sobre una liquidación ya enviada (igual que
-- `pagado`, que ya está excluido del check de inmutabilidad).
