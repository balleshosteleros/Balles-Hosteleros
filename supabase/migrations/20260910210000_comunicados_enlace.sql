-- COMUNICADOS: enlace que se pulsa desde el aviso o desde el propio comunicado.
--
-- Un comunicado no siempre lleva un documento: muchas veces lo que hay que
-- pasarle a la plantilla es una dirección (un formulario, una carta, un vídeo,
-- una reserva). Hasta ahora había que pegarla dentro del texto, donde no se
-- puede pulsar en el aviso y donde se pierde entre el mensaje.
--
-- `enlace_texto` es lo que se lee en el botón. Si va vacío, el botón dice
-- "Abrir enlace": el trabajador nunca ve una dirección larga y fea.
--
-- Idempotente: se puede pasar dos veces sin romper nada.

alter table public.comunicados
  add column if not exists enlace text,
  add column if not exists enlace_texto text;

comment on column public.comunicados.enlace is
  'Dirección que se abre desde el aviso y desde el comunicado. Siempre http(s).';
comment on column public.comunicados.enlace_texto is
  'Lo que se lee en el botón del enlace. Vacío = "Abrir enlace".';
