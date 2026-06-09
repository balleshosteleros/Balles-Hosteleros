-- ─── Fichajes · paralización (cierre anticipado manual) ───────────────────
-- El empleado puede paralizar su fichaje manualmente antes de que se cierre
-- por horario/autocierre. Al hacerlo se le pide un motivo, que queda guardado
-- y vinculado al fichaje, y el fichaje se marca para revisión (icono de alerta
-- en la lista de fichajes de gestión / departamentos).

alter table public.fichajes
  add column if not exists cierre_anticipado        boolean not null default false,
  add column if not exists cierre_anticipado_motivo text;

comment on column public.fichajes.cierre_anticipado is
  'true = el empleado paralizó el fichaje manualmente antes de su horario (a revisar).';
comment on column public.fichajes.cierre_anticipado_motivo is
  'Motivo que indicó el empleado al paralizar el fichaje antes de tiempo.';

create index if not exists idx_fichajes_cierre_anticipado
  on public.fichajes(empresa_id, fecha) where cierre_anticipado;
