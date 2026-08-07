-- Identidad REAL de una nómina volcada: la huella del documento, no sus importes.
--
-- Antes, el volcado consideraba "ya subida" cualquier nómina del mismo empleado y
-- mes con neto+ss_empleado+irpf iguales. Eso descarta un finiquito que coincida en
-- importe con la nómina normal — justo el caso que esta tabla existe para
-- soportar (ver 20260706180000) — y el empleado cobra de menos.
--
-- Se identifica el documento por SHA-256 de su contenido: re-subir el MISMO PDF se
-- salta; dos documentos distintos del mismo importe se guardan los dos.
--
-- Idempotente: re-ejecutable sin error.

alter table public.rrhh_pagos_nominas
  add column if not exists sha256 text;

comment on column public.rrhh_pagos_nominas.sha256 is
  'SHA-256 (hex) del documento original. Identifica la nómina para evitar volcar dos veces el mismo archivo.';

-- Unicidad por documento dentro de empleado+mes. Parcial: las filas antiguas sin
-- huella (sha256 null) no bloquean la creación del índice ni entre sí.
create unique index if not exists uq_rrhh_pagos_nominas_doc
  on public.rrhh_pagos_nominas (empresa_id, empleado_id, periodo, sha256)
  where sha256 is not null;
