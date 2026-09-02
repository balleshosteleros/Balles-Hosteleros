-- RRHH · Pagos: columna de comentario libre.
--
-- Nota manuscrita por línea de pago (el "porqué" de un ajuste, un aviso para el
-- mes siguiente, etc.). No interviene en ningún cálculo: es puramente
-- informativa y se muestra como ÚLTIMA columna de la tabla.
--
-- Se deja NULL en todas las filas existentes: no hay comentario que inventar.
-- Idempotente.

alter table public.rrhh_pagos
  add column if not exists comentario text;

comment on column public.rrhh_pagos.comentario is
  'Nota libre escrita a mano para esta línea de pago. Informativa: no entra en ningún total.';
