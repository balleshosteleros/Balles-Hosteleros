-- ============================================================
-- 20260814160000_modelos_config_tipos_ocultos.sql
-- Modelos que NO aplican a una empresa y ni siquiera deben verse en Ajustes.
--
-- Diferencia con tipos_activos:
--   · tipos_activos  → el modelo EXISTE para la empresa pero está apagado;
--                      sigue apareciendo en Ajustes para poder encenderlo.
--   · tipos_ocultos  → el modelo NO aplica a esta empresa (p. ej. el 130, que es
--                      de autónomos en estimación directa y no de sociedades):
--                      desaparece también del diálogo de Ajustes.
--
-- Es POR EMPRESA: otras empresas del software que sí presenten el 130 lo siguen
-- viendo con normalidad. NULL / {} = no se oculta nada.
-- Idempotente.
-- ============================================================

alter table public.modelos_config
  add column if not exists tipos_ocultos text[];

comment on column public.modelos_config.tipos_ocultos is
  'Tipos de modelo que no aplican a la empresa: se ocultan incluso en Ajustes. NULL/{} = ninguno.';

-- BACANAL y HABANA son sociedades: el 130 (pago fraccionado IRPF de autónomos
-- en estimación directa) no les aplica. Se oculta solo para ellas.
update public.modelos_config c
set tipos_ocultos = array(
      select distinct x from unnest(coalesce(c.tipos_ocultos, '{}') || array['130']) as x
    ),
    updated_at = now()
from public.empresas e
where e.id = c.empresa_id
  and upper(e.nombre) in ('BACANAL', 'HABANA');
