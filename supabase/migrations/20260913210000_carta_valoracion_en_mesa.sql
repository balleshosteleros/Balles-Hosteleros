-- ============================================================
-- Valoración en mesa: la carta se convierte en la pregunta.
--
-- El cliente escanea el QR al sentarse y deja la carta abierta. Pasado un
-- rato, cuando ya ha comido, la carta le muestra "¿qué tal ha ido?". No hay
-- correo de por medio: la valoración se pide en el sitio, con el móvil que ya
-- tiene en la mano, y ES LA ÚNICA VÍA que alcanza a los walk-ins (el correo
-- de las 10:00 solo llega a quien reservó dejando su dirección).
--
-- Cuatro ajustes por empresa, porque una comida de menú no dura lo que una
-- cena de coctelería:
--   activa    → el interruptor. Apagado, la carta se comporta como siempre.
--   minutos   → cuánto se espera desde el primer escaneo para preguntar.
--   reintento → si cierra la ventana, cuánto tarda en reaparecer.
--   margen    → tras puntuar, cuánto se le guarda el sitio por si vuelve a
--               dejar sus datos. Agotado, la valoración se cierra anónima.
--
-- Van en `visita_config` y no en una tabla nueva: es la misma configuración
-- del circuito de valoración que ya vive ahí (filtro de 5 estrellas y enlace
-- de Google incluidos), y partirla en dos sitios haría que mañana nadie
-- supiera cuál manda.
--
-- Idempotente: se puede ejecutar dos veces.
-- ============================================================

alter table public.visita_config
  add column if not exists carta_valoracion_activa boolean not null default false,
  add column if not exists carta_valoracion_minutos integer not null default 90,
  add column if not exists carta_valoracion_reintento_minutos integer not null default 15,
  add column if not exists carta_valoracion_margen_minutos integer not null default 10;

-- Topes de cordura. Preguntar a los 5 minutos es preguntar mientras comen;
-- esperar seis horas es preguntar cuando ya están en casa.
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.visita_config'::regclass
      and conname = 'visita_config_carta_valoracion_chk'
  ) then
    alter table public.visita_config
      add constraint visita_config_carta_valoracion_chk check (
        carta_valoracion_minutos between 15 and 300
        and carta_valoracion_reintento_minutos between 5 and 120
        and carta_valoracion_margen_minutos between 1 and 120
      );
  end if;
end $$;

comment on column public.visita_config.carta_valoracion_activa is
  'Si la carta pide valoración en mesa pasado un rato desde el escaneo.';
comment on column public.visita_config.carta_valoracion_minutos is
  'Minutos desde el primer escaneo hasta que salta la ventana.';
comment on column public.visita_config.carta_valoracion_reintento_minutos is
  'Minutos que tarda en reaparecer si el cliente la cierra.';
comment on column public.visita_config.carta_valoracion_margen_minutos is
  'Minutos que se guarda el sitio tras puntuar por si vuelve a dejar sus datos.';
