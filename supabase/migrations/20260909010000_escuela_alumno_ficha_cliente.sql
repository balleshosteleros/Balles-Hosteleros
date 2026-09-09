-- ESCUELA — el alumno y el cliente son la misma persona, y se pueden ir a ver.
--
-- Los alumnos de la escuela son, casi todos, clientes que ya tienen ficha en
-- BALLES (vinieron del embudo de GoHighLevel). Hasta ahora eran dos fichas que
-- no se conocían: se guarda el enlace para poder ir de una a otra desde las dos
-- puntas. `on delete set null` porque borrar un cliente no puede tumbar a su
-- alumno: pierde el enlace y nada más.
alter table public.escuela_alumnos
  add column if not exists cliente_id uuid references public.clientes_sala(id) on delete set null;

create index if not exists idx_escuela_alumnos_cliente
  on public.escuela_alumnos (cliente_id) where cliente_id is not null;

-- Cuántas veces ha entrado. Es el dato que GoHighLevel llamaba «inicios de
-- sesión» y el único que distingue al que entra cada semana del que entró una
-- vez y no volvió. `ultimo_acceso_at` solo dice cuándo fue la última.
alter table public.escuela_alumnos
  add column if not exists accesos_num integer not null default 0;

-- Curso ANUNCIADO y todavía sin contenido: sale en la escuela con el distintivo
-- «Próximamente» y no se puede abrir. No es lo mismo que despublicado, que es
-- no existir para el alumno.
alter table public.formacion_cursos
  add column if not exists proximamente boolean not null default false;
