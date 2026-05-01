-- PARCHE LOCAL: añade UNIQUE constraint a profiles.user_id
-- Necesario para que las FK de las migraciones 007+ funcionen.
-- Este archivo no modifica ningún archivo existente del supervisor.
alter table public.profiles
  add constraint if not exists profiles_user_id_unique unique (user_id);
