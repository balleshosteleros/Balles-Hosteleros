-- Registro de movimientos de dinero de las reservas.
--
-- Hasta ahora el único rastro de un cobro eran unas columnas dentro de la
-- propia reserva (`cancelacion_estado`, `cancelacion_cobrada_at`). Eso tiene
-- dos consecuencias que ya costaron dinero de verdad:
--
--   · Un cobro que se ejecuta y NO llega a escribir en la reserva desaparece:
--     el dinero sale de la tarjeta del cliente y el software no se entera. El
--     informe de cobros sigue diciendo "sin cobrar" porque lee de `reservas`.
--   · Sin registro previo no hay forma de saber si un intento llegó a salir.
--     Marcarlo como "fallida" hace que el cron lo reintente, y se cobra dos
--     veces algo que ya se había cobrado.
--
-- Aquí queda escrito CADA intento, ANTES de llamar a Revolut. Si el proceso
-- muere a mitad, la fila se queda en `lanzado`, que significa exactamente lo
-- que pasó: se pidió un cobro y no sabemos cómo acabó. Eso NO se reintenta: se
-- resuelve preguntándole a Revolut, que es el único que sabe la verdad.

create table if not exists public.reserva_cobros (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id) on delete cascade,
  reserva_id uuid not null references public.reservas(id) on delete cascade,

  -- Qué política se está cobrando.
  concepto text not null check (concepto in ('garantia', 'cancelacion')),

  -- Positivo cobra, negativo devuelve. Sumar esta columna por reserva da lo
  -- que se ha cobrado de verdad, sin tener que interpretar estados.
  importe numeric(10, 2) not null,

  -- `lanzado`     → se llamó a Revolut y aún no sabemos el resultado.
  -- `cobrado`     → Revolut confirmó que el dinero se movió.
  -- `fallido`     → Revolut lo rechazó explícitamente. Solo esto se reintenta.
  -- `desconocido` → la llamada se perdió (timeout, corte). Ni cobrado ni
  --                 fallido: PENDIENTE DE COMPROBAR contra Revolut. Nunca se
  --                 reintenta, porque el dinero puede haber salido ya.
  -- `devuelto`    → movimiento de devolución.
  estado text not null default 'lanzado'
    check (estado in ('lanzado', 'cobrado', 'fallido', 'desconocido', 'devuelto')),

  -- Referencia única que viaja a Revolut como `merchant_order_ext_ref`. Es lo
  -- que permite preguntarle "¿existe este cobro?" y reconocerlo en el webhook.
  referencia text not null unique,

  revolut_order_id text,
  revolut_estado text,
  error text,

  -- Quién lo lanzó. NULL = el cron, no una persona.
  usuario_id uuid references public.usuarios(id) on delete set null,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  comprobado_at timestamptz
);

create index if not exists idx_reserva_cobros_reserva on public.reserva_cobros(reserva_id);
create index if not exists idx_reserva_cobros_empresa on public.reserva_cobros(empresa_id);
create index if not exists idx_reserva_cobros_order on public.reserva_cobros(revolut_order_id);

-- Los que hay que resolver preguntando a Revolut. Índice parcial: son pocos y
-- se consultan a menudo desde el cuadre.
create index if not exists idx_reserva_cobros_por_comprobar
  on public.reserva_cobros(created_at)
  where estado in ('lanzado', 'desconocido');

comment on table public.reserva_cobros is
  'Cada movimiento de dinero de una reserva, escrito ANTES de llamar a Revolut. Es la fuente de verdad de lo cobrado: sumar `importe` da el neto real. Un estado `lanzado` o `desconocido` significa "no sabemos si salió" y se resuelve preguntando a Revolut, nunca reintentando.';

comment on column public.reserva_cobros.referencia is
  'Va a Revolut como merchant_order_ext_ref. Permite comprobar si el cobro existe allí y emparejar el webhook con la reserva.';

comment on column public.reserva_cobros.estado is
  'lanzado = pedido, resultado desconocido | cobrado | fallido (rechazo explícito, único que se reintenta) | desconocido (la llamada se perdió: comprobar contra Revolut, NO reintentar) | devuelto';

-- ── Cerrojo: nunca dos cobros a la vez sobre la misma reserva ──────────
--
-- El doble cobro salió de aquí: entre "compruebo que no está cobrada" y
-- "escribo que sí lo está" hay una llamada de varios segundos a Revolut, y en
-- ese hueco una segunda pulsación del botón encuentra el estado sin tocar y
-- vuelve a cobrar. Este índice lo hace imposible a nivel de base de datos: no
-- pueden coexistir dos filas vivas del mismo concepto para una reserva.
create unique index if not exists idx_reserva_cobros_uno_en_vuelo
  on public.reserva_cobros(reserva_id, concepto)
  where estado in ('lanzado', 'cobrado');

alter table public.reserva_cobros enable row level security;

-- Se lee con las reglas de siempre: solo las empresas del usuario.
drop policy if exists "reserva_cobros_select" on public.reserva_cobros;
create policy "reserva_cobros_select" on public.reserva_cobros
  for select using (empresa_id in (select empresas_del_usuario()));

-- Escribe solo el servidor (service role): mover dinero no se hace desde el
-- navegador.
drop policy if exists "reserva_cobros_admin" on public.reserva_cobros;
create policy "reserva_cobros_admin" on public.reserva_cobros
  for all using (false) with check (false);

-- ── Estado nuevo en la reserva ────────────────────────────────────────
--
-- `desconocida` es la pieza que faltaba. Antes, un cobro cuya respuesta se
-- perdía se marcaba "fallida", y "fallida" es justo lo que el cron reintenta:
-- el sistema estaba diseñado para insistir precisamente sobre los casos que
-- peor conocía. Ahora eso queda aparte, visible, y sin reintento automático.
do $$
begin
  if exists (
    select 1 from information_schema.constraint_column_usage
    where table_name = 'reservas' and constraint_name = 'reservas_cancelacion_estado_check'
  ) then
    alter table public.reservas drop constraint reservas_cancelacion_estado_check;
  end if;
end $$;

alter table public.reservas
  add constraint reservas_cancelacion_estado_check
  check (cancelacion_estado is null or cancelacion_estado in (
    'pendiente', 'guardada', 'cobrada', 'fallida', 'liberada', 'desconocida'
  ));

comment on column public.reservas.cancelacion_estado is
  'pendiente | guardada (tarjeta lista) | cobrada | fallida (rechazo, se reintenta) | liberada | desconocida (se lanzó un cobro y no sabemos si salió: NO se reintenta, se comprueba contra Revolut)';
