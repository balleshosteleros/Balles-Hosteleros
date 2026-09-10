-- ============================================================
-- 20260910153000_correo_auditoria_sin_history_id.sql
-- Auditoría de correos (PRP-094): fuera el puntero incremental de Gmail.
--
-- La columna se creó pensando en usar `history.list` para pedirle a Gmail solo
-- lo nuevo. Al implementar la ingesta se descartó: ese puntero CADUCA, y cuando
-- caduca Google responde 404 y el buzón deja de sincronizar en silencio — justo
-- el fallo que no se puede permitir una auditoría.
--
-- El día a día pide «lo de los últimos dos días» y descarta lo repetido por la
-- clave única. No tiene estado que caducar, y en un buzón de restaurante el
-- ahorro de llamadas que daba el puntero era irrelevante.
--
-- Se borra en vez de dejarla ahí sin usar: una columna muerta es una trampa para
-- el que venga después.
-- ============================================================

alter table public.correo_buzones drop column if exists last_history_id;
