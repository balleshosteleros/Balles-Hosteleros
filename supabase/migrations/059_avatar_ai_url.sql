-- Avatar generado por IA (recreación con uniforme corporativo según rol).
-- Se conserva avatar_url (foto real) y se añade avatar_ai_url (versión IA).
-- La UI prefiere avatar_ai_url cuando existe; si la generación falla, sigue mostrándose avatar_url.
alter table public.profiles
  add column if not exists avatar_ai_url text;
