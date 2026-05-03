-- Bucket para fotos de perfil de empleados (público, una foto por user_id).
insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;
