-- ============================================================
-- 20260906220000_nominas_gestoria_dias_antelacion_mes.sql
--
-- Cuántos días ANTES de que acabe el mes aparece ese mes como elegible en el
-- enlace de subida de la gestoría.
--
-- POR QUÉ: la gestoría suele tener las nóminas listas antes de que el mes
-- cierre del todo, y obligarla a esperar al día 1 le concentra el trabajo. Con
-- esto puede ir adelantando los últimos días. El tope evita lo contrario: que
-- se puedan subir nóminas de un mes que ni ha empezado a cerrarse, que es
-- imposible que existan.
--
-- Acotado a 1..5 (configurable en Ajustes → Pagos):
--   · 1 = solo el último día del mes.
--   · 5 = septiembre (30 días) aparece ya el día 26.
-- Por defecto 5, el máximo.
--
-- Idempotente.
-- ============================================================

alter table public.empresas
  add column if not exists nominas_gestoria_dias_antelacion integer not null default 5;

do $$
begin
  alter table public.empresas
    add constraint empresas_nominas_gestoria_dias_antelacion_chk
    check (nominas_gestoria_dias_antelacion between 1 and 5);
exception when duplicate_object then null;
end $$;

comment on column public.empresas.nominas_gestoria_dias_antelacion is
  'Días antes de que acabe el mes en que ese mes ya aparece elegible en el '
  'enlace de subida de la gestoría (1-5). Con 5, septiembre (30 días) aparece '
  'el día 26.';
