-- Mes al que corresponden los SEGUROS SOCIALES de un TC1, elegido por quien lo sube.
--
-- La Seguridad Social se liquida a MES VENCIDO: en la entrega de agosto la
-- gestoría adjunta las nóminas de agosto y, junto a ellas, el TC1 de JULIO.
-- Es lo normal y siempre lo hacen así, no es un error.
--
-- Hasta ahora el mes del recibo solo se INTUÍA: `periodo_documento` lo leía la IA
-- del propio papel y servía únicamente para avisar. Ahora se PREGUNTA al subirlo:
--
--   `periodo`             → mes de la ENTREGA (a qué mes de nóminas acompaña).
--                           No cambia: es lo que agrupa la entrega, cuadra el
--                           total y cierra el enlace de la gestoría.
--   `periodo_cotizacion`  → mes que se está cotizando, el que elige quien sube.
--                           Por defecto, el anterior al de la entrega.
--   `periodo_documento`   → lo que declara el papel según la IA. Sigue siendo solo
--                           una comprobación contra lo elegido.
--
-- Se rellena el histórico con el mes anterior al de la entrega, que es la regla
-- que la gestoría ha seguido siempre.
--
-- Idempotente: re-ejecutable sin error.

alter table public.rrhh_nominas_tc1
  add column if not exists periodo_cotizacion text;

alter table public.rrhh_nominas_tc1
  drop constraint if exists rrhh_nominas_tc1_periodo_cotizacion_chk;
alter table public.rrhh_nominas_tc1
  add constraint rrhh_nominas_tc1_periodo_cotizacion_chk
  check (periodo_cotizacion is null or periodo_cotizacion ~ '^\d{4}-(0[1-9]|1[0-2])$');

comment on column public.rrhh_nominas_tc1.periodo_cotizacion is
  'Mes cotizado que declara quien sube el recibo (AAAA-MM). Normalmente el ANTERIOR a `periodo`, porque la Seguridad Social se liquida a mes vencido. No cambia a qué mes suma el importe: eso lo sigue mandando `periodo`.';

-- Histórico: mes anterior al de la entrega (la regla de siempre).
update public.rrhh_nominas_tc1
set periodo_cotizacion = to_char(
      (to_date(periodo || '-01', 'YYYY-MM-DD') - interval '1 month'),
      'YYYY-MM'
    )
where periodo_cotizacion is null;
