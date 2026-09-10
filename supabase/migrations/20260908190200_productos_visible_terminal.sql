-- ============================================================================
-- Interruptor "Visible en terminal" para los productos de venta.
--
-- Caso real: los 6 platos que HABANA enseña en su carta son de BACANAL — se
-- comandan, se cobran y se sirven allí. En el terminal de HABANA solo estorban.
-- Con esto apagado el producto sigue en la carta digital pero desaparece del TPV.
--
-- Por defecto ENCENDIDO: es lo que ya pasaba hasta ahora, así ningún producto
-- existente se cae del terminal por esta migración.
-- ============================================================================
alter table public.productos
  add column if not exists visible_terminal boolean not null default true;

comment on column public.productos.visible_terminal is
  'Si está apagado, el producto no aparece en el terminal de ventas (TPV). No afecta a la carta digital, que se controla con visible_carta.';

update public.productos p
   set visible_terminal = false
  from public.empresas e
 where e.nombre = 'HABANA'
   and p.empresa_id = e.id
   and p.tipo = 'venta'
   and p.categoria = 'Delicateses para cenar';
