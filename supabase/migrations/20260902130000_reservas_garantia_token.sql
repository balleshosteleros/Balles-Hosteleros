-- PRP-082 fase 2 · Enlace del paso de tarjeta.
--
-- Secreto por reserva, igual que `cancelacion_token`: con el id de la reserva
-- no basta para pagar ni para ver sus datos, así nadie puede tocar reservas
-- ajenas probando identificadores.

alter table public.reservas
  add column if not exists garantia_token uuid;

-- Toda reserva que exija tarjeta necesita su enlace. Se genera sola al
-- crearla o al marcarla, para que nadie tenga que acordarse.
create or replace function public.reservas_garantia_token_auto()
returns trigger
language plpgsql
as $fn$
begin
  if (new.tiene_garantia or new.tiene_cancelacion) and new.garantia_token is null then
    new.garantia_token := gen_random_uuid();
  end if;
  return new;
end;
$fn$;

drop trigger if exists reservas_garantia_token_trg on public.reservas;
create trigger reservas_garantia_token_trg
  before insert or update on public.reservas
  for each row execute function public.reservas_garantia_token_auto();

update public.reservas
set garantia_token = gen_random_uuid()
where (tiene_garantia or tiene_cancelacion) and garantia_token is null;

create unique index if not exists reservas_garantia_token_idx
  on public.reservas (garantia_token)
  where garantia_token is not null;

comment on column public.reservas.garantia_token is
  'Secreto del enlace donde el cliente pone su tarjeta. Uno por reserva.';
