-- Marca del momento en que una reserva incumplió su política de cancelación.
--
-- Sin esto, un incumplimiento no dejaba rastro: la reserva quedaba CANCELADA
-- con la tarjeta guardada y nadie se enteraba de que había un cobro pendiente
-- de decidir. El aviso de Sala solo miraba cobros ya FALLIDOS, así que un
-- cobro que ni siquiera se había intentado era invisible (PRP-082 §5.6).
--
-- El cobro sigue siendo una decisión humana: esta columna solo dice "aquí hay
-- algo que decidir", nunca cobra por su cuenta.
alter table public.reservas
  add column if not exists politica_incumplida_at timestamptz;

comment on column public.reservas.politica_incumplida_at is
  'Cuándo se canceló/no-show fuera de plazo teniendo política. Enciende el aviso de cobro pendiente en Sala; se apaga al cobrar o al perdonar (cobro_perdonado_at).';

-- El aviso de Sala pregunta por las reservas con incumplimiento sin resolver.
create index if not exists idx_reservas_politica_incumplida
  on public.reservas (empresa_id, politica_incumplida_at)
  where politica_incumplida_at is not null;
