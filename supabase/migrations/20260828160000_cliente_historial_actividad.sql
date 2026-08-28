-- Actividad del CLIENTE: quién cambió sus datos de contacto, cuándo.
--
-- POR QUÉ una tabla propia y no `reserva_historial`: son dos cosas distintas y
-- se ven en dos sitios distintos.
--
--   · Actividad de la RESERVA  → lo que le pasa a ESA reserva: cambia de mesa,
--     de hora, de estado, de comensales. Al abrir otra reserva del mismo
--     cliente se ve la actividad de esa otra reserva, no la de esta.
--   · Actividad del CLIENTE    → lo que le pasa a la PERSONA: cambia su email,
--     su teléfono, su nombre. Es una sola, la misma se mire desde donde se
--     mire, porque el cliente es uno.
--
-- Meter los cambios de contacto en la actividad de la reserva obligaba a
-- duplicar la misma línea en todas las reservas del cliente, y aun así se leía
-- como si le hubiera pasado algo a la reserva. Cambiar un email no le pasa a
-- una reserva: le pasa al cliente.
--
-- Para qué sirve el registro: cuando alguien cambia el correo de un cliente,
-- todos los avisos anteriores se enviaron a la dirección vieja. Sin constancia
-- de cuándo se cambió y quién lo hizo, no hay forma de explicar después por qué
-- una confirmación llegó a un buzón que ya no es suyo.
--
-- Mismo patrón que `reserva_historial`: RLS multi-tenant vía
-- empresas_del_usuario(), y sin UPDATE ni DELETE (registro inmutable).
--
-- Idempotente.

create table if not exists public.cliente_historial (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id) on delete cascade,
  cliente_id uuid not null references public.clientes_sala(id) on delete cascade,
  -- Qué dato se tocó: 'nombre', 'apellidos', 'email', 'telefono'.
  campo text not null,
  valor_anterior text,
  valor_nuevo text,
  -- Quién. `usuarios.id` (no auth.users). El nombre se congela: si la persona
  -- se da de baja, la actividad antigua debe seguir diciendo quién fue.
  usuario_id uuid references public.usuarios(id) on delete set null,
  usuario_nombre text,
  -- De dónde vino el cambio. El cliente puede editar sus datos desde el portal
  -- público, así que no todo cambio tiene un empleado detrás.
  origen text not null default 'MANUAL',
  created_at timestamptz not null default now(),
  constraint cliente_historial_origen_chk
    check (origen in ('MANUAL', 'AUTOMATICO', 'PORTAL_PUBLICO', 'GOOGLE_RWG'))
);

-- La vista de Actividad siempre lee por cliente y en orden cronológico.
create index if not exists idx_cliente_historial_cliente
  on public.cliente_historial (cliente_id, created_at desc);

alter table public.cliente_historial enable row level security;

do $$
begin
  drop policy if exists "cliente_historial_select" on public.cliente_historial;
  drop policy if exists "cliente_historial_insert" on public.cliente_historial;
  drop policy if exists "cliente_historial_update" on public.cliente_historial;
  drop policy if exists "cliente_historial_delete" on public.cliente_historial;

  create policy "cliente_historial_select" on public.cliente_historial
    for select using (empresa_id in (select empresas_del_usuario()));
  create policy "cliente_historial_insert" on public.cliente_historial
    for insert with check (empresa_id in (select empresas_del_usuario()));
  -- Sin UPDATE ni DELETE a propósito: la actividad es un registro histórico.
  -- Si se pudiera reescribir, no serviría para lo que existe.
end $$;
