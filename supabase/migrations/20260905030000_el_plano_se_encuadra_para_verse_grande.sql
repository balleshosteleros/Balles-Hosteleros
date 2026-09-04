-- Encuadre del plano que se ve en el servicio (vista Reservas).
--
-- El editor de Ajustes dibuja siempre sobre un lienzo fijo de 1200x640, pero
-- las mesas rara vez lo llenan: quedan franjas vacias arriba, abajo o a los
-- lados. Al escalar el lienzo entero al panel del servicio, ese vacio se
-- escala tambien y las mesas se ven pequenas en el centro.
--
-- Estas columnas guardan el recuadro (en coordenadas del lienzo 1200x640) que
-- el usuario encuadra a mano en el editor. El servicio escala ESE recuadro
-- para llenar la pantalla, asi que apretandolo alrededor de las mesas se ven
-- mucho mas grandes.
--
-- NULL = sin encuadre guardado -> el servicio se comporta como hasta ahora
-- (lienzo completo). Ninguna sala existente cambia de aspecto por esta
-- migracion.
alter table public.salas add column if not exists encuadre_x integer;
alter table public.salas add column if not exists encuadre_y integer;
alter table public.salas add column if not exists encuadre_w integer;
alter table public.salas add column if not exists encuadre_h integer;

comment on column public.salas.encuadre_x is 'Encuadre del plano en el servicio: X sobre el lienzo 1200x640. NULL = lienzo completo.';
comment on column public.salas.encuadre_y is 'Encuadre del plano en el servicio: Y sobre el lienzo 1200x640. NULL = lienzo completo.';
comment on column public.salas.encuadre_w is 'Encuadre del plano en el servicio: ancho sobre el lienzo 1200x640. NULL = lienzo completo.';
comment on column public.salas.encuadre_h is 'Encuadre del plano en el servicio: alto sobre el lienzo 1200x640. NULL = lienzo completo.';
