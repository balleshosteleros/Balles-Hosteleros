-- La reserva guarda DOS cosas distintas y ambas hacen falta:
--
--   `zona`             -> zona interna real donde se sienta (Cristalera).
--                         Es lo que ve el staff en el listado de sala.
--   `grupo_zona_id`  -> el grupo que eligio el cliente (Sala).
--                         Es lo unico que el cliente conoce, y es lo que debe
--                         leer en el correo de confirmacion: si le dijeramos
--                         "Cristalera" no sabria que es y podria reclamar otro
--                         sitio.
--
-- Se guarda el ID, no el nombre: el nombre se resuelve al generar el correo o
-- al pintar la web, asi que un renombrado se refleja solo en lo que se genere
-- a partir de entonces. Los correos ya enviados no cambian (son inmutables:
-- estan en el buzon del cliente), y eso es lo correcto.
--
-- ON DELETE SET NULL: si se borra el grupo, la reserva sobrevive sin zona
-- (el staff conserva `zona`, que es lo que necesita para trabajar).

alter table public.reservas
  add column if not exists grupo_zona_id uuid
    references public.grupos_zonas(id) on delete set null;

comment on column public.reservas.grupo_zona_id is
  'Grupo de zonas que eligio el cliente (lo unico que el conoce). El correo lee su nombre ACTUAL. Para el staff manda `zona`.';

create index if not exists reservas_grupo_zona_id_idx
  on public.reservas (grupo_zona_id);
