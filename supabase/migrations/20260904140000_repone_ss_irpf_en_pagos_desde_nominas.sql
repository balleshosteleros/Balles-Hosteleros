-- Repone en `rrhh_pagos` la Seguridad Social y el IRPF que ya estaban leídos en
-- las nóminas subidas (`rrhh_pagos_nominas`) pero nunca llegaron a la fila de pago.
--
-- QUÉ PASÓ. Al volcar una nómina, el sistema hace dos cosas: guarda la nómina
-- individual y recalcula la SUMA del empleado/mes sobre `rrhh_pagos`. En las
-- cargas de enero–mayo de 2026 el `nomina` (neto) sí se propagó, pero
-- `ss_empleado`, `ss_empresa` e `irpf` se quedaron a 0. El dato nunca se perdió:
-- sigue en `rrhh_pagos_nominas`. Las cargas de junio en adelante están bien.
--
-- CONSECUENCIA. El desglose que el trabajador ve en su panel de pagos ("lo que
-- paga la empresa por ti a la Seguridad Social") no se pintaba en esos meses,
-- porque sin dato leído el bloque se oculta en vez de mostrar 0 € (0 calculado
-- no es lo mismo que dato sin calcular).
--
-- SEGURIDAD. Estos tres campos son INFORMATIVOS: no son sumandos de `total`, que
-- es lo que cobra el trabajador. La migración NO toca `nomina`, `total` ni
-- ningún campo de importe percibido: nadie cobra ni un céntimo distinto.
--
-- IDEMPOTENTE. Solo actualiza filas cuyo campo está a 0 teniendo dato en las
-- nóminas. Al segundo pase no encuentra nada que hacer.

-- CANDADOS. `rrhh_pagos` tiene dos triggers que impiden tocar importes de una
-- liquidación ya enviada al trabajador (`trg_rrhh_pagos_lock`) o ya con nómina
-- (`trg_rrhh_pagos_lock_nomina`). Hacen bien su trabajo: aquí se desactivan solo
-- durante esta reparación y se vuelven a activar en la misma transacción, así
-- que si algo falla el rollback los deja puestos. NO se relaja la regla: lo que
-- se repone es exactamente lo que dice la nómina que ya estaba subida.

begin;

alter table rrhh_pagos disable trigger trg_rrhh_pagos_lock;
alter table rrhh_pagos disable trigger trg_rrhh_pagos_lock_nomina;

with agg as (
  select
    n.empresa_id,
    n.empleado_id,
    n.periodo,
    sum(n.ss_empleado) as ss_empleado,
    sum(n.ss_empresa)  as ss_empresa,
    sum(n.irpf)        as irpf
  from rrhh_pagos_nominas n
  -- Las nóminas denegadas no cuentan en la suma, igual que en el volcado.
  where n.revision_estado is distinct from 'denegada'
  group by 1, 2, 3
)
update rrhh_pagos p
set
  -- Cada campo se repone solo si está vacío: si RRHH lo corrigió a mano con un
  -- valor distinto del de la nómina, ese valor manda y no se pisa.
  ss_empleado = case when p.ss_empleado = 0 and a.ss_empleado > 0 then a.ss_empleado else p.ss_empleado end,
  ss_empresa  = case when p.ss_empresa  = 0 and a.ss_empresa  > 0 then a.ss_empresa  else p.ss_empresa  end,
  irpf        = case when p.irpf        = 0 and a.irpf        > 0 then a.irpf        else p.irpf        end
from agg a
where a.empresa_id = p.empresa_id
  and a.empleado_id = p.empleado_id
  and a.periodo = p.periodo
  and (
    (p.ss_empleado = 0 and a.ss_empleado > 0) or
    (p.ss_empresa  = 0 and a.ss_empresa  > 0) or
    (p.irpf        = 0 and a.irpf        > 0)
  );

alter table rrhh_pagos enable trigger trg_rrhh_pagos_lock;
alter table rrhh_pagos enable trigger trg_rrhh_pagos_lock_nomina;

commit;
