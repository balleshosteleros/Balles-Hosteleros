-- El trabajador puede RECHAZAR su liquidación desde su portal, no solo
-- aprobarla. Al rechazar deja un motivo corto, y RRHH lo ve en la columna de
-- comentarios junto al suyo.
--
-- Por qué una columna aparte y no reutilizar `comentario`: ese campo es de la
-- empresa. Si el trabajador escribiera ahí, su motivo pisaría la nota que RRHH
-- hubiera dejado (y al revés). Separados, la columna puede enseñar los dos.
--
-- `confirmacion_rechazada_at` distingue "todavía no ha contestado" (null) de
-- "lo rechazó": sin ella, un rechazo se vería igual que un silencio y el botón
-- no sabría a qué estado volver.

alter table public.rrhh_pagos
  add column if not exists comentario_empleado text,
  add column if not exists confirmacion_rechazada_at timestamptz;

comment on column public.rrhh_pagos.comentario_empleado is
  'Motivo que escribe el trabajador al rechazar su liquidación. Distinto de `comentario`, que es la nota de la empresa.';
comment on column public.rrhh_pagos.confirmacion_rechazada_at is
  'Cuándo rechazó el trabajador su liquidación. Null = no ha contestado o la aprobó.';
