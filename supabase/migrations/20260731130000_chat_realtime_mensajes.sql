-- Habilita realtime (postgres_changes) sobre la tabla de mensajes del chat
-- para que los mensajes entren al momento sin refrescar el software.
-- Idempotente: se puede ejecutar varias veces sin efectos secundarios.

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'mensajes'
  ) then
    execute 'alter publication supabase_realtime add table public.mensajes';
  end if;
end $$;

-- REPLICA IDENTITY FULL: el payload realtime incluye todas las columnas de la
-- fila insertada (autor_id, canal_id, texto…), necesarias para pintar el toast
-- y decidir si el mensaje es propio o ajeno sin una segunda ida a BD.
alter table public.mensajes replica identity full;
