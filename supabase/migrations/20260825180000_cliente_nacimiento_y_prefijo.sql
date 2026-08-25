-- Ficha del cliente: fecha de nacimiento y prefijo telefonico.
--
-- Son los dos campos que pide CoverManager al reservar y que aqui no se
-- recogian. El consentimiento comercial ya existia (acepta_marketing_email /
-- _sms / _whatsapp), lo que faltaba era pedirlo en el formulario publico.
--
--   fecha_nacimiento -> felicitaciones de cumpleaños y segmentacion.
--   telefono_prefijo -> el numero se guarda sin prefijo en `telefono`; asi un
--                       cliente extranjero no queda con un numero inservible.
--                       Por defecto España, que es el caso normal.
--
-- Idempotente.

alter table public.clientes_sala
  add column if not exists fecha_nacimiento date,
  add column if not exists telefono_prefijo text default '+34';

comment on column public.clientes_sala.fecha_nacimiento is
  'Fecha de nacimiento del cliente. Opcional: se pide al reservar pero no bloquea.';
comment on column public.clientes_sala.telefono_prefijo is
  'Prefijo internacional del telefono (+34, +351...). El numero va aparte en `telefono`.';
