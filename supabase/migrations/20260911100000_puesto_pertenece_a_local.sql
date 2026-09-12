-- El LOCAL es del PUESTO, no de la vacante.
--
-- Un mismo nombre de puesto no es el mismo trabajo en dos locales: el CAMARERO 1
-- de un local no cobra igual ni tiene el mismo horario que el CAMARERO 1 de otro.
-- Asi que el puesto pertenece a un local, y el flujo pasa a ser: eliges local y
-- ves los puestos de ESE local. El empleado hereda el local de su puesto.
--
-- La vacante deja de preguntarlo: ya lo dice el puesto que ofrece.
--
-- Idempotente: `if not exists` / `if exists` en todo.

-- 1) El puesto pertenece a un local.
alter table puestos add column if not exists local_id uuid;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'puestos_local_id_fkey') then
    alter table puestos
      add constraint puestos_local_id_fkey
      foreign key (local_id) references locales(id) on delete set null;
  end if;
end $$;

create index if not exists idx_puestos_local on puestos(local_id);

comment on column puestos.local_id is
  'Local (centro de trabajo) al que pertenece el puesto. Se elige el local y se ven sus puestos; el empleado hereda este local al contratar. Null = puesto sin local todavia.';

-- 2) Los puestos existentes se asignan al UNICO local de su empresa. Solo se
--    toca a las empresas que tienen exactamente uno: donde hay varios (o
--    ninguno) no hay forma de adivinarlo y se deja en null a proposito.
update puestos p
set local_id = u.local_id, updated_at = now()
from (
  select empresa_id, (array_agg(id))[1] as local_id
  from locales
  where activo
  group by empresa_id
  having count(*) = 1
) u
where u.empresa_id = p.empresa_id
  and p.local_id is null;

-- 3) La vacante ya no lleva local: lo dice su puesto.
drop index if exists idx_vacantes_local;

do $$
begin
  if exists (select 1 from pg_constraint where conname = 'vacantes_local_id_fkey') then
    alter table vacantes drop constraint vacantes_local_id_fkey;
  end if;
end $$;

alter table vacantes drop column if exists local_id;
