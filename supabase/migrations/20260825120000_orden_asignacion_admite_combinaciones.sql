-- El orden de asignacion pasa a admitir tambien COMBINACIONES de mesas, no
-- solo mesas sueltas. Asi el responsable puede decidir, por ejemplo, que un
-- grupo de 7 vaya primero a TE1+TE2 y luego a TI1+TI2.
--
-- Cada fila apunta a UNA mesa o a UNA combinacion, nunca a las dos ni a
-- ninguna. `mesa_id` pasa a ser opcional y aparece `combinacion_id`.
--
-- Idempotente: se puede reejecutar sin efecto.

-- 1) Nueva columna hacia combinaciones.
alter table public.plano_orden_asignacion
  add column if not exists combinacion_id uuid
    references public.mesa_combinaciones(id) on delete cascade;

-- 2) mesa_id deja de ser obligatorio (una fila puede ser de combinacion).
alter table public.plano_orden_asignacion
  alter column mesa_id drop not null;

-- 3) Exactamente uno de los dos: o mesa, o combinacion.
alter table public.plano_orden_asignacion
  drop constraint if exists plano_orden_asignacion_destino_chk;
alter table public.plano_orden_asignacion
  add constraint plano_orden_asignacion_destino_chk
  check (num_nonnulls(mesa_id, combinacion_id) = 1);

-- 4) El UNIQUE original no cubre las combinaciones y, con mesa_id nullable,
--    deja de proteger nada en esas filas. Se sustituye por dos indices
--    unicos parciales, uno por tipo de destino.
alter table public.plano_orden_asignacion
  drop constraint if exists plano_orden_asignacion_plano_id_comensales_mesa_id_key;

create unique index if not exists plano_orden_asignacion_mesa_uidx
  on public.plano_orden_asignacion (plano_id, comensales, mesa_id)
  where mesa_id is not null;

create unique index if not exists plano_orden_asignacion_combi_uidx
  on public.plano_orden_asignacion (plano_id, comensales, combinacion_id)
  where combinacion_id is not null;

-- 5) Indice FK para el borrado en cascada de combinaciones.
create index if not exists plano_orden_asignacion_combinacion_id_idx
  on public.plano_orden_asignacion (combinacion_id);
