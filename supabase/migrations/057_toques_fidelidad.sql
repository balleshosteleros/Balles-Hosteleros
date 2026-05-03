-- ============================================================
-- 057_toques_fidelidad.sql — Sistema TOQUES (PRP-033)
--
-- Gamificación interna de empleados:
--   - Devengo automático por reglas (cron diario)
--   - Ranking por periodo (día/semana/mes/trimestre/año)
--   - Recompensas canjeables aprobadas por RRHH
--   - Niveles paralelos (Aprendiz → Leyenda Balles)
--
-- Referencias de modelado: 035_pos.sql / 038_carta_digital.sql /
-- 050_mi_panel_solicitudes.sql.
-- profiles.empresa_id es uuid; user_id apunta a auth.users.
-- ============================================================

-- ─── 0. ENUMS ────────────────────────────────────────────────
do $$ begin
  create type public.toque_periodo as enum ('dia','semana','mes','trimestre','ano');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.canje_estado as enum ('pendiente','aprobada','rechazada','disfrutada','anulada');
exception when duplicate_object then null; end $$;

-- ─── 1. REGLAS configurables ─────────────────────────────────
create table if not exists public.toques_reglas (
  id              uuid primary key default gen_random_uuid(),
  empresa_id      uuid not null references public.empresas(id) on delete cascade,
  codigo          text not null,
  nombre          text not null,
  descripcion     text not null default '',
  toques          integer not null default 1,
  periodicidad    text not null default 'diario'
                    check (periodicidad in ('diario','semanal','trimestral')),
  activa          boolean not null default true,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (empresa_id, codigo)
);

create index if not exists idx_toques_reglas_empresa
  on public.toques_reglas(empresa_id, activa);

-- ─── 2. NIVELES configurables ────────────────────────────────
create table if not exists public.toques_niveles (
  id              uuid primary key default gen_random_uuid(),
  empresa_id      uuid not null references public.empresas(id) on delete cascade,
  orden           smallint not null,
  nombre          text not null,
  toques_min      integer not null,
  badge_color     text not null default '#6b7280',
  badge_icon      text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (empresa_id, orden)
);

create index if not exists idx_toques_niveles_empresa
  on public.toques_niveles(empresa_id, orden);

-- ─── 3. RECOMPENSAS configurables ────────────────────────────
create table if not exists public.toques_recompensas (
  id              uuid primary key default gen_random_uuid(),
  empresa_id      uuid not null references public.empresas(id) on delete cascade,
  nombre          text not null,
  descripcion     text not null default '',
  coste_toques    integer not null,
  tipo            text not null check (tipo in (
    'hora_libre','dia_vacaciones','fin_semana',
    'semana_vacaciones','regalo_anual_descriptivo','custom'
  )),
  activa          boolean not null default true,
  orden           smallint not null default 0,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists idx_toques_recompensas_empresa
  on public.toques_recompensas(empresa_id, activa, orden);

-- ─── 4. MOVIMIENTOS (ledger inmutable) ───────────────────────
create table if not exists public.toques_movimientos (
  id              uuid primary key default gen_random_uuid(),
  empresa_id      uuid not null references public.empresas(id) on delete cascade,
  user_id         uuid not null references auth.users(id) on delete cascade,
  empleado_nombre text not null default '',
  toques          integer not null,
  origen          text not null check (origen in ('regla','bonus_periodo','manual','canje','ajuste')),
  regla_id        uuid references public.toques_reglas(id) on delete set null,
  recompensa_id   uuid references public.toques_recompensas(id) on delete set null,
  canje_id        uuid,
  periodo         public.toque_periodo,
  fecha           date not null default current_date,
  motivo          text not null default '',
  contexto        jsonb not null default '{}'::jsonb,
  otorgado_por    uuid references auth.users(id) on delete set null,
  created_at      timestamptz not null default now()
);

create index if not exists idx_toques_mov_user_fecha
  on public.toques_movimientos(user_id, fecha desc);
create index if not exists idx_toques_mov_empresa_fecha
  on public.toques_movimientos(empresa_id, fecha desc);
create index if not exists idx_toques_mov_origen
  on public.toques_movimientos(empresa_id, origen, fecha desc);

-- Idempotencia: una regla no se puede otorgar dos veces el mismo día al mismo usuario
create unique index if not exists uniq_toques_mov_regla_diaria
  on public.toques_movimientos(user_id, regla_id, fecha)
  where origen = 'regla' and regla_id is not null;

-- Idempotencia bonus periódico: un usuario no recibe dos veces el bonus del mismo periodo
create unique index if not exists uniq_toques_mov_bonus_periodo
  on public.toques_movimientos(user_id, periodo, fecha)
  where origen = 'bonus_periodo' and periodo is not null;

-- ─── 5. CANJES (solicitudes de recompensa) ───────────────────
create table if not exists public.toques_canjes (
  id              uuid primary key default gen_random_uuid(),
  empresa_id      uuid not null references public.empresas(id) on delete cascade,
  user_id         uuid not null references auth.users(id) on delete cascade,
  empleado_nombre text not null default '',
  recompensa_id   uuid not null references public.toques_recompensas(id) on delete restrict,
  recompensa_nombre text not null default '',
  coste_toques    integer not null,
  estado          public.canje_estado not null default 'pendiente',
  solicitado_at   timestamptz not null default now(),
  resuelto_at     timestamptz,
  resuelto_por    uuid references auth.users(id) on delete set null,
  fecha_disfrute  date,
  notas_solicitud text not null default '',
  notas_revision  text not null default '',
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists idx_toques_canjes_empresa_estado
  on public.toques_canjes(empresa_id, estado, solicitado_at desc);
create index if not exists idx_toques_canjes_user
  on public.toques_canjes(user_id, solicitado_at desc);

-- ─── 6. GANADORES (snapshots por periodo) ────────────────────
create table if not exists public.toques_ganadores (
  id              uuid primary key default gen_random_uuid(),
  empresa_id      uuid not null references public.empresas(id) on delete cascade,
  periodo         public.toque_periodo not null,
  periodo_inicio  date not null,
  periodo_fin     date not null,
  user_id         uuid not null references auth.users(id) on delete cascade,
  empleado_nombre text not null default '',
  total_toques    integer not null,
  bonus_otorgado  integer not null,
  titulo          text,
  created_at      timestamptz not null default now(),
  unique (empresa_id, periodo, periodo_inicio)
);

create index if not exists idx_toques_ganadores_empresa
  on public.toques_ganadores(empresa_id, periodo, periodo_inicio desc);

-- ─── 7. VISTA agregada de balance ────────────────────────────
-- security_invoker=true → la vista respeta RLS del consumidor (no del creador).
drop view if exists public.toques_balance;
create view public.toques_balance
with (security_invoker = true) as
select
  m.empresa_id,
  m.user_id,
  coalesce(sum(case when m.toques > 0 then m.toques else 0 end), 0)::int as toques_acumulados,
  coalesce(sum(m.toques), 0)::int                                        as toques_canjeables,
  max(m.created_at)                                                      as ultimo_movimiento_at
from public.toques_movimientos m
group by m.empresa_id, m.user_id;

-- ─── 8. FUNCIÓN ranking por periodo ──────────────────────────
create or replace function public.toques_ranking(
  p_empresa_id uuid,
  p_inicio     date,
  p_fin        date
) returns table (
  user_id          uuid,
  empleado_nombre  text,
  total            integer,
  antiguedad       timestamptz
) language sql stable
set search_path = public, pg_temp
as $$
  select
    m.user_id,
    coalesce(max(p.full_name), max(p.nombre), max(m.empleado_nombre)) as empleado_nombre,
    sum(case when m.toques > 0 then m.toques else 0 end)::int as total,
    max(p.created_at) as antiguedad
  from public.toques_movimientos m
  left join public.profiles p on p.user_id = m.user_id
  where m.empresa_id = p_empresa_id
    and m.fecha between p_inicio and p_fin
  group by m.user_id
  order by total desc, max(p.created_at) asc nulls last,
           coalesce(max(p.full_name), max(p.nombre), max(m.empleado_nombre)) asc;
$$;

-- ─── 9. TRIGGERS de updated_at ───────────────────────────────
create or replace function public.set_toques_updated_at()
returns trigger language plpgsql
set search_path = public, pg_temp
as $$
begin new.updated_at = now(); return new; end; $$;

drop trigger if exists toques_reglas_updated on public.toques_reglas;
create trigger toques_reglas_updated before update on public.toques_reglas
  for each row execute function public.set_toques_updated_at();

drop trigger if exists toques_niveles_updated on public.toques_niveles;
create trigger toques_niveles_updated before update on public.toques_niveles
  for each row execute function public.set_toques_updated_at();

drop trigger if exists toques_recompensas_updated on public.toques_recompensas;
create trigger toques_recompensas_updated before update on public.toques_recompensas
  for each row execute function public.set_toques_updated_at();

drop trigger if exists toques_canjes_updated on public.toques_canjes;
create trigger toques_canjes_updated before update on public.toques_canjes
  for each row execute function public.set_toques_updated_at();

-- ─── 10. RLS ─────────────────────────────────────────────────
alter table public.toques_movimientos enable row level security;
alter table public.toques_canjes      enable row level security;
alter table public.toques_reglas      enable row level security;
alter table public.toques_recompensas enable row level security;
alter table public.toques_niveles     enable row level security;
alter table public.toques_ganadores   enable row level security;

-- READ: cualquier empleado de la empresa lee todo (ranking público)
drop policy if exists "toques_mov_read" on public.toques_movimientos;
create policy "toques_mov_read" on public.toques_movimientos for select to authenticated
  using (empresa_id in (select p.empresa_id from public.profiles p where p.user_id = auth.uid()));

drop policy if exists "toques_canjes_read" on public.toques_canjes;
create policy "toques_canjes_read" on public.toques_canjes for select to authenticated
  using (empresa_id in (select p.empresa_id from public.profiles p where p.user_id = auth.uid()));

drop policy if exists "toques_reglas_read" on public.toques_reglas;
create policy "toques_reglas_read" on public.toques_reglas for select to authenticated
  using (empresa_id in (select p.empresa_id from public.profiles p where p.user_id = auth.uid()));

drop policy if exists "toques_recompensas_read" on public.toques_recompensas;
create policy "toques_recompensas_read" on public.toques_recompensas for select to authenticated
  using (empresa_id in (select p.empresa_id from public.profiles p where p.user_id = auth.uid()));

drop policy if exists "toques_niveles_read" on public.toques_niveles;
create policy "toques_niveles_read" on public.toques_niveles for select to authenticated
  using (empresa_id in (select p.empresa_id from public.profiles p where p.user_id = auth.uid()));

drop policy if exists "toques_ganadores_read" on public.toques_ganadores;
create policy "toques_ganadores_read" on public.toques_ganadores for select to authenticated
  using (empresa_id in (select p.empresa_id from public.profiles p where p.user_id = auth.uid()));

-- INSERT canjes: el usuario crea su propia solicitud
drop policy if exists "toques_canjes_insert_own" on public.toques_canjes;
create policy "toques_canjes_insert_own" on public.toques_canjes for insert to authenticated
  with check (
    user_id = auth.uid()
    and empresa_id in (select p.empresa_id from public.profiles p where p.user_id = auth.uid())
  );

-- UPDATE/DELETE de configuración (reglas/niveles/recompensas/ganadores) y movimientos
-- queda fuera del cliente: se hace vía Server Action con service-role.
-- El cliente NUNCA inserta/edita movimientos directamente.

-- Manage canjes para admin (RRHH/Gerencia/Director/admin) — controlado en server action,
-- pero abrimos la policy para que la función pueda actualizar en nombre del usuario admin.
drop policy if exists "toques_canjes_manage_admin" on public.toques_canjes;
create policy "toques_canjes_manage_admin" on public.toques_canjes for update to authenticated
  using (
    empresa_id in (select p.empresa_id from public.profiles p where p.user_id = auth.uid())
    and exists (
      select 1 from public.user_roles ur
      where ur.user_id = auth.uid()
        and ur.role in ('admin','director','gerencia','responsable')
    )
  )
  with check (
    empresa_id in (select p.empresa_id from public.profiles p where p.user_id = auth.uid())
  );

-- ─── 11. SEED por empresa ────────────────────────────────────
-- Reglas (11 totales: 9 PRP + 2 restauranteras añadidas)
-- activa=false para reglas cuya fuente de datos aún no está disponible.
insert into public.toques_reglas (empresa_id, codigo, nombre, descripcion, toques, periodicidad, activa)
select
  e.id, x.codigo, x.nombre, x.descripcion, x.toques, x.periodicidad, x.activa
from public.empresas e
cross join (values
  ('puntualidad_elite',          'Puntualidad élite',           'Primer empleado en fichar entrada antes o a su hora',          1, 'diario',     true),
  ('cumplidor_dia',              'Cumplidor del día',           'Termina TODAS sus tareas asignadas del día',                    1, 'diario',     true),
  ('cero_olvidos_fichaje',       'Cero olvidos de fichaje',     'Fichó entrada y salida del día sin olvidos',                    1, 'diario',     true),
  ('sin_vacaciones_trimestre',   'Sin vacaciones este trimestre','No solicitó vacaciones en el trimestre completo',              5, 'trimestral', true),
  ('comunicado_leido_primero',   'Comunicado leído primero',    'Primer empleado en marcar como leído un comunicado importante', 1, 'diario',     false),
  ('asistencia_perfecta_semanal','Asistencia perfecta semanal', 'Sin retrasos ni ausencias en la semana',                        3, 'semanal',    true),
  ('velocidad_chat',             'Velocidad chat',              'Menor tiempo medio de respuesta en chats internos',             1, 'diario',     false),
  ('appcc_al_dia',               'APPCC al día',                'Registró todas las temperaturas de cocina del día',             1, 'diario',     false),
  ('resolucion_incidencias',     'Resolución de incidencias',   'Cierra una incidencia o consulta interna asignada',             1, 'diario',     false),
  ('caja_cuadrada',              'Caja cuadrada al céntimo',    'Cierre de caja del día sin descuadre',                          2, 'diario',     false),
  ('cero_mermas_cocina',         'Cero mermas en cocina',       'Día completo sin mermas registradas',                           2, 'diario',     false)
) as x(codigo, nombre, descripcion, toques, periodicidad, activa)
on conflict (empresa_id, codigo) do nothing;

-- Niveles (5 niveles de progresión, genéricos para cualquier puesto)
insert into public.toques_niveles (empresa_id, orden, nombre, toques_min, badge_color, badge_icon)
select e.id, x.orden, x.nombre, x.toques_min, x.badge_color, x.badge_icon
from public.empresas e
cross join (values
  -- Paleta pastel: Aprendiz=verde menta, Avanzado=azul cielo,
  -- Veterano=bronce, Mentor=plata, Leyenda=oro.
  (1::smallint, 'Aprendiz', 0,    '#a7d8b1', 'Sprout'),
  (2::smallint, 'Avanzado', 150,  '#a3c8e8', 'Zap'),
  (3::smallint, 'Veterano', 500,  '#c98c5e', 'Shield'),
  (4::smallint, 'Mentor',   1000, '#c8d0d6', 'Award'),
  (5::smallint, 'Leyenda',  2000, '#e8c468', 'Crown')
) as x(orden, nombre, toques_min, badge_color, badge_icon)
on conflict (empresa_id, orden) do nothing;

-- Recompensas (4 estándar + 1 super premio anual descriptivo)
insert into public.toques_recompensas (empresa_id, nombre, descripcion, coste_toques, tipo, orden)
select e.id, x.nombre, x.descripcion, x.coste_toques, x.tipo, x.orden
from public.empresas e
cross join (values
  ('1 hora libre',                'Sal una hora antes (o entra una hora más tarde) un día a tu elección. Sujeto a aprobación de RRHH.',                              50,  'hora_libre',                1::smallint),
  ('1 día de vacaciones extra',   'Un día completo de vacaciones extra. Sujeto a aprobación de RRHH y cuadrante.',                                                   100, 'dia_vacaciones',            2::smallint),
  ('Fin de semana libre',         'Un fin de semana completo libre (vie-dom o sáb-dom). Sujeto a aprobación de RRHH y cuadrante.',                                   200, 'fin_semana',                3::smallint),
  ('3 días extra de vacaciones',  'Tres días de vacaciones extra. Sujeto a aprobación de RRHH y cuadrante.',                                                         350, 'dia_vacaciones',            4::smallint),
  ('1 semana extra de vacaciones','Una semana completa de vacaciones extra. Sujeto a aprobación de RRHH y cuadrante.',                                               500, 'semana_vacaciones',         5::smallint),
  ('Super premio anual',          'Recompensa especial reservada al Empleado del Año. Personalizable por RRHH (ej. viaje fin de semana en pareja, todo pagado).',    0,   'regalo_anual_descriptivo',  99::smallint)
) as x(nombre, descripcion, coste_toques, tipo, orden)
on conflict do nothing;

-- ─── 11.5 REALTIME publication ───────────────────────────────
-- Habilita Realtime para que el cliente reciba INSERTs de movimientos.
-- Idempotente: si la publication ya tiene la tabla, el ALTER ignora.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'toques_movimientos'
  ) then
    execute 'alter publication supabase_realtime add table public.toques_movimientos';
  end if;
exception when others then
  -- Si la publication no existe en este entorno, lo ignoramos.
  raise notice 'realtime publication setup skipped: %', sqlerrm;
end $$;

-- ─── 12. COMENTARIOS ─────────────────────────────────────────
comment on table public.toques_movimientos is
  'Ledger inmutable de toques (PRP-033). Append-only; balance se deriva con view toques_balance.';
comment on table public.toques_reglas is
  'Reglas configurables de devengo de toques. El runner mapea por codigo. activa=false → skip.';
comment on table public.toques_niveles is
  'Niveles de progresión calculados sobre toques_acumulados (solo positivos).';
comment on table public.toques_recompensas is
  'Catálogo de recompensas canjeables con coste en toques.';
comment on table public.toques_canjes is
  'Solicitudes de canje. Toques se descuentan al aprobar, no al solicitar.';
comment on table public.toques_ganadores is
  'Snapshots históricos del ganador de cada periodo (día/semana/mes/trimestre/año).';
comment on view public.toques_balance is
  'Balance vivo por usuario: toques_acumulados (solo +, dictan nivel) y toques_canjeables (saldo).';
comment on function public.toques_ranking(uuid, date, date) is
  'Ranking de empresa por rango de fechas. Desempate: antiguedad asc, nombre asc.';
