-- ============================================================
-- 20260729140000_cierres_tipo_movimiento.sql
-- CIERRES (Gerencia): distingue el tipo de movimiento registrado.
--   'cierre'   → cierre semanal (comportamiento actual, default)
--   'retirada' → retirada de efectivo del cajón
--   'ingreso'  → ingreso de efectivo en el cajón
-- Idempotente. Los registros ya existentes quedan como 'cierre'.
-- ============================================================

alter table public.cierres_semanales
  add column if not exists tipo text not null default 'cierre';

-- Constraint de valores permitidos (recreada de forma idempotente).
alter table public.cierres_semanales
  drop constraint if exists cierres_semanales_tipo_chk;

alter table public.cierres_semanales
  add constraint cierres_semanales_tipo_chk
  check (tipo in ('cierre', 'retirada', 'ingreso'));

-- Índice para filtrar/listar por tipo dentro de cada empresa.
create index if not exists idx_cierres_empresa_tipo_fecha
  on public.cierres_semanales(empresa_id, tipo, fecha desc);
