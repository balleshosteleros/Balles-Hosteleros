-- ============================================================
-- rrhh_patrones: tipo de jornada Fijo / Flexible
-- ------------------------------------------------------------
-- Decisión "patrón de un solo tipo": un patrón es ENTERO fijo o
-- ENTERO flexible. Todas sus celdas referencian turnos del mismo
-- tipo_jornada; el editor filtra los turnos por este valor y las
-- actions lo validan en servidor.
--
-- Esto evita el choque conceptual de mezclar en el mismo patrón
-- turnos fijos (tramos por día) con flexibles (horas objetivo),
-- que viven a distinta "altura" y reclamarían el mismo día dos
-- veces.
--
-- Es ortogonal a `tipo` (semanal / libre), que define la ESTRUCTURA
-- del patrón, no el tipo de jornada de sus turnos.
--
-- Cambio ADITIVO y retrocompatible: los patrones existentes quedan
-- como 'fijo' (su modelo actual basado en tramos). Default en BD.
-- No toca RLS (columna con default).
-- ============================================================

alter table public.rrhh_patrones
  add column if not exists tipo_jornada text not null default 'fijo'
    check (tipo_jornada in ('fijo', 'flexible'));

comment on column public.rrhh_patrones.tipo_jornada is
  'Tipo de jornada del patrón: fijo (turnos por tramos) o flexible (turnos por horas objetivo). Todas las celdas usan turnos de este tipo.';
