-- ─── 070 · Proveedores · Pago + Reparto estructurados ─────────────────
-- Añade columnas estructuradas para vía/plazo de pago y horario de reparto
-- por día. Mantiene las columnas legacy (condiciones_pago, plazo_entrega)
-- para compatibilidad con importaciones antiguas.

alter table public.proveedores
  add column if not exists via_pago               text,
  add column if not exists via_pago_negociada     text,
  add column if not exists plazo_pago             text,
  add column if not exists plazo_pago_negociado   text,
  add column if not exists horario_reparto        jsonb not null default '{}'::jsonb,
  add column if not exists dia_reparto_negociado  text;

comment on column public.proveedores.via_pago             is 'Efectivo | Tarjeta | Transferencia | SEPA | Negociado';
comment on column public.proveedores.via_pago_negociada   is 'Texto libre cuando via_pago = Negociado';
comment on column public.proveedores.plazo_pago           is 'Un día antes del reparto | El día del reparto | 7/15/30/60 días | Negociado';
comment on column public.proveedores.plazo_pago_negociado is 'Texto libre cuando plazo_pago = Negociado';
comment on column public.proveedores.horario_reparto      is 'JSON día → franja u horario personalizado, ej: {"Lunes":"Mañana (06:00-12:00)"}';
comment on column public.proveedores.dia_reparto_negociado is 'Días/horarios negociados a demanda';
