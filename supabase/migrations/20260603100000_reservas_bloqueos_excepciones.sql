-- Excepciones puntuales a bloqueos de reservas.
--
-- Cuando el usuario quita un bloqueo "desde la mesa" en /sala/reservas sólo
-- para ese día y ese turno, NO borramos el bloqueo (que puede ser recurrente
-- o de rango), sino que insertamos una fila aquí: "esa mesa NO está bloqueada
-- en (fecha, turno)". `getMesasBloqueadas` substrae estas excepciones.

create table if not exists empresa_reservas_bloqueos_excepciones (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references empresas(id) on delete cascade,
  local_id uuid not null references locales(id) on delete cascade,
  fecha date not null,
  turno text not null check (turno in ('COMIDA','CENA')),
  mesa_id uuid not null references mesas(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique(empresa_id, fecha, turno, mesa_id)
);

create index if not exists erbe_lookup_idx
  on empresa_reservas_bloqueos_excepciones(empresa_id, local_id, fecha, turno);

alter table empresa_reservas_bloqueos_excepciones enable row level security;

drop policy if exists reservas_bloqueos_excep_select on empresa_reservas_bloqueos_excepciones;
create policy reservas_bloqueos_excep_select on empresa_reservas_bloqueos_excepciones
  for select using (empresa_id in (select empresas_del_usuario()));

drop policy if exists reservas_bloqueos_excep_insert on empresa_reservas_bloqueos_excepciones;
create policy reservas_bloqueos_excep_insert on empresa_reservas_bloqueos_excepciones
  for insert with check (empresa_id in (select empresas_del_usuario()));

drop policy if exists reservas_bloqueos_excep_delete on empresa_reservas_bloqueos_excepciones;
create policy reservas_bloqueos_excep_delete on empresa_reservas_bloqueos_excepciones
  for delete using (empresa_id in (select empresas_del_usuario()));
