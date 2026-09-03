-- Deja lo que ve el trabajador en su panel de pagos cuadrado con la nómina que
-- de verdad tiene subida: Seguridad Social, IRPF y el PDF que puede abrir.
--
-- QUÉ ARREGLA. Tres desajustes entre `rrhh_pagos` y `rrhh_pagos_nominas`:
--
--   1. Nóminas CORREGIDAS. Si la gestoría rehace una nómina y se vuelve a subir,
--      los candados de liquidación confirmada impiden actualizar la fila de pago,
--      que se queda con los importes de la versión antigua. Caso real: Yesmeri
--      María Peralta, julio 2026 (la primera nómina tenía días de más y le
--      faltaba la enfermedad al 60%).
--
--   2. VARIAS nóminas en un mes. Cuando alguien tiene dos recibos (p. ej. normal
--      + finiquito), el pago se quedaba con la Seguridad Social de la primera en
--      vez de la SUMA. Caso real: Karen Johanna Aguilar, abril 2026.
--
--   3. PDF no enlazado. 82 pagos tenían la nómina subida pero `nomina_path` a
--      null, así que al trabajador no le salía el botón "Ver nómina" en su panel.
--
-- SEGURIDAD. No se toca `nomina`, `total`, `complemento`, `ajuste`,
-- `horas_extras` ni `bonus`: nadie cobra un céntimo distinto. Solo se reponen los
-- campos informativos del desglose y el enlace al documento.
--
-- CANDADOS. `trg_rrhh_pagos_lock` y `trg_rrhh_pagos_lock_nomina` protegen las
-- liquidaciones ya enviadas. Se desactivan SOLO durante la corrección y se
-- reactivan aquí mismo; si algo falla, el rollback los deja puestos.
--
-- IDEMPOTENTE: solo actúa sobre filas que difieren de sus nóminas.

alter table rrhh_pagos disable trigger trg_rrhh_pagos_lock;
alter table rrhh_pagos disable trigger trg_rrhh_pagos_lock_nomina;

with n as (
  select
    empresa_id,
    empleado_id,
    periodo,
    sum(ss_empleado) as ss_empleado,
    sum(ss_empresa)  as ss_empresa,
    sum(irpf)        as irpf,
    -- El PDF principal del mes es el de la primera nómina (orden 0).
    (array_agg(nomina_path order by orden))[1] as path1
  from rrhh_pagos_nominas
  -- Las denegadas no cuentan, igual que en el volcado normal.
  where revision_estado is distinct from 'denegada'
  group by 1, 2, 3
)
update rrhh_pagos p
set
  ss_empleado = n.ss_empleado,
  ss_empresa  = n.ss_empresa,
  irpf        = n.irpf,
  -- Solo se rellena si falta: nunca se pisa un documento ya enlazado.
  nomina_path = coalesce(p.nomina_path, n.path1)
from n
where n.empresa_id = p.empresa_id
  and n.empleado_id = p.empleado_id
  and n.periodo = p.periodo
  and (
    p.ss_empleado is distinct from n.ss_empleado or
    p.ss_empresa  is distinct from n.ss_empresa  or
    p.irpf        is distinct from n.irpf        or
    p.nomina_path is null
  );

alter table rrhh_pagos enable trigger trg_rrhh_pagos_lock;
alter table rrhh_pagos enable trigger trg_rrhh_pagos_lock_nomina;
