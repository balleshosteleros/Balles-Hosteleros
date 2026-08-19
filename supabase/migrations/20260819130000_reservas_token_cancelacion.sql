-- Cancelación online por parte del cliente.
--
-- POR QUÉ: (1) Google lo exige — "Partners must support online cancellation of
-- bookings" es requisito de Reservations End-to-End; sin esto la certificación
-- se cae. (2) Negocio: si el cliente no puede avisar con un clic, simplemente
-- no aparece, y el restaurante se queda con la mesa muerta sin poder revenderla.
--
-- El token es un secreto por reserva: sin él, cualquiera podría cancelar
-- reservas ajenas cambiando un id en la URL. Se genera solo en cada alta.
--
-- Idempotente: IF NOT EXISTS + backfill solo de las que no lo tengan.

alter table public.reservas
  add column if not exists cancelacion_token uuid;

-- Valor por defecto para las nuevas.
alter table public.reservas
  alter column cancelacion_token set default gen_random_uuid();

-- Reservas ya existentes: se les genera uno para que su enlace también funcione.
update public.reservas
   set cancelacion_token = gen_random_uuid()
 where cancelacion_token is null;

-- Búsqueda por token: es el acceso público, tiene que ser directo y único.
create unique index if not exists reservas_cancelacion_token_idx
  on public.reservas (cancelacion_token);

comment on column public.reservas.cancelacion_token is
  'Secreto por reserva para el enlace público de cancelación del correo. Nunca se muestra en listados.';
