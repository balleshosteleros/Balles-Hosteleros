-- ============================================================
-- 20260909210000_almacen_cierres.sql
-- Cierre de almacén: lo anterior al corte no se toca.
--
-- PRP-080 Fase 2, segunda mitad. Regla de Iván: **almacén abierto → cualquier
-- movimiento se crea, se corrige o se borra y el sistema recalcula solo (eso lo
-- puso la migración anterior); almacén cerrado → nada anterior al corte se toca**,
-- ni mermas, ni albaranes, ni ventas, ni ajustes, ni inventarios.
--
-- Con esto desaparece el "deshacer" como concepto: no hay un botón que borre
-- histórico, hay un período abierto donde se edita con normalidad y uno cerrado
-- donde no se toca nada.
--
-- POR QUÉ LA GUARDA VIVE AQUÍ Y NO EN LA APLICACIÓN
--   Los movimientos entran por cuatro sitios distintos: el TypeScript del kardex,
--   el RPC del albarán (que es `security definer` y se salta la RLS), los borrados
--   en cascada al eliminar un producto, y cualquier cliente con la clave de
--   servicio. Un `if` en el servidor de la aplicación solo tapa el primero.
--
-- POR QUÉ EL CIERRE ES POR DÍA TERMINADO Y NO "A FECHA Y HORA"
--   Las ventas de Ágora llegan estampadas a las 12:00 del día de negocio y no
--   entran hasta la mañana siguiente. Un corte "ahora" a las 18:00 rechazaría las
--   ventas de hoy cuando llegasen mañana. Por eso solo se cierran días acabados:
--   `corte_dia` es el último día CERRADO (inclusive) y `corte` es el primer
--   instante ABIERTO — la medianoche siguiente, en la hora de la empresa.
--
-- DECISIONES TOMADAS POR DEFECTO (pendientes de que Iván las confirme o cambie):
--   · Cierra y reabre quien tenga Logística editable.
--   · Reabrir exige motivo y queda registrado; reabre solo el último cierre
--     (reabrir septiembre no reabre agosto).
--   · El corte es por empresa. No por almacén: ni `stock_movimientos` ni `stock`
--     tienen columna de almacén — en `inventarios` es solo una etiqueta.
--
-- Sin efecto hasta que alguien cierre por primera vez.
-- ============================================================

-- ── 1. El registro de cierres ────────────────────────────────────────────────
create table if not exists public.almacen_cierres (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id) on delete cascade,
  -- Último día CERRADO, inclusive, en el día natural de la empresa.
  corte_dia date not null,
  -- Primer instante ABIERTO (exclusivo): medianoche local del día siguiente.
  corte timestamptz not null,
  -- El inventario desde el que se cerró, si vino de ahí.
  inventario_id uuid references public.inventarios(id) on delete set null,
  cerrado_por uuid,
  cerrado_at timestamptz not null default now(),
  reabierto_at timestamptz,
  reabierto_por uuid,
  motivo_reapertura text,
  created_at timestamptz not null default now(),
  constraint almacen_cierres_motivo_si_reabierto
    check (reabierto_at is null or coalesce(trim(motivo_reapertura), '') <> '')
);

comment on table public.almacen_cierres is
  'Puntos de corte del almacén (PRP-080 Fase 2). El vigente es el de mayor `corte` sin '
  'reabrir. Nada con fecha anterior a `corte` se puede crear, modificar ni borrar.';

create index if not exists idx_almacen_cierres_vigente
  on public.almacen_cierres (empresa_id, corte desc) where reabierto_at is null;

alter table public.almacen_cierres enable row level security;

drop policy if exists almacen_cierres_sel on public.almacen_cierres;
create policy almacen_cierres_sel on public.almacen_cierres
  for select to authenticated
  using (empresa_id in (select public.empresas_del_usuario()));

-- Sin policy de escritura: se cierra y se reabre por las funciones de abajo, que
-- corren con la clave de servicio desde las acciones del servidor.

-- ── 2. Hora real del recuento ────────────────────────────────────────────────
-- Los inventarios se estampaban a las 12:00 UTC del día del documento, igual que
-- las ventas de Ágora. Con el ancla eso importa: si el recuento y las ventas del
-- mismo día empatan a la misma hora, el orden lo decide el azar. Guardamos cuándo
-- se contó de verdad (ahora si es de hoy, fin del día si es de un día pasado).
alter table public.inventarios add column if not exists contado_at timestamptz;

comment on column public.inventarios.contado_at is
  'Instante real del recuento, que es el que se usa como fecha del movimiento de '
  'inventario. Excepción deliberada al mediodía UTC de PRP-069: el ancla tiene que '
  'quedar después de las ventas del día que ya estaban contadas en la estantería.';

-- ── 3. El cierre vigente ─────────────────────────────────────────────────────
-- Reemplaza el stub de la migración anterior. `security definer` para que la
-- guarda lo vea siempre, venga de donde venga la escritura.
create or replace function public.almacen_cierre_vigente(p_empresa uuid)
returns timestamptz language sql stable security definer
set search_path = public as $fn$
  select max(corte) from public.almacen_cierres
   where empresa_id = p_empresa and reabierto_at is null;
$fn$;

comment on function public.almacen_cierre_vigente(uuid) is
  'Primer instante abierto del almacén de una empresa. NULL = no hay nada cerrado.';

-- ── 4. La guarda ─────────────────────────────────────────────────────────────
create or replace function public.stock_mov_guard_cierre()
returns trigger language plpgsql
set search_path = public as $fn$
declare
  v_emp uuid; v_fecha timestamptz; v_corte timestamptz; v_tz text;
begin
  -- El recálculo reescribe saldos de filas que pueden ser antiguas: se aparta.
  -- (No vale `pg_trigger_depth()`: dejaría pasar los borrados en cascada.)
  if coalesce(current_setting('app.kardex_recalculo', true), '') = '1' then
    return coalesce(NEW, OLD);
  end if;

  if TG_OP = 'INSERT' then
    v_emp := NEW.empresa_id; v_fecha := NEW.fecha;
  elsif TG_OP = 'DELETE' then
    v_emp := OLD.empresa_id; v_fecha := OLD.fecha;
  else
    -- Al modificar cuentan las dos fechas: ni se saca una fila del período
    -- cerrado ni se mete una nueva dentro.
    v_emp := OLD.empresa_id; v_fecha := least(OLD.fecha, NEW.fecha);
  end if;

  v_corte := public.almacen_cierre_vigente(v_emp);
  if v_corte is null or v_fecha >= v_corte then
    return coalesce(NEW, OLD);
  end if;

  select coalesce(nullif(trim(config_operativa->>'zonaHoraria'), ''), 'Europe/Madrid')
    into v_tz from public.empresas where id = v_emp;
  v_tz := coalesce(v_tz, 'Europe/Madrid');

  raise exception
    'El almacén está cerrado hasta el % (incluido), así que no se puede % un movimiento del %. Si de verdad hay que corregirlo, un responsable puede reabrirlo desde Logística → Stock.',
    to_char((v_corte - interval '1 second') at time zone v_tz, 'DD/MM/YYYY'),
    case TG_OP when 'INSERT' then 'apuntar' when 'DELETE' then 'borrar' else 'cambiar' end,
    to_char(v_fecha at time zone v_tz, 'DD/MM/YYYY')
    using errcode = 'P0001',
          hint = 'almacen_cerrado',
          detail = jsonb_build_object('corte', v_corte, 'fecha', v_fecha, 'op', TG_OP)::text;
end
$fn$;

drop trigger if exists trg_stock_mov_guard_cierre on public.stock_movimientos;
create trigger trg_stock_mov_guard_cierre
  before insert or update or delete on public.stock_movimientos
  for each row execute function public.stock_mov_guard_cierre();

-- ── 5. Cerrar y reabrir ──────────────────────────────────────────────────────
create or replace function public.almacen_cerrar(
  p_empresa uuid, p_dia date, p_inventario uuid, p_usuario uuid
) returns public.almacen_cierres language plpgsql
set search_path = public as $fn$
declare
  v_tz text; v_corte timestamptz; v_vigente timestamptz; v_row public.almacen_cierres;
begin
  select coalesce(nullif(trim(config_operativa->>'zonaHoraria'), ''), 'Europe/Madrid')
    into v_tz from public.empresas where id = p_empresa;
  if not found then raise exception 'Esa empresa no existe.'; end if;

  if p_dia >= (now() at time zone v_tz)::date then
    raise exception 'Solo se cierran días terminados: el % todavía no ha acabado.',
      to_char(p_dia, 'DD/MM/YYYY');
  end if;

  -- El primer instante abierto es la medianoche siguiente, en hora de la empresa.
  v_corte := ((p_dia + 1)::timestamp) at time zone v_tz;

  v_vigente := public.almacen_cierre_vigente(p_empresa);
  if v_vigente is not null and v_corte <= v_vigente then
    raise exception 'El almacén ya está cerrado hasta el %.',
      to_char((v_vigente - interval '1 second') at time zone v_tz, 'DD/MM/YYYY');
  end if;

  insert into public.almacen_cierres (empresa_id, corte_dia, corte, inventario_id, cerrado_por)
  values (p_empresa, p_dia, v_corte, p_inventario, p_usuario)
  returning * into v_row;
  return v_row;
end
$fn$;

create or replace function public.almacen_reabrir(
  p_empresa uuid, p_usuario uuid, p_motivo text
) returns public.almacen_cierres language plpgsql
set search_path = public as $fn$
declare v_row public.almacen_cierres;
begin
  if coalesce(trim(p_motivo), '') = '' then
    raise exception 'Para reabrir el almacén hay que decir por qué.';
  end if;

  -- Solo el último: reabrir septiembre no reabre agosto.
  update public.almacen_cierres
     set reabierto_at = now(), reabierto_por = p_usuario, motivo_reapertura = trim(p_motivo)
   where id = (select id from public.almacen_cierres
                where empresa_id = p_empresa and reabierto_at is null
                order by corte desc limit 1)
  returning * into v_row;

  if v_row.id is null then raise exception 'El almacén no está cerrado.'; end if;
  return v_row;
end
$fn$;

revoke execute on function public.almacen_cerrar(uuid, date, uuid, uuid) from public, authenticated;
revoke execute on function public.almacen_reabrir(uuid, uuid, text) from public, authenticated;

-- ── 6. Sincronización en vivo ────────────────────────────────────────────────
do $pub$
begin
  if not exists (
    select 1 from pg_publication_tables
     where pubname = 'supabase_realtime' and tablename = 'almacen_cierres'
  ) then
    execute 'alter publication supabase_realtime add table public.almacen_cierres';
  end if;
end
$pub$;
