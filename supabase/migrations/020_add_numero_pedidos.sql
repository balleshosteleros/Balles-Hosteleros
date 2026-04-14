-- ============================================================
-- 020_add_numero_pedidos.sql
-- Añade columna numero a pedidos para el número de referencia
-- visible (PED-YYYY-XXX). La columna referencia fue eliminada
-- en la migración 019 y esta la reemplaza con nombre más claro.
-- ============================================================

alter table public.pedidos
  add column if not exists numero text;
