-- Roster de cuentas de Google conectadas, POR USUARIO.
--
-- Antes vivía solo en la cookie `g_accounts`, que el signout borra: al cerrar
-- sesión se perdían todas las cuentas y había que reconectarlas a diario.
-- Ahora la cookie es solo caché y esta tabla es la fuente duradera.
--
-- La cookie se sigue borrando al salir (ver src/app/api/auth/signout/route.ts);
-- lo que NO se borra es esta fila, y por eso al volver a entrar el roster se
-- rehidrata desde aquí (POST /api/google/sync).
create table if not exists google_cuentas_usuario (
  user_id uuid primary key references auth.users(id) on delete cascade,
  cuentas jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now()
);

alter table google_cuentas_usuario enable row level security;

-- Cada usuario ve y escribe SOLO su propia fila: `cuentas` contiene los
-- refresh_token de Google y no puede quedar expuesto a otros usuarios de la
-- misma empresa.
drop policy if exists "google_cuentas_propias_select" on google_cuentas_usuario;
create policy "google_cuentas_propias_select" on google_cuentas_usuario
  for select using (auth.uid() = user_id);

drop policy if exists "google_cuentas_propias_insert" on google_cuentas_usuario;
create policy "google_cuentas_propias_insert" on google_cuentas_usuario
  for insert with check (auth.uid() = user_id);

drop policy if exists "google_cuentas_propias_update" on google_cuentas_usuario;
create policy "google_cuentas_propias_update" on google_cuentas_usuario
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "google_cuentas_propias_delete" on google_cuentas_usuario;
create policy "google_cuentas_propias_delete" on google_cuentas_usuario
  for delete using (auth.uid() = user_id);

comment on table google_cuentas_usuario is
  'Cuentas de Google conectadas por usuario (multi-cuenta estilo Gmail). Sobrevive al cierre de sesion: la cookie g_accounts es solo cache.';
