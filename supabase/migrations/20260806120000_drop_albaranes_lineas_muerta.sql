-- ============================================================
-- 20260806120000_drop_albaranes_lineas_muerta.sql
-- PRP-073 Etapa D (TASK-243): retirar la tabla muerta `albaranes_lineas`.
--
-- Confirmado el 2026-08-06: CERO referencias en `src/` (las líneas viven en el
-- jsonb `albaranes.lineas` desde siempre) y CERO filas en prod. Era la deuda
-- que Iván dejó anotada ("existe en el esquema y nadie la usa").
-- APLICADA a prod el 2026-08-06 (verificado: la tabla ya no existe).
-- ============================================================

drop table if exists public.albaranes_lineas;
