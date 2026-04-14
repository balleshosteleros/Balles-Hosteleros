-- ============================================================
-- 032_juridico_documentos.sql
-- Módulo Jurídico: Documentos legales, partes interesadas,
--                  plazos y costes judiciales.
--
-- CONEXIONES CRUZADAS:
--   - documentos_juridicos → procesos_juridicos (Jurídico), documentos (Dirección)
--   - partes_juridicas → procesos_juridicos (Jurídico), proveedores (Logística),
--     empleados (RRHH), contactos_contabilidad (Contabilidad)
--   - costes_juridicos → procesos_juridicos (Jurídico), facturas (Contabilidad)
-- ============================================================

-- ─── 1. PARTES INTERESADAS ─────────────────────────────────
-- Actores de un proceso legal: abogados, demandantes, demandados, peritos…
-- Conecta con: procesos_juridicos, proveedores (si es una empresa proveedora),
--              empleados (si es un empleado implicado).

create table if not exists public.partes_juridicas (
  id              uuid primary key default gen_random_uuid(),
  empresa_id      uuid not null references public.empresas(id) on delete cascade,
  proceso_id      uuid not null references public.procesos_juridicos(id) on delete cascade,
  rol             text not null
                    check (rol in ('Demandante','Demandado','Abogado defensa','Abogado contrario',
                                   'Perito','Testigo','Juez','Mediador','Otro')),
  tipo_persona    text not null default 'Fisica'
                    check (tipo_persona in ('Fisica','Juridica')),
  nombre          text not null,
  cif_dni         text,
  telefono        text,
  email           text,
  bufete          text,           -- si es abogado: nombre del bufete
  colegio_num     text,           -- número de colegiado
  -- Vínculos con otras tablas (opcional)
  proveedor_id    uuid references public.proveedores(id) on delete set null,
  empleado_id     uuid references public.empleados(id) on delete set null,
  notas           text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists idx_partes_proceso
  on public.partes_juridicas(proceso_id);
create index if not exists idx_partes_empresa
  on public.partes_juridicas(empresa_id);

create or replace function public.set_partes_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end; $$;

drop trigger if exists partes_updated_at on public.partes_juridicas;
create trigger partes_updated_at
  before update on public.partes_juridicas
  for each row execute function public.set_partes_updated_at();

-- ─── 2. DOCUMENTOS JURÍDICOS ───────────────────────────────
-- Documentos asociados a procesos legales (demandas, sentencias, autos…).
-- Conecta con: procesos_juridicos, documentos (tabla general de Dirección).

create table if not exists public.documentos_juridicos (
  id              uuid primary key default gen_random_uuid(),
  empresa_id      uuid not null references public.empresas(id) on delete cascade,
  proceso_id      uuid not null references public.procesos_juridicos(id) on delete cascade,
  nombre          text not null,
  tipo            text not null default 'Otro'
                    check (tipo in ('Demanda','Contestacion','Auto','Sentencia','Recurso',
                                    'Acuerdo','Burofax','Requerimiento','Pericial','Otro')),
  fecha_documento date,
  fecha_recepcion date,
  plazo_respuesta date,          -- fecha límite para responder (si aplica)
  estado          text not null default 'Pendiente revisar'
                    check (estado in ('Pendiente revisar','Revisado','Respondido','Archivado')),
  url             text,          -- enlace a almacenamiento (Supabase Storage)
  confidencial    boolean not null default false,
  notas           text,
  subido_por      uuid references auth.users(id) on delete set null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists idx_docjur_proceso
  on public.documentos_juridicos(proceso_id);
create index if not exists idx_docjur_empresa
  on public.documentos_juridicos(empresa_id);
create index if not exists idx_docjur_plazo
  on public.documentos_juridicos(empresa_id, plazo_respuesta)
  where plazo_respuesta is not null;

create or replace function public.set_docjur_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end; $$;

drop trigger if exists docjur_updated_at on public.documentos_juridicos;
create trigger docjur_updated_at
  before update on public.documentos_juridicos
  for each row execute function public.set_docjur_updated_at();

-- ─── 3. PLAZOS JUDICIALES ──────────────────────────────────
-- Control de plazos y vistas judiciales.
-- Conecta con: procesos_juridicos, vencimientos (Gerencia — para alertas).

create table if not exists public.plazos_judiciales (
  id              uuid primary key default gen_random_uuid(),
  empresa_id      uuid not null references public.empresas(id) on delete cascade,
  proceso_id      uuid not null references public.procesos_juridicos(id) on delete cascade,
  nombre          text not null,
  tipo            text not null default 'Otro'
                    check (tipo in ('Vista oral','Junta conciliacion','Tramite','Sentencia',
                                    'Recurso','Notificacion','Pago','Otro')),
  fecha           date not null,
  hora            time,
  juzgado         text,
  sala            text,
  estado          text not null default 'Pendiente'
                    check (estado in ('Pendiente','Celebrado','Aplazado','Anulado')),
  resultado       text,          -- resumen del resultado si estado=Celebrado
  notas           text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists idx_plazos_proceso
  on public.plazos_judiciales(proceso_id);
create index if not exists idx_plazos_fecha
  on public.plazos_judiciales(empresa_id, fecha)
  where estado = 'Pendiente';

create or replace function public.set_plazos_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end; $$;

drop trigger if exists plazos_updated_at on public.plazos_judiciales;
create trigger plazos_updated_at
  before update on public.plazos_judiciales
  for each row execute function public.set_plazos_updated_at();

-- ─── 4. COSTES JUDICIALES ──────────────────────────────────
-- Gastos asociados al proceso (honorarios, tasas, peritajes).
-- Conecta con: procesos_juridicos (Jurídico), facturas (Contabilidad).

create table if not exists public.costes_judiciales (
  id              uuid primary key default gen_random_uuid(),
  empresa_id      uuid not null references public.empresas(id) on delete cascade,
  proceso_id      uuid not null references public.procesos_juridicos(id) on delete cascade,
  concepto        text not null,
  tipo            text not null default 'Honorarios'
                    check (tipo in ('Honorarios abogado','Honorarios perito','Tasa judicial',
                                    'Costas','Indemnizacion','Otro')),
  importe         numeric(12,2) not null,
  fecha           date not null default current_date,
  pagado          boolean not null default false,
  fecha_pago      date,
  factura_id      uuid references public.facturas(id) on delete set null,
  notas           text,
  created_at      timestamptz not null default now()
);

create index if not exists idx_costes_proceso
  on public.costes_judiciales(proceso_id);

-- Enriquecer procesos_juridicos con FK a partes y totales calculables
alter table public.procesos_juridicos
  add column if not exists abogado_id uuid references public.partes_juridicas(id) on delete set null,
  add column if not exists num_expediente text,
  add column if not exists juzgado text,
  add column if not exists coste_acumulado numeric(12,2) default 0;

comment on column public.procesos_juridicos.num_expediente is
  'Número de expediente judicial oficial';
comment on column public.procesos_juridicos.coste_acumulado is
  'Total acumulado de costes_judiciales — actualizado por trigger o manualmente';

-- ─── 5. RLS ────────────────────────────────────────────────

alter table public.partes_juridicas    enable row level security;
alter table public.documentos_juridicos enable row level security;
alter table public.plazos_judiciales   enable row level security;
alter table public.costes_judiciales   enable row level security;

-- Partes
create policy "partes_read" on public.partes_juridicas for select to authenticated
  using (empresa_id in (select p.empresa_id from profiles p where p.user_id = auth.uid()));
create policy "partes_manage" on public.partes_juridicas for all to authenticated
  using (empresa_id in (select p.empresa_id from profiles p where p.user_id = auth.uid()))
  with check (empresa_id in (select p.empresa_id from profiles p where p.user_id = auth.uid()));

-- Documentos jurídicos
create policy "docjur_read" on public.documentos_juridicos for select to authenticated
  using (empresa_id in (select p.empresa_id from profiles p where p.user_id = auth.uid()));
create policy "docjur_manage" on public.documentos_juridicos for all to authenticated
  using (empresa_id in (select p.empresa_id from profiles p where p.user_id = auth.uid()))
  with check (empresa_id in (select p.empresa_id from profiles p where p.user_id = auth.uid()));

-- Plazos
create policy "plazos_read" on public.plazos_judiciales for select to authenticated
  using (empresa_id in (select p.empresa_id from profiles p where p.user_id = auth.uid()));
create policy "plazos_manage" on public.plazos_judiciales for all to authenticated
  using (empresa_id in (select p.empresa_id from profiles p where p.user_id = auth.uid()))
  with check (empresa_id in (select p.empresa_id from profiles p where p.user_id = auth.uid()));

-- Costes
create policy "costes_jur_read" on public.costes_judiciales for select to authenticated
  using (empresa_id in (select p.empresa_id from profiles p where p.user_id = auth.uid()));
create policy "costes_jur_manage" on public.costes_judiciales for all to authenticated
  using (empresa_id in (select p.empresa_id from profiles p where p.user_id = auth.uid()))
  with check (empresa_id in (select p.empresa_id from profiles p where p.user_id = auth.uid()));

-- ─── 6. VISTA: procesos_juridicos_resumen ──────────────────
-- Vista para el panel de Jurídico.

create or replace view public.procesos_juridicos_resumen as
select
  pj.id,
  pj.empresa_id,
  pj.titulo,
  pj.tipo,
  pj.estado,
  pj.gravedad,
  pj.fecha_inicio,
  pj.importe_reclamado,
  pj.coste_acumulado,
  count(distinct dj.id) as num_documentos,
  count(distinct plj.id) filter (where plj.estado = 'Pendiente') as plazos_pendientes,
  min(plj.fecha) filter (where plj.estado = 'Pendiente') as proximo_plazo
from public.procesos_juridicos pj
left join public.documentos_juridicos dj on dj.proceso_id = pj.id
left join public.plazos_judiciales plj on plj.proceso_id = pj.id
group by pj.id;

comment on view public.procesos_juridicos_resumen is
  'Vista agregada de procesos jurídicos con conteo de documentos y próximo plazo';
