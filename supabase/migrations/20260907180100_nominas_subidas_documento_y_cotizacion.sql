-- Los SEGUROS SOCIALES también dejan rastro en el histórico de subidas.
--
-- `nominas_gestoria_subidas` guardaba SOLO las nóminas: qué archivo entró, qué
-- leyó la IA, cuántas se guardaron y cuántas se rechazaron por ser de otro mes.
-- El recibo de cotizaciones se subía sin registrar nada, así que en la auditoría
-- del mes faltaba la mitad de la entrega: se veía llegar las nóminas, pero no el
-- recibo que las acompañaba.
--
-- Con esto el histórico de Pagos enseña la entrega completa en una sola línea de
-- tiempo, y por eso se distingue QUÉ se subió y, en el recibo, QUÉ MES cotiza
-- (que no es el de la entrega: la Seguridad Social va a mes vencido).
--
-- `creado_por` ya existía desde el principio pero no se leía en ninguna pantalla.
-- No hace falta tocarla: a partir de ahora el histórico la muestra.
--
-- Idempotente: re-ejecutable sin error.

alter table public.nominas_gestoria_subidas
  add column if not exists documento          text not null default 'nominas',
  add column if not exists periodo_cotizacion text,
  add column if not exists importe            numeric(12,2);

comment on column public.nominas_gestoria_subidas.documento is
  'Qué se subió: las nóminas del mes o el recibo de seguros sociales que las acompaña.';
comment on column public.nominas_gestoria_subidas.periodo_cotizacion is
  'Solo en seguros sociales: mes que cotiza el recibo (AAAA-MM). Normalmente el ANTERIOR al de la entrega.';
comment on column public.nominas_gestoria_subidas.importe is
  'Solo en seguros sociales: líquido que leyó la IA del recibo. NULL si no se pudo leer.';

alter table public.nominas_gestoria_subidas
  drop constraint if exists nominas_gestoria_subidas_documento_chk;
alter table public.nominas_gestoria_subidas
  add constraint nominas_gestoria_subidas_documento_chk
  check (documento in ('nominas', 'seguros_sociales'));

alter table public.nominas_gestoria_subidas
  drop constraint if exists nominas_gestoria_subidas_periodo_cotizacion_chk;
alter table public.nominas_gestoria_subidas
  add constraint nominas_gestoria_subidas_periodo_cotizacion_chk
  check (periodo_cotizacion is null or periodo_cotizacion ~ '^\d{4}-(0[1-9]|1[0-2])$');

-- El histórico se pide por empresa y mes, más reciente primero: el índice que ya
-- existe (empresa_id, periodo, created_at desc) sigue sirviendo tal cual.
--
-- Nada que rellenar: todo lo registrado hasta hoy son nóminas, que es el valor
-- por defecto de la columna.
