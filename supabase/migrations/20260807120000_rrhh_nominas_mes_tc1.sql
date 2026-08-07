-- TC1 / Recibo de Liquidación de Cotizaciones: documento de EMPRESA y mes.
--
-- No es una nómina: es el recibo de la Seguridad Social de TODA la empresa
-- (bases, cuotas y nº de trabajadores). Por eso NO va a `rrhh_pagos_nominas` ni a
-- la carpeta de ningún empleado, sino junto al estado del mes: un único documento
-- por empresa+periodo, que se consulta desde la cabecera de Pagos.
--
-- Idempotente: re-ejecutable sin error.

alter table public.rrhh_nominas_mes
  add column if not exists tc1_path text,
  add column if not exists tc1_nombre text,
  add column if not exists tc1_importe numeric(12,2),
  add column if not exists tc1_trabajadores integer,
  add column if not exists tc1_subido_en timestamptz,
  add column if not exists tc1_subido_por uuid references auth.users(id);

comment on column public.rrhh_nominas_mes.tc1_path is
  'Documento TC1 (recibo de cotizaciones) del mes, en el bucket rrhh-nominas bajo <empresa>/<periodo>/.';
comment on column public.rrhh_nominas_mes.tc1_importe is
  'Líquido total del TC1: lo que la empresa paga a la Seguridad Social ese mes.';
