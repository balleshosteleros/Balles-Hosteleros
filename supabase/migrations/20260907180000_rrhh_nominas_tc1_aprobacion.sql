-- Aprobación de los SEGUROS SOCIALES (recibo de cotizaciones) de un mes.
--
-- Hasta ahora el recibo se subía y se cuadraba contra las nóminas del mes que
-- cotiza, pero el visto bueno no quedaba en ninguna parte: la pantalla decía si
-- cuadraba o no, y ahí se acababa. Las nóminas SÍ tenían su cierre
-- (`rrhh_nominas_mes.confirmado_en`); los seguros sociales, no.
--
-- Son dos aprobaciones INDEPENDIENTES y de meses distintos: con la entrega de
-- julio se aprueban las nóminas de julio y el recibo de JUNIO, porque la
-- Seguridad Social se liquida a mes vencido. Por eso el estado va en el propio
-- recibo y no en el mes de la entrega.
--
-- Si hay varios recibos del mismo mes cotizado (la liquidación ordinaria y la
-- complementaria de vacaciones), se aprueban JUNTOS: son el mismo dinero
-- repartido en dos papeles, y su suma es lo que cuadra contra las nóminas.
--
-- Idempotente: re-ejecutable sin error.

alter table public.rrhh_nominas_tc1
  add column if not exists aprobado_en    timestamptz,
  add column if not exists aprobado_por   uuid references auth.users(id) on delete set null,
  add column if not exists rechazado_en   timestamptz,
  add column if not exists rechazo_motivo text;

comment on column public.rrhh_nominas_tc1.aprobado_en is
  'Cuándo se dio el visto bueno a este recibo. NULL = pendiente de aprobar.';
comment on column public.rrhh_nominas_tc1.aprobado_por is
  'Quién lo aprobó. Se conserva la fecha aunque el usuario se borre (set null).';
comment on column public.rrhh_nominas_tc1.rechazado_en is
  'Cuándo se devolvió a la gestoría. Excluyente con `aprobado_en`.';
comment on column public.rrhh_nominas_tc1.rechazo_motivo is
  'Qué se le comunicó a la gestoría al devolverlo. Obligatorio al rechazar.';

-- Aprobado y rechazado son estados EXCLUYENTES: un recibo no puede estar las dos
-- cosas a la vez. Y un rechazo sin motivo no sirve de nada a la gestoría, así que
-- el motivo se exige aquí, no solo en la pantalla.
alter table public.rrhh_nominas_tc1
  drop constraint if exists rrhh_nominas_tc1_aprobacion_chk;
alter table public.rrhh_nominas_tc1
  add constraint rrhh_nominas_tc1_aprobacion_chk check (
    (aprobado_en is null or rechazado_en is null)
    and (rechazado_en is null or coalesce(btrim(rechazo_motivo), '') <> '')
  );

-- Los recibos pendientes de aprobar, que es lo que la pantalla busca al abrirse.
create index if not exists rrhh_nominas_tc1_pendientes_idx
  on public.rrhh_nominas_tc1 (empresa_id, periodo_cotizacion)
  where aprobado_en is null and rechazado_en is null;
