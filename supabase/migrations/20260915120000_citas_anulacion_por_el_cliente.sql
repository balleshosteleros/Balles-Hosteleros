-- ============================================================
-- 20260915120000_citas_anulacion_por_el_cliente.sql — PRP-088
--
-- Que quien reservó pueda anular su cita, y que se sepa.
--
--   token_gestion  enlace propio de cada cita. Va en el correo de
--                  confirmación: con él, y solo con él, se abre la ficha de
--                  ESA cita y se puede anular. Sin sesión: quien reserva
--                  viene de un embudo y no tiene cuenta en el software.
--   cancelada_en   cuándo se anuló.
--   cancelada_por  quién: el propio cliente (por el enlace o declinando la
--                  invitación en su calendario) o alguien del equipo.
--
-- El hueco se libera SOLO: `huecosLibres` únicamente cuenta como ocupadas las
-- citas CONFIRMADAS, así que al pasar a CANCELADA la hora vuelve a ofrecerse.
-- El índice único de dobles reservas también mira solo las CONFIRMADAS.
--
-- Idempotente. Solo añade columnas.
-- ============================================================

alter table public.citas
  add column if not exists token_gestion text,
  add column if not exists cancelada_en   timestamptz,
  add column if not exists cancelada_por  text;

do $$ begin
  alter table public.citas
    add constraint citas_cancelada_por_chk
    check (cancelada_por is null or cancelada_por in ('CLIENTE_ENLACE', 'CLIENTE_CALENDARIO', 'EQUIPO'));
exception when duplicate_object then null; end $$;

-- El token es la llave de esa cita: tiene que ser único y la búsqueda por él
-- va en cada apertura del enlace.
create unique index if not exists uq_citas_token_gestion
  on public.citas(token_gestion)
  where token_gestion is not null;

comment on column public.citas.token_gestion is
  'Llave del enlace público de la cita (ver y anular). Va en el correo de confirmación.';
comment on column public.citas.cancelada_por is
  'CLIENTE_ENLACE | CLIENTE_CALENDARIO | EQUIPO. Quién anuló la cita.';
