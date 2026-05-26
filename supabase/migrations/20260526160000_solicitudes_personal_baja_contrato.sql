-- ============================================================
-- 20260526160000_solicitudes_personal_baja_contrato.sql
-- Amplía el CHECK de subtipo en solicitudes_personal para
-- aceptar 'baja_contrato' (familia ausencia).
--
-- Reglas de negocio (server action):
--   - fecha_inicio = día en que el empleado envía la solicitud
--     (primer día de preaviso).
--   - fecha_fin    = fecha solicitada de baja (último día efectivo).
--   - preaviso = fecha_fin - fecha_inicio, entre 15 y 45 días naturales.
-- ============================================================

alter table public.solicitudes_personal
  drop constraint if exists solicitudes_personal_subtipo_check;

alter table public.solicitudes_personal
  add constraint solicitudes_personal_subtipo_check
  check (subtipo in (
    'baja_medica','vacaciones','permiso','baja_contrato',
    'horas_extras','dia_trabajado'
  ));

comment on column public.solicitudes_personal.subtipo is
  'Subtipo de solicitud. Familia ausencia: baja_medica, vacaciones, permiso, baja_contrato. Familia trabajo: horas_extras, dia_trabajado.';
