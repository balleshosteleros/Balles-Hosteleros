-- "Nos interesa que se vaya?" -- la unica respuesta del preaviso que se guarda
-- como DATO y no como texto: es la que luego se cuenta.
--
-- Se rellena en los dos desenlaces del preaviso, y por eso vive en la tarjeta y
-- no en la baja: cuando se le da de baja (se va) y cuando se le recupera (se
-- queda). Cruzada con la fase de la tarjeta responde a la pregunta que importa:
-- de los que se han ido, a cuantos queriamos retener.
--
-- Idempotente.
alter table public.candidatos
  add column if not exists interesa_que_se_vaya boolean,
  add column if not exists interesa_que_se_vaya_at timestamptz,
  add column if not exists interesa_que_se_vaya_por uuid;

comment on column public.candidatos.interesa_que_se_vaya is
  'Respuesta de RRHH al cerrar el preaviso: true = nos conviene que se vaya, false = queriamos retenerle. NULL = todavia no se ha preguntado.';
