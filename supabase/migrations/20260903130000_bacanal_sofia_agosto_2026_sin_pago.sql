-- Sofía Terrón no cobra en agosto de 2026: no aparece en el Excel de ese mes.
-- La fila existía en rrhh_pagos con 100,00 € puestos además como nómina (ella
-- siempre cobra por complemento), así que era doblemente errónea: ni el mes ni
-- la columna.
--
-- Se borra. La fila estaba sin pagar y sin confirmación enviada, o sea que no
-- había ningún pago real ni ningún aviso mandado detrás.
--
-- Idempotente: las condiciones del WHERE hacen que no borre nada si la fila ya
-- no existe o si en algún momento pasara a estar pagada o confirmada.

delete from public.rrhh_pagos
where empleado_id = '65d193e2-28dc-43f4-b93a-4be069632c39'
  and periodo = '2026-08'
  and empresa_id = (select id from public.empresas where nombre='BACANAL')
  and pagado = false
  and confirmacion_enviada_at is null;
