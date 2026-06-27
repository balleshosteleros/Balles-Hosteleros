-- Pedidos: hora de entrega/reparto elegida para el pedido.
-- Se auto-rellena desde el reparto negociado del proveedor; si se cambia a mano y
-- queda fuera del día/franja estipulados, la UI y el PDF muestran un aviso de peligro.
-- El "fuera de lo estipulado" NO se persiste: se deriva comparando fecha_entrega +
-- hora_entrega contra el reparto vigente del proveedor (proveedor_id).
alter table public.pedidos
  add column if not exists hora_entrega text;  -- 'HH:MM' (24h). null = sin hora fijada.
