-- VARIOS TC1 por mes (antes solo cabía uno).
--
-- La Seguridad Social emite una liquidación por TIPO: la ORDINARIA (L00) del mes
-- corriente y las COMPLEMENTARIAS (L03/L13) para lo que no cabe en ella —el caso
-- típico son las vacaciones no disfrutadas que se abonan al finiquitar, que por
-- ley cotizan aparte. Cada liquidación es un recibo y un CARGO distinto: la
-- empresa hace dos ingresos, no uno, y no existe forma de que la gestoría los
-- funda en un único documento.
--
-- Por eso el TC1 deja de ser un campo del mes y pasa a ser una LISTA. El total de
-- seguros sociales del mes es la SUMA de los líquidos de todos sus TC1, y contra
-- esa suma se cuadra la SS (trabajador + empresa) de las nóminas.
--
-- Los TC1 se imputan al mes en que SE INGRESAN, aunque un complementario de
-- vacaciones corresponda a días de meses anteriores.
--
-- Las columnas `tc1_*` de `rrhh_nominas_mes` se conservan tal cual: ya no las lee
-- nadie, pero guardan el histórico previo a esta migración y se borrarán en una
-- limpieza posterior, una vez comprobado que la lista funciona.
--
-- Idempotente: re-ejecutable sin error.

create table if not exists public.rrhh_nominas_tc1 (
  id             uuid primary key default gen_random_uuid(),
  empresa_id     uuid not null references public.empresas(id) on delete cascade,
  periodo        text not null check (periodo ~ '^\d{4}-(0[1-9]|1[0-2])$'),
  path           text not null,
  nombre         text,
  importe        numeric(12,2),
  trabajadores   integer,
  -- Periodo de liquidación que declara el propio documento (AAAA-MM). Puede NO
  -- coincidir con `periodo` en los complementarios de vacaciones: se guarda para
  -- poder avisar, no para cambiar a qué mes suma.
  periodo_documento text,
  subido_en      timestamptz not null default now(),
  subido_por     uuid references auth.users(id)
);

comment on table public.rrhh_nominas_tc1 is
  'TC1/RLC (recibos de cotizaciones) de un mes. Puede haber VARIOS: la liquidación ordinaria y las complementarias (vacaciones). El total de seguros sociales del mes es la SUMA de sus importes.';
comment on column public.rrhh_nominas_tc1.importe is
  'Líquido de totales del recibo: lo que la empresa ingresa a la Seguridad Social por ESTA liquidación.';
comment on column public.rrhh_nominas_tc1.periodo_documento is
  'Periodo que declara el documento. En un complementario de vacaciones puede ser anterior a `periodo`; solo sirve para avisar.';

create index if not exists rrhh_nominas_tc1_empresa_periodo_idx
  on public.rrhh_nominas_tc1 (empresa_id, periodo);

-- Un mismo documento no se cuenta dos veces si se re-adjunta.
create unique index if not exists rrhh_nominas_tc1_path_uidx
  on public.rrhh_nominas_tc1 (empresa_id, path);

alter table public.rrhh_nominas_tc1 enable row level security;

drop policy if exists "rrhh_nominas_tc1_read" on public.rrhh_nominas_tc1;
create policy "rrhh_nominas_tc1_read" on public.rrhh_nominas_tc1
  for select to authenticated
  using (public.user_has_empresa_access(empresa_id));

-- Igual que el resto del mes de nóminas: solo quien gestiona pagos.
drop policy if exists "rrhh_nominas_tc1_write" on public.rrhh_nominas_tc1;
create policy "rrhh_nominas_tc1_write" on public.rrhh_nominas_tc1
  for all to authenticated
  using (public.user_has_empresa_access(empresa_id) and public.puede_gestionar_pagos())
  with check (public.user_has_empresa_access(empresa_id) and public.puede_gestionar_pagos());

-- Traer los TC1 que ya había (uno por mes) a la lista. `on conflict do nothing`
-- por el índice único de path: re-ejecutar no duplica.
insert into public.rrhh_nominas_tc1
  (empresa_id, periodo, path, nombre, importe, trabajadores, subido_en, subido_por)
select
  m.empresa_id, m.periodo, m.tc1_path, m.tc1_nombre, m.tc1_importe,
  m.tc1_trabajadores, coalesce(m.tc1_subido_en, now()), m.tc1_subido_por
from public.rrhh_nominas_mes m
where m.tc1_path is not null
on conflict (empresa_id, path) do nothing;
