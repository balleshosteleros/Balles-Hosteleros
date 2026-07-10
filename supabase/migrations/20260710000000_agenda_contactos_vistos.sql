-- Migration: marca de "contactos de la agenda vistos" por usuario × empresa.
--
-- Problema que resuelve: el badge de "contactos nuevos" de la agenda contaba
-- todos los contactos creados en los últimos N días, sin memoria de si el
-- usuario ya los había visto. Como no había registro por usuario, el badge
-- (p. ej. "3") nunca desaparecía al abrir la agenda: solo bajaba cuando los
-- contactos envejecían fuera de la ventana. Además le salía a todos por igual
-- sin poder marcarse individualmente.
--
-- Con esta tabla, cada usuario guarda "visto hasta" (timestamp). El badge pasa
-- a contar solo los contactos creados DESPUÉS de esa marca. Al abrir la agenda
-- se actualiza la marca a "ahora" → el badge se pone a 0 para ESE usuario,
-- sin afectar a los demás. Es idempotente (una fila por usuario × empresa).

-- =======================================================
-- 1. Tabla agenda_contactos_vistos
-- =======================================================
create table if not exists public.agenda_contactos_vistos (
  user_id uuid not null references auth.users(id) on delete cascade,
  empresa_id uuid not null references public.empresas(id) on delete cascade,
  visto_at timestamptz not null default now(),
  primary key (user_id, empresa_id)
);

create index if not exists idx_agenda_contactos_vistos_user
  on public.agenda_contactos_vistos(user_id, empresa_id);

-- =======================================================
-- 2. RLS: cada usuario solo ve/gestiona su propia marca
-- =======================================================
alter table public.agenda_contactos_vistos enable row level security;

drop policy if exists "Users read own agenda vistos" on public.agenda_contactos_vistos;
create policy "Users read own agenda vistos"
  on public.agenda_contactos_vistos for select
  to authenticated
  using (user_id = auth.uid());

drop policy if exists "Users insert own agenda vistos" on public.agenda_contactos_vistos;
create policy "Users insert own agenda vistos"
  on public.agenda_contactos_vistos for insert
  to authenticated
  with check (user_id = auth.uid());

drop policy if exists "Users update own agenda vistos" on public.agenda_contactos_vistos;
create policy "Users update own agenda vistos"
  on public.agenda_contactos_vistos for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());
