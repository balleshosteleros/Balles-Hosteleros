-- ============================================================
-- 20260908140000_producto_pipeline.sql — Pipeline de Producto
--
-- El embudo comercial del propio software: quién ha pedido información, en qué
-- paso está y si acabó comprando. Hasta ahora vivía en Go High Level, en un
-- tablero llamado "EVERGREEN - MASTER" con cinco columnas. Esto es ese tablero,
-- dentro de casa.
--
-- Añade:
--   pipelines                 un embudo (EVERGREEN - MASTER, MASTER…)
--   pipeline_fases            las columnas del tablero, en orden
--   pipeline_oportunidades    la tarjeta: una persona en una columna
--
-- La persona de la tarjeta es la MISMA ficha que Producto → Clientes
-- (`clientes_sala`), como ya hace `citas.cliente_id`: no puede haber dos sitios
-- donde mirar a la misma persona.
--
-- Idempotente. No toca ninguna tabla existente.
-- ============================================================

-- ─── 1. El embudo ────────────────────────────────────────────
create table if not exists public.pipelines (
  id         uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id) on delete cascade,
  nombre     text not null,
  orden      integer not null default 0,
  activo     boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Un embudo no puede llamarse dos veces igual dentro de la misma empresa: el
-- selector de arriba del tablero se elige por nombre.
create unique index if not exists uq_pipelines_empresa_nombre
  on public.pipelines(empresa_id, lower(nombre));

create index if not exists idx_pipelines_empresa
  on public.pipelines(empresa_id, activo, orden);

-- ─── 2. Las columnas ─────────────────────────────────────────
-- `icono` guarda el emoji que ya traían las fases de GoHighLevel (📥, 📞, 📅,
-- ❓). Va aparte del nombre para que el nombre se pueda buscar y ordenar como
-- texto normal, y para poder cambiar el icono sin renombrar la fase.
create table if not exists public.pipeline_fases (
  id          uuid primary key default gen_random_uuid(),
  pipeline_id uuid not null references public.pipelines(id) on delete cascade,
  nombre      text not null,
  icono       text,
  color       text,
  orden       integer not null default 0,
  activa      boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create unique index if not exists uq_pipeline_fases_nombre
  on public.pipeline_fases(pipeline_id, lower(nombre));

create index if not exists idx_pipeline_fases_pipeline
  on public.pipeline_fases(pipeline_id, orden);

-- ─── 3. La tarjeta ───────────────────────────────────────────
-- La columna dice EN QUÉ PASO va; el estado dice CÓMO ACABÓ. Son cosas
-- distintas y en el tablero se ven a la vez: una tarjeta ganada se queda en la
-- columna donde se cerró, en verde. Por eso no se colapsan en un solo campo.
do $$ begin
  create type oportunidad_estado as enum ('ABIERTA', 'GANADA', 'PERDIDA', 'ABANDONADA');
exception when duplicate_object then null; end $$;

create table if not exists public.pipeline_oportunidades (
  id           uuid primary key default gen_random_uuid(),
  empresa_id   uuid not null references public.empresas(id) on delete cascade,
  pipeline_id  uuid not null references public.pipelines(id) on delete cascade,
  fase_id      uuid not null references public.pipeline_fases(id) on delete restrict,
  -- La ficha de la persona, en Producto → Clientes. A null si aún no se ha
  -- creado: la tarjeta guarda su propio nombre/teléfono/correo para no quedarse
  -- muda si un día se borra la ficha.
  cliente_id   uuid references public.clientes_sala(id) on delete set null,
  nombre       text not null,
  telefono     text,
  email        text,
  valor        numeric(12,2) not null default 0,
  -- Por dónde entró (campaña, anuncio, sorteo…). Texto libre a propósito: cada
  -- campaña nueva trae su etiqueta sin tocar código, igual que en Reservas.
  fuente       text,
  asignado_a   text,
  estado       oportunidad_estado not null default 'ABIERTA',
  -- Solo cuando se pierde o se abandona: por qué. Es lo que se lee luego para
  -- saber si el problema es el precio, el momento o el teléfono mal apuntado.
  motivo_cierre text,
  notas        text,
  etiquetas    text[] not null default '{}',
  -- Cuándo entró en la columna en la que está y cuándo se cerró: de ahí salen
  -- los "69 días" que se pintan en la tarjeta.
  fase_at      timestamptz not null default now(),
  estado_at    timestamptz not null default now(),
  cierre_previsto date,
  -- Identidad en el CRM del que vino, para que reimportar el mismo CSV
  -- actualice la tarjeta en vez de duplicarla.
  external_id  text,
  external_contacto_id text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create unique index if not exists uq_pipeline_oportunidades_external
  on public.pipeline_oportunidades(empresa_id, external_id)
  where external_id is not null;

create index if not exists idx_pipeline_oportunidades_tablero
  on public.pipeline_oportunidades(pipeline_id, fase_id);

create index if not exists idx_pipeline_oportunidades_empresa
  on public.pipeline_oportunidades(empresa_id, estado);

create index if not exists idx_pipeline_oportunidades_cliente
  on public.pipeline_oportunidades(cliente_id);

-- ─── 4. RLS: por empresa, como todo lo demás ─────────────────
alter table public.pipelines              enable row level security;
alter table public.pipeline_fases         enable row level security;
alter table public.pipeline_oportunidades enable row level security;

do $$ begin
  create policy "pipelines_todo" on public.pipelines
    for all to authenticated
    using (empresa_id in (select public.empresas_del_usuario()))
    with check (empresa_id in (select public.empresas_del_usuario()));
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "pipeline_oportunidades_todo" on public.pipeline_oportunidades
    for all to authenticated
    using (empresa_id in (select public.empresas_del_usuario()))
    with check (empresa_id in (select public.empresas_del_usuario()));
exception when duplicate_object then null; end $$;

-- Las fases cuelgan del embudo: heredan su empresa.
do $$ begin
  create policy "pipeline_fases_todo" on public.pipeline_fases
    for all to authenticated
    using (pipeline_id in (
      select p.id from public.pipelines p
      where p.empresa_id in (select public.empresas_del_usuario())))
    with check (pipeline_id in (
      select p.id from public.pipelines p
      where p.empresa_id in (select public.empresas_del_usuario())));
exception when duplicate_object then null; end $$;
