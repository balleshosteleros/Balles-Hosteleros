-- "Apagar" un producto de venta durante el servicio (se ha acabado).
--
-- POR QUÉ EN `productos` Y NO SOLO EN `carta_items`:
-- El mismo plato se vende por tres sitios —la carta del QR, la tecla del TPV y
-- (en cuanto exista) la comanda que teclea el camarero—. Si el apagado viviera
-- en la carta, el comensal vería "agotado" y el camarero podría seguir
-- vendiéndolo desde la caja. El producto es lo único que comparten los tres,
-- así que es ahí donde se apaga, una vez, para todos.
--
-- `carta_items` conserva su propio marcado para los platos que NO tienen
-- producto detrás (los escritos a mano en la carta digital).
--
-- La fecha, igual que en la carta: guarda el DÍA DE SERVICIO (corte 06:00, zona
-- de la empresa) para que el producto vuelva solo al día siguiente y nadie
-- tenga que acordarse de encenderlo.

alter table public.productos
  add column if not exists agotado_dia date,
  add column if not exists agotado_por uuid references public.usuarios(id) on delete set null,
  add column if not exists agotado_at timestamptz;

comment on column public.productos.agotado_dia is
  'Dia de servicio (corte 06:00) en que cocina apago el producto por agotarse. Vuelve solo al dia siguiente. NULL = disponible.';
comment on column public.productos.agotado_por is
  'Quien lo apago.';
comment on column public.productos.agotado_at is
  'Instante exacto del apagado (UTC).';

create index if not exists productos_agotado_idx
  on public.productos (empresa_id, agotado_dia)
  where agotado_dia is not null;
