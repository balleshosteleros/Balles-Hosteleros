-- Nombres limpios para los catálogos de medida/formato:
--   unidades_medida -> medidas
--   formatos_medida -> formatos
-- (FKs, políticas RLS y triggers sobreviven al rename.)
alter table if exists public.unidades_medida rename to medidas;
alter table if exists public.formatos_medida  rename to formatos;
