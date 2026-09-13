-- Pulgar arriba / pulgar abajo en los comunicados.
--
-- QUÉ ES (Iván, 13-09-2026): cada trabajador puede decir si le ha gustado o no
-- el comunicado. Va de serie en TODOS, sin configurar nada.
--
-- PARA QUÉ: la empresa solo lo MIRA. No dispara nada —ni avisos, ni tareas, ni
-- respuestas—: es el termómetro de si lo que se comunica llega bien o no.
--
-- UN VOTO POR PERSONA Y COMUNICADO: la clave primaria es la pareja, así que
-- votar otra vez cambia el voto en lugar de sumar otro. Y se puede retirar en
-- cualquier momento: quitarlo borra la fila y el recuento baja al momento.
--
-- La identidad es `usuarios.id` (la ficha de esa empresa), igual que en
-- `notificaciones`: quien trabaja en dos locales vota en cada uno por separado,
-- porque el comunicado también es de una empresa concreta.

create table if not exists public.comunicado_valoraciones (
  comunicado_id uuid not null references public.comunicados(id) on delete cascade,
  usuario_id uuid not null references public.usuarios(id) on delete cascade,
  me_gusta boolean not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (comunicado_id, usuario_id)
);

comment on table public.comunicado_valoraciones is
  'Pulgar arriba/abajo de cada trabajador en un comunicado. Un voto por persona, se puede cambiar o retirar. Solo informativo: no dispara nada.';
comment on column public.comunicado_valoraciones.me_gusta is
  'true = pulgar arriba, false = pulgar abajo. Retirar el voto borra la fila.';

-- El recuento se pide por comunicado en cada carga del listado.
create index if not exists comunicado_valoraciones_comunicado_idx
  on public.comunicado_valoraciones (comunicado_id);

alter table public.comunicado_valoraciones enable row level security;

-- Cada uno gobierna SU voto y nada más. El recuento que ve la empresa se lee
-- con la llave de servicio desde el servidor, igual que el alcance.
drop policy if exists comunicado_valoraciones_propias on public.comunicado_valoraciones;
create policy comunicado_valoraciones_propias on public.comunicado_valoraciones
  for all
  to authenticated
  using (
    exists (
      select 1 from public.usuarios u
      where u.id = comunicado_valoraciones.usuario_id and u.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.usuarios u
      where u.id = comunicado_valoraciones.usuario_id and u.user_id = auth.uid()
    )
  );
