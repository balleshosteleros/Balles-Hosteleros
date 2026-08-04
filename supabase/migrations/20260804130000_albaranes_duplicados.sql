-- ============================================================
-- 20260804130000_albaranes_duplicados.sql
-- PRP-073 Fase 2 (TASK-206): identidad y prevención de duplicados.
--
-- · posible_duplicado_de + override auditado: cuando el guardado detecta un
--   candidato de negocio (mismo proveedor + número, o proveedor + fecha +
--   total), la persona debe abrir el existente o registrar la excepción con
--   motivo. Queda constancia de quién y cuándo.
-- · Unique parcial de pedido_id: un pedido solo puede recepcionarse una vez.
--   Pre-check ejecutado 2026-08-04: 0 pedidos con más de un albarán en prod.
-- · Índices de identidad de negocio para las consultas de detección.
--
-- (La huella exacta por archivo ya la garantiza el unique parcial de
-- albaran_importaciones(empresa_id, archivo_sha256) de la migración anterior.)
-- Idempotente.
-- ============================================================

-- 1. Columnas de duplicado/override en albaranes ────────────────────────────
alter table public.albaranes add column if not exists posible_duplicado_de uuid;
alter table public.albaranes add column if not exists duplicado_override_motivo text;
alter table public.albaranes add column if not exists duplicado_override_por uuid;
alter table public.albaranes add column if not exists duplicado_override_at timestamptz;

-- 2. Un solo albarán por pedido ─────────────────────────────────────────────
create unique index if not exists uq_albaranes_pedido
  on public.albaranes(pedido_id)
  where pedido_id is not null;

-- 3. Índices de identidad de negocio ────────────────────────────────────────
-- Detección por proveedor + número del proveedor (candidato fuerte).
create index if not exists idx_albaranes_prov_numero
  on public.albaranes(empresa_id, proveedor_id, numero_proveedor)
  where numero_proveedor is not null;

-- Fallback sin número fiable: proveedor (nombre snapshot) + fecha.
create index if not exists idx_albaranes_prov_fecha
  on public.albaranes(empresa_id, proveedor_nombre, fecha);
