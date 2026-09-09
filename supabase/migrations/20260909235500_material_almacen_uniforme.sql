-- ============================================================
-- 20260909235500_material_almacen_uniforme.sql
-- PRP-089 Fase 1: almacén propio de uniforme y material (RRHH)
--
-- RRHH necesita saber, en todo momento y por talla, cuántas piezas hay EN EL
-- ALMACÉN, cuántas están EN MANOS de los trabajadores y cuántas tiene LA EMPRESA
-- en total. Hasta ahora las entregas decían qué tenía cada persona, pero nadie
-- sabía de dónde había salido la camisa ni cuántas quedaban en la estantería.
--
-- POR QUÉ UN LIBRO PROPIO Y NO EL KARDEX DE LOGÍSTICA
--   `stock_movimientos` está atado a `productos`, y esos productos alimentan
--   escandallos, albaranes y las ventas de Ágora. Una camiseta ahí dentro
--   ensuciaría el coste de la comida. Además el kardex no sabe lo único que
--   aquí importa de verdad: que una pieza puede estar EN MANOS DE UNA PERSONA,
--   que no es lo mismo que estar en el almacén ni que haberse perdido.
--
-- POR QUÉ CADA MOVIMIENTO LLEVA DOS DELTAS Y NO UNA UBICACIÓN
--   Una entrega es UNA fila con `-1 almacén / +1 manos`. Si fueran dos filas
--   (una salida y una entrada) un fallo entre ambas escrituras dejaría media
--   entrega y el total de la empresa mentiría. Con dos deltas en la misma fila
--   entregar y devolver son atómicos: es imposible que creen o destruyan
--   material, porque los dos números se escriben juntos o no se escribe nada.
--
-- POR QUÉ NO HAY COLUMNA DE SALDO
--   El saldo se calcula sumando el libro (vista `material_saldos`). Un saldo
--   guardado hay que mantenerlo sincronizado, y el día que se desincroniza nadie
--   se entera. Con decenas de piezas la suma es instantánea. El kardex de cocina
--   sí guarda saldo porque procesa miles de líneas de Ágora; aquí no hace falta.
--
-- Idempotente: se puede aplicar dos veces sin romper nada.
-- ============================================================

-- ------------------------------------------------------------
-- 1) El libro de movimientos
-- ------------------------------------------------------------
create table if not exists public.material_movimientos (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id) on delete cascade,

  -- La unidad de stock es el tipo del catálogo MÁS la talla: "camisa manga
  -- corta M" y "camisa manga corta L" son dos cosas distintas en la estantería.
  -- El nombre y la talla van congelados, igual que en el acta firmada: si mañana
  -- se borra o se renombra el tipo, el libro tiene que seguir siendo legible.
  tipo_id uuid references public.entregas_tipos_material(id) on delete set null,
  tipo_nombre text not null,
  categoria text not null default 'material' check (categoria in ('uniforme', 'material')),
  talla text,

  fecha date not null default current_date,
  tipo_movimiento text not null check (tipo_movimiento in (
    'inicial',               -- carga de partida: lo que ya había el día que se estrena esto
    'compra',                -- entra material nuevo
    'entrega',               -- del almacén a las manos del trabajador
    'devolucion',            -- vuelve del trabajador al almacén
    'deterioro_trabajador',  -- se le rompe teniéndolo él
    'deterioro_almacen',     -- se estropea en la estantería
    'no_devuelta',           -- se marcha y nunca la trae: pérdida
    'ajuste_recuento'        -- lo que aparece o falta al contar físicamente
  )),

  -- Los dos deltas con signo. Ver la cabecera: un movimiento = una fila.
  delta_almacen integer not null default 0,
  delta_manos   integer not null default 0,
  constraint material_mov_no_vacio check (delta_almacen <> 0 or delta_manos <> 0),

  -- De dónde viene el movimiento
  entrega_id  uuid references public.entregas_material(id) on delete set null,
  empleado_id uuid references public.empleados(id) on delete set null,
  recuento_id uuid,  -- FK añadida más abajo, cuando ya exista la tabla de recuentos
  -- Corregir el libro es añadir la fila contraria, nunca borrar la original.
  revierte_a  uuid references public.material_movimientos(id) on delete set null,

  motivo text,                  -- obligatorio en bajas, pérdidas y ajustes
  proveedor text,               -- solo en compras
  documento_referencia text,    -- nº de albarán o factura del proveedor
  coste_unitario numeric(10,2), -- opcional: permite valorar lo que se pierde

  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null,
  created_por_nombre text
);

comment on table public.material_movimientos is
  'Libro del almacén de uniforme y material de RRHH. Fuente única de los tres saldos. Nada se edita ni se borra: se corrige con un movimiento de signo contrario.';
comment on column public.material_movimientos.delta_almacen is
  'Unidades que entran (+) o salen (-) de la estantería.';
comment on column public.material_movimientos.delta_manos is
  'Unidades que pasan a estar (+) o dejan de estar (-) en manos de un trabajador.';
comment on column public.material_movimientos.revierte_a is
  'Si esta fila deshace otra (se borró una entrega ya firmada), apunta a la original.';

-- Una entrega no puede generar dos veces el mismo movimiento aunque se reintente
-- la firma. Las filas de reversión quedan fuera: son legítimamente una segunda fila.
create unique index if not exists material_mov_entrega_uk
  on public.material_movimientos (entrega_id, tipo_movimiento)
  where entrega_id is not null and revierte_a is null;

-- `talla` puede ser NULL (un gorro no tiene talla) y NULL nunca agrupa con NULL:
-- se normaliza a cadena vacía para que todos los gorros caigan en la misma línea.
create index if not exists material_mov_saldo_idx
  on public.material_movimientos (empresa_id, tipo_id, coalesce(talla, ''));
create index if not exists material_mov_fecha_idx
  on public.material_movimientos (empresa_id, fecha desc, created_at desc);

alter table public.material_movimientos enable row level security;

-- Lectura multi-tenant con el helper canónico. NO hay policy de escritura:
-- el libro solo se escribe desde las server actions, por la puerta única.
drop policy if exists material_mov_select on public.material_movimientos;
create policy material_mov_select on public.material_movimientos for select
  to authenticated
  using (empresa_id in (select public.empresas_del_usuario()));

-- ------------------------------------------------------------
-- 2) Los tres saldos, derivados del libro
-- ------------------------------------------------------------
create or replace view public.material_saldos as
select
  empresa_id,
  tipo_id,
  coalesce(talla, '') as talla_clave,
  max(tipo_nombre)    as tipo_nombre,
  max(categoria)      as categoria,
  max(talla)          as talla,
  sum(delta_almacen)::int                      as en_almacen,
  sum(delta_manos)::int                        as en_manos,
  (sum(delta_almacen) + sum(delta_manos))::int as total_empresa
from public.material_movimientos
group by empresa_id, tipo_id, coalesce(talla, '');

comment on view public.material_saldos is
  'Los tres números por tipo y talla: en almacén, en manos de la gente y total de la empresa. Se calculan del libro, nunca se guardan.';

-- ------------------------------------------------------------
-- 3) Recuento físico
-- ------------------------------------------------------------
-- Contar lo que hay en la estantería y enfrentarlo a lo que dice el sistema.
-- El teórico se CONGELA al abrir el recuento: si no, entre que se empieza a
-- contar y se termina puede entrar una entrega y el descuadre saldría falso.
create table if not exists public.material_recuentos (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id) on delete cascade,
  fecha date not null default current_date,
  nombre text,
  estado text not null default 'abierto' check (estado in ('abierto', 'confirmado', 'anulado')),
  nota text,
  confirmado_en timestamptz,
  confirmado_por uuid references auth.users(id) on delete set null,
  confirmado_por_nombre text,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null
);

create index if not exists material_recuentos_empresa_idx
  on public.material_recuentos (empresa_id, fecha desc);

create table if not exists public.material_recuentos_lineas (
  id uuid primary key default gen_random_uuid(),
  recuento_id uuid not null references public.material_recuentos(id) on delete cascade,
  tipo_id uuid references public.entregas_tipos_material(id) on delete set null,
  tipo_nombre text not null,
  talla text,
  teorico_almacen integer not null,  -- congelado al abrir
  contado_almacen integer,           -- NULL = todavía sin contar
  diferencia integer generated always as (coalesce(contado_almacen, 0) - teorico_almacen) stored,
  nota text
);

create index if not exists material_recuentos_lineas_idx
  on public.material_recuentos_lineas (recuento_id);
create unique index if not exists material_recuentos_lineas_uk
  on public.material_recuentos_lineas (recuento_id, tipo_id, coalesce(talla, ''));

comment on column public.material_recuentos_lineas.teorico_almacen is
  'Lo que decía el sistema al ABRIR el recuento. Congelado: si entrara una entrega mientras se cuenta, el descuadre saldría falso.';

-- Ahora que la tabla existe, se cierra la FK que quedó pendiente en el libro.
do $$
begin
  if not exists (
    select 1 from information_schema.table_constraints
    where constraint_schema = 'public' and constraint_name = 'material_movimientos_recuento_id_fkey'
  ) then
    alter table public.material_movimientos
      add constraint material_movimientos_recuento_id_fkey
      foreign key (recuento_id) references public.material_recuentos(id) on delete set null;
  end if;
end $$;

alter table public.material_recuentos enable row level security;
alter table public.material_recuentos_lineas enable row level security;

drop policy if exists material_recuentos_select on public.material_recuentos;
create policy material_recuentos_select on public.material_recuentos for select
  to authenticated
  using (empresa_id in (select public.empresas_del_usuario()));

drop policy if exists material_recuentos_lineas_select on public.material_recuentos_lineas;
create policy material_recuentos_lineas_select on public.material_recuentos_lineas for select
  to authenticated
  using (
    recuento_id in (
      select id from public.material_recuentos
      where empresa_id in (select public.empresas_del_usuario())
    )
  );

-- ------------------------------------------------------------
-- 4) Nuevo desenlace de una entrega: se fue y no la devolvió
-- ------------------------------------------------------------
-- Es el único desenlace SIN firma: el trabajador ya no está, no hay a quién
-- pedirle que firme nada. Por eso exige motivo escrito. La pieza sale de su
-- ficha y se resta del total de la empresa: es una pérdida, no una devolución.
alter table public.entregas_material
  drop constraint if exists entregas_material_devolucion_estado_check;
alter table public.entregas_material
  add constraint entregas_material_devolucion_estado_check
  check (devolucion_estado in (
    'no_procede',
    'pendiente_firma',
    'devuelta',
    'rechazada',
    'merma_pendiente_firma',
    'merma',
    'no_devuelta'
  ));

alter table public.entregas_material
  add column if not exists no_devuelta_motivo text,
  add column if not exists no_devuelta_en timestamptz;

comment on column public.entregas_material.no_devuelta_motivo is
  'Por qué no volvió la pieza. Obligatorio: es la única baja que nadie firma.';

-- ------------------------------------------------------------
-- 5) El catálogo de tipos, igual en TODAS las empresas
-- ------------------------------------------------------------
-- Había empresas sin ningún tipo sembrado. Todas parten igual.
-- Camisa se desdobla en manga corta y manga larga: son prendas distintas, se
-- piden y se devuelven por separado (decisión de Iván, 08-09-2026). No hay
-- campo de color: si hay que distinguir un color, se crea otro tipo.
insert into public.entregas_tipos_material
  (empresa_id, nombre, categoria, requiere_talla, requiere_devolucion, orden)
select e.id, c.nombre, c.categoria, c.requiere_talla, true, c.orden
from public.empresas e
cross join (values
  -- Uniforme
  ('Camiseta',                'uniforme', true,   1),
  ('Camisa manga corta',      'uniforme', true,   2),
  ('Camisa manga larga',      'uniforme', true,   3),
  ('Pantalón',                'uniforme', true,   4),
  ('Chaquetilla de cocina',   'uniforme', true,   5),
  ('Americana',               'uniforme', true,   6),
  ('Delantal',                'uniforme', false,  7),
  ('Mandil',                  'uniforme', false,  8),
  ('Gorro',                   'uniforme', false,  9),
  ('Calzado antideslizante',  'uniforme', true,  10),
  -- Material
  ('Calzado de seguridad',    'material', true,  20),
  ('Guantes',                 'material', true,  21),
  ('Llaves del local',        'material', false, 22),
  ('Taquilla',                'material', false, 23),
  ('Tarjeta de acceso',       'material', false, 24),
  ('Teléfono móvil',          'material', false, 25),
  ('Ordenador',               'material', false, 26),
  ('Otros',                   'material', false, 99)
) as c(nombre, categoria, requiere_talla, orden)
where not exists (
  select 1 from public.entregas_tipos_material x
  where x.empresa_id = e.id and lower(x.nombre) = lower(c.nombre)
);

-- "Camisa" a secas queda sustituida por las dos variantes de manga. Se DESACTIVA
-- en vez de borrarse: si alguna empresa ya la hubiera usado, su histórico sigue
-- en pie. Solo se toca la que nadie ha usado todavía.
update public.entregas_tipos_material t
set activo = false, updated_at = now()
where lower(t.nombre) = 'camisa'
  and t.activo = true
  and not exists (
    select 1 from public.entregas_material_items i where i.tipo_id = t.id
  );
