-- ─── Realtime para estudios_apertura ────────────────────────
-- La página pública (/p/[slug]) se suscribe a cambios para refrescarse
-- automáticamente cuando el creador edita el estudio.
-- RLS ya permite a anon leer filas con share_active = true; basta con
-- añadir la tabla a la publication supabase_realtime.
-- Idempotente.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'estudios_apertura'
  ) then
    execute 'alter publication supabase_realtime add table public.estudios_apertura';
  end if;
exception when others then
  raise notice 'realtime publication setup skipped: %', sqlerrm;
end $$;

-- REPLICA IDENTITY FULL: incluye todas las columnas en los eventos UPDATE
-- (útil cuando el cliente filtra por id sin necesidad de re-fetch parcial).
alter table public.estudios_apertura replica identity full;
