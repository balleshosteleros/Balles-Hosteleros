-- ─── 082: fecha_fin en histórico de precios de compra ───────────
-- Cada precio puede tener una fecha hasta la que aplica (inclusive).
-- - El último (más reciente) suele quedar con fecha_fin = null  → indefinido.
-- - Los anteriores se rellenan automáticamente con (siguiente.fecha_inicio - 1 día).
-- - Si el usuario fija fecha_fin manualmente en el último y ese día pasa sin
--   añadir un nuevo precio, no hay precio vigente y la UI debe avisar.

alter table public.producto_precios_compra
  add column if not exists fecha_fin date;

comment on column public.producto_precios_compra.fecha_fin is
  'Fecha (inclusive) hasta la que aplica este precio. Null = indefinido (sólo válido para el último).';

-- Backfill: para cada fila que tenga una fila posterior (mayor fecha_inicio),
-- fecha_fin = siguiente.fecha_inicio - 1 día. La más reciente queda con null.
update public.producto_precios_compra ppc
set fecha_fin = sub.next_inicio - interval '1 day'
from (
  select
    id,
    lead(fecha_inicio) over (
      partition by producto_id
      order by fecha_inicio asc, created_at asc
    ) as next_inicio
  from public.producto_precios_compra
) sub
where ppc.id = sub.id
  and sub.next_inicio is not null
  and ppc.fecha_fin is null;

-- Validación a nivel BD (opcional pero útil): fecha_fin >= fecha_inicio.
alter table public.producto_precios_compra
  drop constraint if exists ppc_fecha_fin_gte_inicio;
alter table public.producto_precios_compra
  add constraint ppc_fecha_fin_gte_inicio
  check (fecha_fin is null or fecha_fin >= fecha_inicio);
