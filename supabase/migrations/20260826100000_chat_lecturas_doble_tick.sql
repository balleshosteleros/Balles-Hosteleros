-- Doble tick de lectura en el chat interno (estilo WhatsApp).
--
-- Un tick gris  = enviado (el mensaje está en la base de datos).
-- Doble tick AZUL = alguien del grupo lo ha abierto y leído.
--
-- La lectura es un HECHO y no se puede deshacer: no hay policy de UPDATE ni de
-- DELETE, y el insert es idempotente (on conflict do nothing), así que la hora
-- registrada es la de la primera lectura y nadie puede cambiarla después.
-- Idempotente: se puede re-ejecutar sin romper nada.

create table if not exists public.mensajes_lecturas (
  mensaje_id uuid not null references public.mensajes(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  leido_at timestamptz not null default now(),
  primary key (mensaje_id, user_id)
);

create index if not exists mensajes_lecturas_mensaje_idx
  on public.mensajes_lecturas (mensaje_id);

alter table public.mensajes_lecturas enable row level security;

drop policy if exists mensajes_lecturas_select on public.mensajes_lecturas;
create policy mensajes_lecturas_select on public.mensajes_lecturas
  for select using (
    exists (
      select 1 from public.mensajes m
      where m.id = mensajes_lecturas.mensaje_id
    )
  );

-- Cada usuario solo puede marcar leído EN SU PROPIO NOMBRE: el tick no se
-- puede falsear desde el cliente.
drop policy if exists mensajes_lecturas_insert on public.mensajes_lecturas;
create policy mensajes_lecturas_insert on public.mensajes_lecturas
  for insert with check (user_id = auth.uid());

-- ───────── RPCs ─────────

-- Marca como leídos todos los mensajes ajenos del canal. Idempotente.
create or replace function public.chat_marcar_leidos(p_canal uuid)
returns void
language sql
security definer
set search_path = public
as $$
  insert into public.mensajes_lecturas (mensaje_id, user_id)
  select m.id, auth.uid()
  from public.mensajes m
  where m.canal_id = p_canal
    and m.autor_id is distinct from auth.uid()
    and auth.uid() is not null
  on conflict (mensaje_id, user_id) do nothing;
$$;

-- `revoke from public` no quita el grant que `anon` tiene por separado: hay que
-- revocárselo explícitamente (son SECURITY DEFINER).
revoke all on function public.chat_marcar_leidos(uuid) from public;
revoke execute on function public.chat_marcar_leidos(uuid) from anon;
grant execute on function public.chat_marcar_leidos(uuid) to authenticated;

-- Por cada mensaje PROPIO del canal, cuántas personas lo han leído.
create or replace function public.chat_lecturas_canal(p_canal uuid)
returns table (mensaje_id uuid, lectores integer)
language sql
security definer
set search_path = public
as $$
  select m.id, count(l.user_id)::int
  from public.mensajes m
  left join public.mensajes_lecturas l on l.mensaje_id = m.id
  where m.canal_id = p_canal
    and m.autor_id = auth.uid()
  group by m.id;
$$;

revoke all on function public.chat_lecturas_canal(uuid) from public;
revoke execute on function public.chat_lecturas_canal(uuid) from anon;
grant execute on function public.chat_lecturas_canal(uuid) to authenticated;

-- Quién ha leído un mensaje concreto (nombre + hora).
create or replace function public.chat_lectores_mensaje(p_mensaje uuid)
returns table (user_id uuid, nombre text, apellidos text, leido_at timestamptz)
language sql
security definer
set search_path = public
as $$
  select l.user_id, u.nombre, u.apellidos, l.leido_at
  from public.mensajes_lecturas l
  join public.usuarios u on u.user_id = l.user_id
  where l.mensaje_id = p_mensaje
  order by l.leido_at asc;
$$;

revoke all on function public.chat_lectores_mensaje(uuid) from public;
revoke execute on function public.chat_lectores_mensaje(uuid) from anon;
grant execute on function public.chat_lectores_mensaje(uuid) to authenticated;

-- Realtime: el tick se pone azul en vivo, sin recargar.
do $$
begin
  alter publication supabase_realtime add table public.mensajes_lecturas;
exception when duplicate_object then null;
end $$;
