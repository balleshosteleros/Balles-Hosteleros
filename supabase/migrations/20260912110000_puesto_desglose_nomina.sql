-- Desglose completo de la nomina en la ficha del puesto: del bruto al neto y
-- del bruto al coste de empresa, con las cantidades y no solo los porcentajes.
--
--   bruto - SS trabajador (6,50%) - IRPF  = neto
--   bruto + SS empresa (32,15%)           = coste total
--
-- El IRPF se guarda como PORCENTAJE editable por puesto porque no hay una regla
-- unica: es 0 mientras la retribucion anual no pasa el umbral de retencion, y a
-- partir de ahi el minimo del 2% salvo que la situacion personal lo suba. Los
-- otros dos tipos son fijos y salen exactos en las nominas de las sociedades.
--
-- Idempotente: `if not exists` y relleno solo donde falta o no cuadra.

alter table puesto_salarios add column if not exists irpf_pct numeric;
alter table puesto_salarios add column if not exists ss_trabajador numeric;
alter table puesto_salarios add column if not exists irpf_importe numeric;

comment on column puesto_salarios.irpf_pct is
  'Retencion de IRPF aplicada a este puesto, en tanto por ciento (2 = 2%). La real de cada persona depende de su modelo 145.';
comment on column puesto_salarios.ss_trabajador is
  'Cotizacion a cargo del TRABAJADOR: 6,50% del bruto (4,70 contingencias + 1,55 desempleo + 0,10 FP + 0,15 MEI).';
comment on column puesto_salarios.irpf_importe is
  'Euros de IRPF que se le retienen al mes.';

-- Tipo de IRPF: 0 mientras no se pasa del umbral de retencion; 2% a partir de ahi.
update puesto_salarios
set irpf_pct = case when salario_bruto * 12 >= 15900 then 2 else 0 end
where coalesce(salario_bruto, 0) > 0 and irpf_pct is null;

-- Cantidades, con el tipo ya fijado.
update puesto_salarios
set ss_trabajador = round((salario_bruto * 0.065)::numeric, 2),
    irpf_importe  = round((salario_bruto * coalesce(irpf_pct, 0) / 100)::numeric, 2),
    updated_at = now()
where coalesce(salario_bruto, 0) > 0;
