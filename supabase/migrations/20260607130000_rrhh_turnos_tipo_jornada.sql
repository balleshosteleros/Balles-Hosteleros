-- ============================================================
-- rrhh_turnos: tipo de jornada Fijo / Flexible (estilo Sésamo)
-- ------------------------------------------------------------
-- Al crear un turno se elige primero el tipo de jornada:
--   - 'fijo'     → días + rango(s) horario(s) (tramos; partido = 2 tramos)
--   - 'flexible' → días + horas objetivo por día (flex_horas)
-- Cambio aditivo y retrocompatible: los turnos existentes quedan
-- como 'fijo' (su modelo actual basado en tramos), dias = '{}',
-- flex_horas = '{}'. No toca RLS (columnas con default).
-- ============================================================

alter table public.rrhh_turnos
  add column if not exists tipo_jornada text not null default 'fijo'
    check (tipo_jornada in ('fijo', 'flexible')),
  add column if not exists dias text[] not null default '{}'::text[],
  add column if not exists flex_horas jsonb not null default '{}'::jsonb;

comment on column public.rrhh_turnos.tipo_jornada is
  'Tipo de jornada: fijo (tramos horarios) o flexible (horas objetivo por día).';
comment on column public.rrhh_turnos.dias is
  'Días activos del turno: subconjunto de {L,M,X,J,V,S,D}.';
comment on column public.rrhh_turnos.flex_horas is
  'Jornada flexible: horas objetivo por día, ej {"L":8,"M":8}. Vacío en fijos.';
