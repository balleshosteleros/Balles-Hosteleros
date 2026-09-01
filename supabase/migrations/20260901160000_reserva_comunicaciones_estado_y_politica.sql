-- Reservas · Comunicaciones reorganizadas en ESTADO y POLÍTICA
--
-- Antes las plantillas mezclaban tres cosas distintas bajo un mismo listado:
-- estados de la reserva (CONFIRMACION, CANCELACION), bloques de texto que no
-- eran correos (POLITICA_AVISO, CUPON_PAGADO, GARANTIA_AVISO) y envíos por
-- reloj (RECORDATORIO, SOLICITUD_VALORACION). Además faltaba correo para la
-- mitad de los estados reales y sobraba la idea de "walk-in" como estado.
--
-- Modelo nuevo, dos familias y solo dos:
--
--   ESTADO   → un correo por cada estado real de la reserva. Son los 9 estados
--              canónicos MENOS walk-in, que no es un estado sino un ORIGEN: el
--              cliente entró sin reservar y no hay a quién escribirle.
--
--   POLITICA → procesos que no son un cambio de estado: la compra de un Ticket,
--              la reserva hecha con ese Ticket, el aviso de la política de
--              cancelación y el de la de garantía. Con ellos van los dos envíos
--              por reloj (recordatorio y valoración), que tampoco responden a
--              ningún cambio de estado.
--
-- Renombrados (se conserva la personalización que cada empresa ya había escrito):
--   CONFIRMACION    → CONFIRMADA              (mismo momento, nombre del estado)
--   RECONFIRMACION  → RECONFIRMADA
--   CANCELACION     → CANCELADA
--   POLITICA_AVISO  → POLITICA_CANCELACION    (deja de ser bloque: correo propio)
--   GARANTIA_AVISO  → POLITICA_GARANTIA       (idem)
--
-- Se borra CUPON_PAGADO: su contenido lo cubre TICKET_COMPRA, que sí es un
-- correo real con su propio disparo. Mantener las dos era duplicar el mismo
-- mensaje ("hemos recibido tu pago") con dos configuraciones distintas.

-- 1. CHECK abierto temporalmente: hay que poder escribir los nombres nuevos
--    antes de que el CHECK definitivo los exija.
alter table public.reserva_email_plantillas
  drop constraint if exists reserva_email_plantillas_tipo_chk;

-- 2. Renombrar los tipos existentes conservando la personalización.
--
--    Si la empresa ya tuviera fila del nombre nuevo (por un despliegue a
--    medias), gana la nueva y la vieja se descarta: el UNIQUE(empresa_id,tipo)
--    no admite las dos.
delete from public.reserva_email_plantillas viejo
where viejo.tipo in ('CONFIRMACION','RECONFIRMACION','CANCELACION','POLITICA_AVISO','GARANTIA_AVISO')
  and exists (
    select 1 from public.reserva_email_plantillas nuevo
    where nuevo.empresa_id = viejo.empresa_id
      and nuevo.tipo = case viejo.tipo
        when 'CONFIRMACION'   then 'CONFIRMADA'
        when 'RECONFIRMACION' then 'RECONFIRMADA'
        when 'CANCELACION'    then 'CANCELADA'
        when 'POLITICA_AVISO' then 'POLITICA_CANCELACION'
        when 'GARANTIA_AVISO' then 'POLITICA_GARANTIA'
      end
  );

update public.reserva_email_plantillas
set tipo = case tipo
  when 'CONFIRMACION'   then 'CONFIRMADA'
  when 'RECONFIRMACION' then 'RECONFIRMADA'
  when 'CANCELACION'    then 'CANCELADA'
  when 'POLITICA_AVISO' then 'POLITICA_CANCELACION'
  when 'GARANTIA_AVISO' then 'POLITICA_GARANTIA'
  else tipo
end
where tipo in ('CONFIRMACION','RECONFIRMACION','CANCELACION','POLITICA_AVISO','GARANTIA_AVISO');

-- 3. CUPON_PAGADO desaparece: duplicaba TICKET_COMPRA.
delete from public.reserva_email_plantillas where tipo = 'CUPON_PAGADO';

-- 4. CHECK definitivo: 8 estados + 6 políticas. WALK_IN NO está y no debe estar.
alter table public.reserva_email_plantillas
  add constraint reserva_email_plantillas_tipo_chk check (
    tipo = any (array[
      -- Por estado de la reserva
      'CONFIRMADA','RECONFIRMADA','NO_RECONFIRMADA','LISTA_ESPERA',
      'LIBERADA','TERMINANDO','NO_SHOW','CANCELADA',
      -- Por política o proceso
      'TICKET_COMPRA','TICKET_RESERVA','POLITICA_CANCELACION','POLITICA_GARANTIA',
      'RECORDATORIO','SOLICITUD_VALORACION'
    ])
  );

comment on table public.reserva_email_plantillas is
  'Plantillas de correo de Reservas por empresa. Dos familias: ESTADO (un correo por estado real de la reserva, walk-in excluido por ser un origen) y POLITICA (ticket, política de cancelación, política de garantía, recordatorio y valoración).';

-- 5. El histórico de envíos guarda el tipo que se mandó: se renombra igual para
--    que los correos ya enviados sigan apareciendo con su nombre en la ficha.
--    Tiene su propio CHECK, así que también hay que abrirlo antes de tocar nada.
alter table public.reserva_email_envios
  drop constraint if exists reserva_email_envios_tipo_chk;

update public.reserva_email_envios
set tipo = case tipo
  when 'CONFIRMACION'   then 'CONFIRMADA'
  when 'RECONFIRMACION' then 'RECONFIRMADA'
  when 'CANCELACION'    then 'CANCELADA'
  when 'POLITICA_AVISO' then 'POLITICA_CANCELACION'
  when 'GARANTIA_AVISO' then 'POLITICA_GARANTIA'
  when 'CUPON_PAGADO'   then 'TICKET_COMPRA'
  else tipo
end
where tipo in ('CONFIRMACION','RECONFIRMACION','CANCELACION','POLITICA_AVISO','GARANTIA_AVISO','CUPON_PAGADO');

alter table public.reserva_email_envios
  add constraint reserva_email_envios_tipo_chk check (
    tipo = any (array[
      'CONFIRMADA','RECONFIRMADA','NO_RECONFIRMADA','LISTA_ESPERA',
      'LIBERADA','TERMINANDO','NO_SHOW','CANCELADA',
      'TICKET_COMPRA','TICKET_RESERVA','POLITICA_CANCELACION','POLITICA_GARANTIA',
      'RECORDATORIO','SOLICITUD_VALORACION'
    ])
  );

-- 6. Sellos de auditoría para los estados que antes no tenían correo. Dan la
--    idempotencia: sin ellos, cada guardado repetido reenviaría el mismo aviso.
alter table public.reservas
  add column if not exists email_no_reconfirmada_at timestamptz,
  add column if not exists email_lista_espera_at    timestamptz,
  add column if not exists email_liberada_at        timestamptz,
  add column if not exists email_terminando_at      timestamptz,
  add column if not exists email_no_show_at         timestamptz,
  add column if not exists email_politica_cancelacion_at timestamptz,
  add column if not exists email_politica_garantia_at    timestamptz;

comment on column public.reservas.email_no_show_at is
  'Timestamp del aviso al cliente de que su reserva se marcó como no presentada.';
comment on column public.reservas.email_politica_garantia_at is
  'Timestamp del correo con las condiciones de la política de garantía.';

-- 7. Alta de las plantillas que faltan en cada empresa. Mismo criterio que el
--    sync de seeds (aditivo): solo crea lo que no existe, nunca pisa lo que la
--    empresa haya escrito.
insert into public.reserva_email_plantillas (empresa_id, tipo, activa, asunto_personalizado, mensaje_personalizado)
select e.id, t.tipo, true, null, null
from public.empresas e
cross join (values
  ('CONFIRMADA'),('RECONFIRMADA'),('NO_RECONFIRMADA'),('LISTA_ESPERA'),
  ('LIBERADA'),('TERMINANDO'),('NO_SHOW'),('CANCELADA'),
  ('TICKET_COMPRA'),('TICKET_RESERVA'),('POLITICA_CANCELACION'),('POLITICA_GARANTIA'),
  ('RECORDATORIO'),('SOLICITUD_VALORACION')
) as t(tipo)
where not exists (
  select 1 from public.reserva_email_plantillas p
  where p.empresa_id = e.id and p.tipo = t.tipo
);
