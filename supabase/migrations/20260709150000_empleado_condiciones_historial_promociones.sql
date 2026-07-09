-- ─────────────────────────────────────────────────────────────────────────────
-- Promoción interna (empleado cambia de puesto) — Fase 1
--
-- 1) Versiona `empleado_condiciones`: deja de ser 1:1 (una fila por empleado) para
--    guardar el HISTÓRICO de condiciones. Cada cambio de puesto cierra la fila
--    vigente (vigente_hasta = fecha) e inserta una nueva (vigente_hasta = NULL).
--    Solo puede haber UNA fila vigente por empleado a la vez (índice único parcial).
--
-- 2) Crea `empleado_promociones`: registro de cada cambio de puesto de un empleado
--    ya dentro de la empresa (puesto origen → destino, condiciones, firma, gestoría).
--
-- Idempotente: se puede re-ejecutar sin efectos secundarios.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── 1. Versionado de empleado_condiciones ───────────────────────────────────
-- id propio (la PK pasa de empleado_id a id, para permitir varias filas/empleado).
alter table public.empleado_condiciones
  add column if not exists id uuid not null default gen_random_uuid();

alter table public.empleado_condiciones
  add column if not exists vigente_desde date;

alter table public.empleado_condiciones
  add column if not exists vigente_hasta date;   -- NULL = condiciones vigentes

alter table public.empleado_condiciones
  add column if not exists motivo text;          -- 'alta' | 'promocion'

-- Backfill: las filas existentes son las vigentes; su inicio es el primer_dia.
update public.empleado_condiciones
   set vigente_desde = coalesce(vigente_desde, primer_dia, created_at::date),
       motivo = coalesce(motivo, 'alta')
 where vigente_desde is null or motivo is null;

-- Migrar la PK de empleado_id → id (solo si aún es la vieja PK 1:1).
do $$
begin
  if exists (
    select 1 from information_schema.table_constraints
    where table_schema = 'public'
      and table_name = 'empleado_condiciones'
      and constraint_name = 'empleado_condiciones_pkey'
      and constraint_type = 'PRIMARY KEY'
  ) and not exists (
    select 1 from information_schema.constraint_column_usage
    where table_schema = 'public'
      and table_name = 'empleado_condiciones'
      and constraint_name = 'empleado_condiciones_pkey'
      and column_name = 'id'
  ) then
    alter table public.empleado_condiciones drop constraint empleado_condiciones_pkey;
    alter table public.empleado_condiciones add constraint empleado_condiciones_pkey primary key (id);
  end if;
end $$;

-- Solo UNA fila vigente por empleado (reemplaza la unicidad 1:1 anterior).
create unique index if not exists empleado_condiciones_vigente_uq
  on public.empleado_condiciones (empleado_id)
  where vigente_hasta is null;

-- Consulta habitual: histórico de un empleado ordenado por inicio.
create index if not exists empleado_condiciones_empleado_idx
  on public.empleado_condiciones (empleado_id, vigente_desde desc);

-- ── 2. Registro de promociones internas ─────────────────────────────────────
create table if not exists public.empleado_promociones (
  id                uuid primary key default gen_random_uuid(),
  empresa_id        uuid not null references public.empresas(id) on delete cascade,
  empleado_id       uuid not null references public.empleados(id) on delete cascade,
  puesto_origen_id  uuid references public.puestos(id) on delete set null,
  puesto_origen_nombre text,
  puesto_destino_id uuid references public.puestos(id) on delete set null,
  puesto_destino_nombre text,
  vacante_destino_id uuid references public.vacantes(id) on delete set null,
  primer_dia        date not null,
  tipo_contrato     text,
  -- Snapshot de las condiciones aplicadas al promocionar (auditoría).
  condiciones       jsonb not null default '{}'::jsonb,
  -- Firma del anexo (si se generó): id del documento de firma.
  firma_id          uuid references public.firmas_documentos(id) on delete set null,
  -- Aviso a gestoría.
  gestoria_email     text,
  gestoria_enviado_at timestamptz,
  creado_por        uuid references auth.users(id) on delete set null,
  creado_por_nombre text,
  created_at        timestamptz not null default now()
);

create index if not exists empleado_promociones_empleado_idx
  on public.empleado_promociones (empleado_id, created_at desc);
create index if not exists empleado_promociones_empresa_idx
  on public.empleado_promociones (empresa_id, created_at desc);

alter table public.empleado_promociones enable row level security;

-- RLS: acceso a promociones de empresas del usuario (mismo patrón que el resto).
drop policy if exists empleado_promociones_select on public.empleado_promociones;
create policy empleado_promociones_select on public.empleado_promociones
  for select using (empresa_id in (select public.empresas_del_usuario()));

-- Escritura solo desde el servidor (service role); no se abre a clientes.
