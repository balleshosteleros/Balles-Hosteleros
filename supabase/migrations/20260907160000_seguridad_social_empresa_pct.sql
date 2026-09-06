-- Seguridad Social a cargo de la EMPRESA, en % sobre el bruto.
--
-- El bruto es lo que cobra el trabajador; la empresa paga ADEMÁS su cotización.
-- Sin ella el coste de personal sale corto: en estas empresas son unos 31.500 €
-- al año que no aparecían en ningún ratio.
--
-- Vive en la configuración de RRHH (es un dato de personal) y por empresa, porque
-- cada una puede cotizar distinto según bonificaciones y tipo de contrato.
--
-- El 35 % por defecto NO sale de un manual: es lo que dan las 120 nóminas ya
-- cargadas (`rrhh_pagos.ss_empresa` / `rrhh_pagos.nomina`), donde el porcentaje se
-- mueve de forma muy estable entre el 34,4 % y el 36,6 % (media 35,8 %).
alter table public.empresa_rrhh_config
  add column if not exists seguridad_social_empresa_pct numeric(5,2) default 35;

comment on column public.empresa_rrhh_config.seguridad_social_empresa_pct is
  'Seguridad Social a cargo de la empresa, en % sobre el bruto. Se suma al coste por hora y al día de ausencia para obtener el coste REAL de empresa.';

alter table public.empresa_rrhh_config drop constraint if exists empresa_rrhh_config_ss_pct_valido;
alter table public.empresa_rrhh_config add constraint empresa_rrhh_config_ss_pct_valido
  check (seguridad_social_empresa_pct is null
         or (seguridad_social_empresa_pct >= 0 and seguridad_social_empresa_pct <= 100));
