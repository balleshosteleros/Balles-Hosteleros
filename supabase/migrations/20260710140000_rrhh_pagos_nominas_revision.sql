-- Estado de REVISIÓN de cada nómina individual subida (por la gestoría o a mano).
--
-- Flujo pedido: las nóminas se vuelcan al registro de pagos como provisionales,
-- pero cada una lleva un estado de revisión. RRHH ve los documentos, las que
-- tienen incidencia (p.ej. neto a 0) y puede APROBAR (queda 'correcta') o DENEGAR
-- (queda 'denegada' y se descuenta de la suma de rrhh_pagos).
--
-- Las nóminas de OTRO mes o de un empleado NO dado de alta NO llegan aquí: se
-- rechazan en la subida y se le indican a la gestoría para que las anule.
--
-- Idempotente.

alter table public.rrhh_pagos_nominas
  add column if not exists revision_estado text not null default 'correcta'
    check (revision_estado in ('correcta', 'con_incidencia', 'denegada'));

alter table public.rrhh_pagos_nominas
  add column if not exists incidencia text;               -- motivo si con_incidencia/denegada

alter table public.rrhh_pagos_nominas
  add column if not exists revisado_por uuid;               -- usuario que aprobó/denegó
alter table public.rrhh_pagos_nominas
  add column if not exists revisado_en timestamptz;

comment on column public.rrhh_pagos_nominas.revision_estado is
  'Estado de revisión de la nómina: correcta | con_incidencia | denegada. Las denegadas no cuentan en la suma de rrhh_pagos.';
comment on column public.rrhh_pagos_nominas.incidencia is
  'Descripción de la incidencia detectada (neto 0, importes dudosos…). NULL si no hay.';

create index if not exists idx_rrhh_pagos_nominas_revision
  on public.rrhh_pagos_nominas (empresa_id, periodo, revision_estado);
