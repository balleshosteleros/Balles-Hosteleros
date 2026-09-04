-- UN teléfono, UN campo.
--
-- Antes el número vivía partido en dos columnas: `telefono` (sin prefijo) y
-- `telefono_prefijo`. Eso obligaba a recomponerlo en cada pantalla y en cada
-- correo, y bastaba con que un sitio se olvidara de una de las dos para que
-- unos clientes salieran con prefijo y otros no. Además el desdoble no aporta
-- nada: nadie consulta ni filtra por el prefijo suelto.
--
-- A partir de aquí `telefono` guarda el número COMPLETO ("+34 612345678"), que
-- es como se lee, se marca y se manda un WhatsApp. Se acabó el segundo campo.
--
-- Idempotente: si la columna ya no está, no hace nada.

-- 1) Meter el prefijo dentro del número, salvo donde ya lo lleve.
update public.clientes_sala
set    telefono   = btrim(coalesce(telefono_prefijo, '+34')) || ' ' || btrim(telefono),
       updated_at = now()
where  coalesce(btrim(telefono), '') <> ''
  and  btrim(telefono) not like '+%';

-- 2) Fuera la columna del prefijo: ya no existe como dato aparte.
alter table public.clientes_sala drop column if exists telefono_prefijo;

comment on column public.clientes_sala.telefono is
  'Teléfono COMPLETO con prefijo internacional ("+34 612345678"). Es el único campo del teléfono: no hay columna de prefijo aparte.';

-- 3) Snapshot de las reservas: mismo formato que la ficha.
update public.reservas r
set    cliente_telefono = c.telefono,
       updated_at       = now()
from   public.clientes_sala c
where  r.cliente_id = c.id
  and  coalesce(btrim(c.telefono), '') <> ''
  and  coalesce(r.cliente_telefono, '') is distinct from c.telefono;

-- 4) Reservas sin ficha (walk-in apuntado a mano): no hay de dónde deducir el
--    país, así que se les pone el prefijo por defecto.
update public.reservas
set    cliente_telefono = '+34 ' || btrim(cliente_telefono),
       updated_at       = now()
where  coalesce(btrim(cliente_telefono), '') <> ''
  and  btrim(cliente_telefono) not like '+%';
