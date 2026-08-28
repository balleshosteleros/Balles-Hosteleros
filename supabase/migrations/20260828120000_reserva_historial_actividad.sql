-- Actividad de la reserva: quién cambió qué, cuándo.
--
-- Hasta ahora una reserva no dejaba rastro: se cambiaba de mesa, de hora, de
-- estado o de comensales y no había forma de saber quién lo hizo ni cuándo. En
-- sala eso es justo lo que se pregunta cuando algo no cuadra ("¿quién ha movido
-- esta mesa?"), así que cada cambio deja una fila aquí.
--
-- Un cambio de campo = una fila (valor anterior → valor nuevo). Un mismo
-- guardado que toque tres campos deja tres filas, todas con el mismo instante:
-- así la vista de Actividad puede listarlas o agruparlas sin tener que
-- interpretar un JSON.
--
-- Sigue el patrón de `candidato_historial`: RLS multi-tenant vía
-- empresas_del_usuario(). Aplica a todas las empresas, presentes y futuras.
--
-- Idempotente.

create table if not exists public.reserva_historial (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id) on delete cascade,
  reserva_id uuid not null references public.reservas(id) on delete cascade,
  -- Qué se tocó: 'estado', 'mesa', 'zona', 'personas', 'hora', 'fecha',
  -- 'turno', 'duracion_minutos', 'notas'… y 'CREACION' para el alta.
  campo text not null,
  valor_anterior text,
  valor_nuevo text,
  -- Quién. `usuarios.id` (no auth.users), igual que el histórico de correos.
  -- El nombre se congela: si la persona se da de baja, la actividad antigua
  -- debe seguir diciendo quién fue.
  usuario_id uuid references public.usuarios(id) on delete set null,
  usuario_nombre text,
  -- De dónde vino el cambio: back office, portal público, Google o un proceso
  -- automático (cron). Sin esto, un cambio del cron parecería no tener autor.
  origen text not null default 'MANUAL',
  created_at timestamptz not null default now(),
  constraint reserva_historial_origen_chk
    check (origen in ('MANUAL', 'AUTOMATICO', 'PORTAL_PUBLICO', 'GOOGLE_RWG'))
);

-- La vista de Actividad siempre lee por reserva y en orden cronológico.
create index if not exists idx_reserva_historial_reserva
  on public.reserva_historial (reserva_id, created_at desc);

alter table public.reserva_historial enable row level security;

do $$
begin
  drop policy if exists "reserva_historial_select" on public.reserva_historial;
  drop policy if exists "reserva_historial_insert" on public.reserva_historial;
  drop policy if exists "reserva_historial_update" on public.reserva_historial;
  drop policy if exists "reserva_historial_delete" on public.reserva_historial;

  create policy "reserva_historial_select" on public.reserva_historial
    for select using (empresa_id in (select empresas_del_usuario()));
  create policy "reserva_historial_insert" on public.reserva_historial
    for insert with check (empresa_id in (select empresas_del_usuario()));
  -- Sin UPDATE ni DELETE a propósito: la actividad es un registro histórico.
  -- Si se pudiera reescribir, no serviría para lo que existe.
end $$;
