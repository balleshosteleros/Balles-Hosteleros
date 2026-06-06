-- ─────────────────────────────────────────────────────────────
-- Elimina por completo la feature "cuadrante de turnos".
--
-- El campo nunca se llegó a usar aguas abajo (no entraba en
-- calendario, planificación, nóminas ni métricas): solo se
-- escribía y se volvía a mostrar en el propio selector del editor
-- de turno, ya retirado de la UI. Se borra el andamiaje entero.
--
--   - rrhh_turnos.cuadrante_id  (+ índice)
--   - tabla rrhh_cuadrantes     (+ políticas RLS, vía cascade)
-- ─────────────────────────────────────────────────────────────

drop index if exists public.idx_rrhh_turnos_cuadrante;

alter table public.rrhh_turnos
  drop column if exists cuadrante_id;

drop table if exists public.rrhh_cuadrantes cascade;
