-- Enlace escandallo (cocina) ↔ producto (venta/elaboración) + merma por ingrediente.
--
-- El escandallo de cocina pasa a ser la fuente de la receta: al guardarlo se
-- sincroniza producto_composicion (la tabla que descuenta stock por kardex y
-- alimenta coste_escandallo()). En productos venta/elaboración la receta queda
-- en solo lectura.

-- 1. Producto asociado al escandallo (1 escandallo ↔ 1 producto venta/elaboración).
alter table public.escandallos
  add column if not exists producto_id uuid references public.productos(id) on delete set null;

create unique index if not exists uq_escandallos_producto_id
  on public.escandallos(producto_id)
  where producto_id is not null;

comment on column public.escandallos.producto_id is
  'Producto de venta/elaboración al que pertenece esta receta. Al guardar el escandallo se sincroniza producto_composicion.';

-- 2. Merma % por ingrediente del escandallo (se replica a producto_composicion.merma_pct).
alter table public.escandallo_ingredientes
  add column if not exists merma_pct numeric not null default 0;

comment on column public.escandallo_ingredientes.merma_pct is
  '% de pérdida (limpieza/cocción). Se sincroniza a producto_composicion.merma_pct.';
