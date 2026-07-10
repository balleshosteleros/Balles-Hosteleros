-- Histórico de DOCUMENTOS de nóminas subidos (por la gestoría o a mano).
--
-- Registra cada archivo que se sube: quién/cómo, el mes solicitado, y el
-- resultado del volcado (leídas, guardadas, ya existían, sin empleado, mes
-- incorrecto). Da trazabilidad para auditar qué nóminas se han recibido cada mes.
--
-- Idempotente.

create table if not exists public.nominas_gestoria_subidas (
  id             uuid primary key default gen_random_uuid(),
  empresa_id     uuid not null references public.empresas(id) on delete cascade,
  periodo        text not null check (periodo ~ '^\d{4}-(0[1-9]|1[0-2])$'),
  origen         text not null default 'gestoria' check (origen in ('gestoria', 'manual')),
  archivo_nombre text,
  archivo_bytes  bigint,
  leidas         integer not null default 0,   -- nº de nóminas que leyó la IA
  guardadas      integer not null default 0,   -- volcadas al registro de pagos
  ya_existian    integer not null default 0,   -- ya cargadas antes (duplicadas)
  sin_empleado   integer not null default 0,   -- no cuadraron con ningún empleado
  mes_incorrecto integer not null default 0,   -- rechazadas por ser de otro mes
  detalle        jsonb,                         -- etiquetas de sin_empleado / mes_incorrecto
  creado_por     uuid,                          -- usuario si subida manual; NULL si la gestoría (sin sesión)
  created_at     timestamptz not null default now()
);

comment on table public.nominas_gestoria_subidas is
  'Histórico de archivos de nóminas subidos (gestoría o manual) con el resultado del volcado. Auditoría por empresa y mes.';

create index if not exists idx_nominas_subidas_empresa_periodo
  on public.nominas_gestoria_subidas (empresa_id, periodo, created_at desc);

-- RLS: lectura para usuarios de la empresa. La escritura va por service-role
-- (enlace público de la gestoría sin sesión + subida manual con admin client).
alter table public.nominas_gestoria_subidas enable row level security;

drop policy if exists nominas_gestoria_subidas_sel on public.nominas_gestoria_subidas;
create policy nominas_gestoria_subidas_sel on public.nominas_gestoria_subidas
  for select using (empresa_id in (select empresas_del_usuario()));
