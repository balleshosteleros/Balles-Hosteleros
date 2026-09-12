-- ============================================================
-- 20260912100000_citas_cuenta_google_y_meet.sql — PRP-088 (citas del embudo)
--
-- Dos cosas:
--
-- 1. VERSIONAR las dos columnas que hoy solo existen en la base porque se
--    añadieron a mano: el calendario guarda a nombre de qué cuenta de Google
--    se crean sus eventos. Quien reserva es anónimo y no tiene sesión de la
--    que sacar el permiso, así que la cuenta se designa aquí.
--    A partir de ahora se elige desde el engranaje de Citas, no con SQL.
--
-- 2. `citas.google_meet_url` — el enlace de la videollamada.
--    Antes el único aviso que recibía quien reservaba era el que manda Google
--    al invitarle, y ese correo era el que llevaba el enlace. Ahora la
--    confirmación la manda el software con su marca, así que el enlace tiene
--    que estar guardado de nuestro lado: si no, la persona se queda sin sitio
--    al que entrar y el equipo sin poder verlo desde la pantalla de Citas.
--
-- Idempotente. Solo añade columnas, no toca datos.
-- ============================================================

alter table public.citas_calendarios
  add column if not exists google_cuenta_email text,
  add column if not exists google_user_id      uuid;

comment on column public.citas_calendarios.google_cuenta_email is
  'Cuenta de Google en cuyo calendario se crean los eventos de este calendario. Se elige desde el engranaje de Citas.';
comment on column public.citas_calendarios.google_user_id is
  'Usuario del software cuyo permiso de Google se usa (sus tokens están en google_cuentas_usuario).';

alter table public.citas
  add column if not exists google_meet_url text;

comment on column public.citas.google_meet_url is
  'Enlace de la videollamada del evento de Google. Lo lleva el correo de confirmación que manda el software.';
