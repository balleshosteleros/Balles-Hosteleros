-- Sofía Terrón cobra 100,00 € todos los meses y SIEMPRE por complemento:
-- no tiene nómina, ni Seguridad Social, ni IRPF. Así está cargada de enero a
-- julio de 2026, pero en junio se quedó sin fila (el mes tenía 11 personas
-- en vez de 12), así que ese pago no aparecía por ninguna parte.
--
-- Se crea la fila que faltaba con el mismo criterio que el resto de sus meses.
-- Junio ya estaba liquidado, así que nace pagada y con la misma marca de pago
-- y de confirmación que sus compañeros de ese mes.
--
-- El trigger de bloqueo de liquidación solo protege las modificaciones, no las
-- altas, así que no hace falta desactivarlo.
--
-- Idempotente: el ON CONFLICT evita duplicar si la fila ya existiera.

insert into public.rrhh_pagos (
  empresa_id, empleado_id, empleado_nombre, periodo, fijo,
  nomina, horas_reales, horas_trabajadas, complemento, ajuste, horas_extras, bonus,
  ss_empleado, ss_empresa, irpf, total,
  pagado, pagado_at, confirmacion_enviada_at
)
select id, '65d193e2-28dc-43f4-b93a-4be069632c39'::uuid, 'Sofia Terrón', '2026-06', true,
       0.00, 0.0, 0.0, 100.00, 0.00, 0.00, 0.00,
       0.00, 0.00, 0.00, 100.00,
       true, '2026-09-01 11:03:57.740993+00'::timestamptz, '2026-08-29 05:45:55.624408+00'::timestamptz
from public.empresas where nombre='BACANAL'
on conflict (empresa_id, empleado_id, periodo) do nothing;
