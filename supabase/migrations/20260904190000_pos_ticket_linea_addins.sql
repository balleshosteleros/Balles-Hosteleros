-- ============================================================
-- 20260904190000_pos_ticket_linea_addins.sql
-- Complementos de una línea de venta (el consumo que hoy se tira).
--
-- QUÉ SON: lo que se añade a un producto al venderlo y CONSUME ALMACÉN — el sabor
-- del tabaco de una shisha, la cápsula de cada café, la guarnición del entrecot, el
-- refresco de un combinado, los suplementos de plato ("Ud. Extra Vieira").
--
-- POR QUÉ HACE FALTA: Ágora los manda en cada línea (campo `Addins`, con su ProductId
-- y su ratio) y la ingesta leía 9 de los 78 campos, así que se perdían. Son el 22 % de
-- las líneas: del orden de 2.400 consumos jamás descontados, que encajan con las 6.300
-- unidades sin justificar del diagnóstico de almacén y con las Boquillas en −150.
-- Descontar el plato sin su guarnición, o el café sin su cápsula, deja el almacén
-- descuadrado y encima con apariencia de funcionar.
--
-- POR QUÉ TABLA HIJA Y NO UNA COLUMNA JSONB: el kardex identifica cada movimiento por
-- (origen_linea_id, producto_id) con índice único. Si el addin no tuviera fila propia,
-- un plato y su complemento que consuman el MISMO producto colisionarían. Con fila
-- propia, el `id` de cada addin es su `origen_linea_id` y cada consumo es rastreable.
--
-- GENÉRICO A PROPÓSITO (condición de Iván: "ningún restaurante nuevo debería necesitar
-- código"): esto NO es "los Addins de Ágora". Es "una línea de venta puede llevar
-- complementos que descuentan stock según su proporción". Que hoy los mande Ágora y
-- mañana el TPV propio es un detalle de la integración; el modelo no cambia.
--
-- El reproceso de un día borra y reinserta las líneas: el ON DELETE CASCADE limpia
-- estos addins solo, sin que la ingesta tenga que acordarse.
--
-- `agora_product_id` se guarda SIEMPRE, exista o no el producto en Balles — la lección
-- del ProductId que se tiraba (288 líneas quedaron imposibles de enlazar).
-- Idempotente.
-- ============================================================

create table if not exists public.pos_ticket_linea_addins (
  id                uuid primary key default gen_random_uuid(),
  empresa_id        uuid not null,
  linea_id          uuid not null references public.pos_ticket_lineas(id) on delete cascade,
  producto_id       uuid references public.productos(id) on delete set null,
  agora_product_id  integer,                    -- id en el TPV, se guarde o no el producto
  nombre            text not null,              -- nombre tal cual lo manda el TPV
  -- Proporción consumida por unidad de la línea padre (0,009 = media cazoleta de
  -- tabaco). HOY lo dicta el TPV, que es el único sitio donde ese dato existe.
  -- Cuando se construyan los formatos de venta (DECISIÓN 6-BIS), la configuración de
  -- Balles pasará a mandar y esto quedará como respaldo/traza de lo que llegó.
  ratio             numeric not null default 1,
  created_at        timestamptz not null default now()
);

create index if not exists idx_addins_linea
  on public.pos_ticket_linea_addins(linea_id);

-- Complementos que llegaron pero no casan con ningún producto de Balles: hay que
-- darlos de alta o enlazarlos, si no su consumo se sigue perdiendo.
create index if not exists idx_addins_huerfanos
  on public.pos_ticket_linea_addins(agora_product_id)
  where producto_id is null and agora_product_id is not null;

alter table public.pos_ticket_linea_addins enable row level security;

-- Solo lectura para los usuarios de la empresa: quien escribe es la ingesta con
-- service role (mismo criterio que el resto del kardex y de pos_ticket_lineas).
drop policy if exists "addins_select" on public.pos_ticket_linea_addins;
create policy "addins_select" on public.pos_ticket_linea_addins
  for select to authenticated using (empresa_id in (select empresas_del_usuario()));
