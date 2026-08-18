-- Qué se ve en la carta digital: dos niveles independientes.
--
-- POR QUÉ DOS Y NO UNO:
--
-- 1) `productos.visible_carta` — el interruptor maestro, en la ficha del
--    producto. Decide si ese producto es "de carta" o no. Un producto con el
--    interruptor apagado NUNCA aparece en la carta digital y NO se puede añadir
--    desde ella. Es lo que separa los platos de lo que no lo es (consumibles
--    internos, marcas sueltas de destilado, artículos que no se piden por
--    carta). Antes esto se adivinaba por categoría, que es frágil: una empresa
--    nueva con otras categorías se rompía.
--
-- 2) Ocultación puntual en la carta, para un plato que SÍ es de carta pero hoy
--    no se sirve:
--      - sin fechas  → oculto indefinidamente ("se ha acabado")
--      - entre fechas → oculto solo en ese periodo ("en agosto no lo hacemos"),
--        y vuelve solo al terminar, sin que nadie tenga que acordarse.
--
-- Son independientes a propósito: apagar el maestro saca el producto del
-- catálogo de carta; ocultar es una pausa que no pierde el trabajo hecho
-- (descripción, foto, orden).

-- ── 1) Interruptor maestro en el producto ────────────────────────────
alter table public.productos
  add column if not exists visible_carta boolean not null default false;

comment on column public.productos.visible_carta is
  'Si es false, el producto NUNCA aparece en la carta digital ni se puede añadir desde ella. Interruptor maestro; la ocultación temporal vive en carta_items.';

-- Arranque razonable: los productos de VENTA que ya tienen precio son
-- candidatos naturales a estar en carta. El resto queda apagado y se enciende
-- a mano. Solo afecta a filas existentes: el default para las nuevas es false,
-- para que nada entre en la carta sin que alguien lo decida.
update public.productos
set visible_carta = true
where tipo = 'venta'
  and coalesce(nullif(trim(precio_venta), ''), null) is not null
  and visible_carta = false;

-- ── 2) Ocultación temporal del plato en la carta ─────────────────────
alter table public.carta_items
  add column if not exists oculto boolean not null default false;

alter table public.carta_items
  add column if not exists oculto_desde date;

alter table public.carta_items
  add column if not exists oculto_hasta date;

alter table public.carta_items
  add column if not exists oculto_motivo text;

comment on column public.carta_items.oculto is
  'true = oculto en la carta. Sin fechas, indefinido; con fechas, solo en ese periodo.';
comment on column public.carta_items.oculto_desde is
  'Inicio del periodo de ocultación (incluido). NULL = desde ya.';
comment on column public.carta_items.oculto_hasta is
  'Fin del periodo de ocultación (incluido). NULL = sin fecha de vuelta.';
comment on column public.carta_items.oculto_motivo is
  'Nota interna: por qué está oculto. No se muestra al comensal.';

-- Un rango invertido dejaría el plato oculto para siempre sin que se note.
do $$
begin
  alter table public.carta_items
    add constraint carta_items_ocultacion_rango_chk
    check (
      oculto_desde is null
      or oculto_hasta is null
      or oculto_hasta >= oculto_desde
    );
exception
  when duplicate_object then null;
end $$;

-- ── 3) Lectura pública: respetar ambos niveles ───────────────────────
-- La policy pública filtraba solo por `visible`. Ahora un plato oculto —o cuyo
-- producto tiene el maestro apagado— tampoco se sirve al comensal, sin depender
-- de que la aplicación se acuerde de filtrarlo.
drop policy if exists carta_items_public_read on public.carta_items;

create policy carta_items_public_read on public.carta_items
  for select
  to anon, authenticated
  using (
    visible = true
    and (
      oculto = false
      or (oculto_desde is not null and current_date < oculto_desde)
      or (oculto_hasta is not null and current_date > oculto_hasta)
    )
    and (
      producto_id is null
      or exists (
        select 1 from public.productos p
        where p.id = carta_items.producto_id
          and p.visible_carta = true
      )
    )
    and exists (
      select 1 from public.empresas e
      where e.id = carta_items.empresa_id
        and e.carta_publicada = true
    )
  );
