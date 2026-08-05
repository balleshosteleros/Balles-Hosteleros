-- Chat: marcar un grupo como "no leído" a mano (estilo WhatsApp).
--
-- El usuario puede deslizar un grupo a la derecha para dejarlo marcado como
-- pendiente. La marca es personal (por usuario y canal) y se borra sola cuando
-- vuelve a abrir el grupo.
--
-- Idempotente: se puede ejecutar varias veces sin efecto secundario.

alter table public.canales_preferencias
  add column if not exists marcado_no_leido boolean not null default false;

comment on column public.canales_preferencias.marcado_no_leido is
  'El usuario dejó el canal marcado como no leído a mano. Se limpia al abrirlo.';
