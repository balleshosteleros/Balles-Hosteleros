-- ============================================================
-- 060_accesos_apps.sql — Accesos a apps externas por empresa
--
-- Tabla nueva:
--   accesos_apps  (apps externas configurables por empresa)
--
-- Notas:
--   - Usa empresa_slug text (no uuid) para alinear con el selector
--     local de empresas en el frontend (EMPRESAS = ["habana","bacanal"]).
--   - id text para preservar IDs legibles tipo "ha-sg1", "ba-pd2".
--   - RLS abierta a authenticated (lectura/escritura). El filtrado
--     por empresa_slug se hace en server actions.
-- ============================================================

create table if not exists public.accesos_apps (
  id                   text primary key,
  empresa_slug         text not null,
  nombre               text not null,
  descripcion          text not null default '',
  url                  text not null,
  icono                text not null default '🔗',
  logo_url             text,
  categoria            text not null,
  departamentos        text[] not null default '{}',
  roles_autorizados    text[] not null default '{}',
  usuario              text not null default '',
  contrasena           text not null default '',
  estado               text not null default 'Activo' check (estado in ('Activo','Inactivo','Archivado')),
  responsable          text not null default '',
  notas                text not null default '',
  tipo_integracion     text not null default 'enlace' check (tipo_integracion in ('enlace','embebido','sso','oauth')),
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

create index if not exists idx_accesos_apps_empresa
  on public.accesos_apps(empresa_slug);

create index if not exists idx_accesos_apps_empresa_categoria
  on public.accesos_apps(empresa_slug, categoria) where estado = 'Activo';

-- ─── Trigger updated_at ──────────────────────────────────────
create or replace function public.accesos_apps_set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

drop trigger if exists trg_accesos_apps_updated on public.accesos_apps;
create trigger trg_accesos_apps_updated
  before update on public.accesos_apps
  for each row execute function public.accesos_apps_set_updated_at();

-- ─── RLS ─────────────────────────────────────────────────────
alter table public.accesos_apps enable row level security;

drop policy if exists "accesos_apps_auth_read" on public.accesos_apps;
create policy "accesos_apps_auth_read" on public.accesos_apps
  for select to authenticated
  using (true);

drop policy if exists "accesos_apps_auth_write" on public.accesos_apps;
create policy "accesos_apps_auth_write" on public.accesos_apps
  for all to authenticated
  using (true)
  with check (true);

-- ─── Seed inicial (HABANA + BACANAL, set idéntico de 14 apps) ─
insert into public.accesos_apps
  (id, empresa_slug, nombre, descripcion, url, icono, logo_url, categoria, departamentos, roles_autorizados, usuario, contrasena, estado, responsable, notas, tipo_integracion)
values
  -- ── HABANA ──
  ('ha-sg1','habana','Banktrack','Control financiero y tesorería empresarial','https://app.banktrack.com','🏦','/icons/apps/banktrack.png','Sistemas de gestión',array['Contabilidad','Dirección'],array['Dirección','Gerencia'],'','','Activo','Pedro Ruiz','','enlace'),
  ('ha-sg2','habana','Ágora','Software TPV para hostelería','https://www.agora-pv.com','🍽️','/icons/apps/agora.png','Sistemas de gestión',array['Gerencia','Dirección'],array['Dirección','Gerencia'],'','','Activo','María García','','enlace'),
  ('ha-sg3','habana','Sesame','RRHH, fichajes y gestión de personal','https://app.sesamehr.es','👥','https://icon.horse/icon/sesamehr.com','Sistemas de gestión',array['RRHH','Dirección'],array['Dirección','Gerencia','RRHH'],'','','Activo','María García','','enlace'),
  ('ha-sg4','habana','Cover Manager','Gestión de reservas para restaurantes','https://www.covermanager.com','📅','https://icon.horse/icon/covermanager.com','Sistemas de gestión',array['Gerencia','Dirección'],array['Dirección','Gerencia'],'','','Activo','Carlos Martínez','','enlace'),
  ('ha-sg5','habana','High Level','CRM y marketing automation','https://app.gohighlevel.com','📊','/icons/apps/highlevel.png','Sistemas de gestión',array['Marketing','Dirección'],array['Dirección','Marketing'],'','','Activo','Carlos Martínez','','enlace'),
  ('ha-sg6','habana','B2com','Plataforma de gestión para hostelería','https://www.b2com.es','🏢','/icons/apps/b2com.png','Sistemas de gestión',array['Dirección'],array['Dirección'],'','','Activo','Pedro Ruiz','','enlace'),
  ('ha-bf1','habana','BBVA Net Cash','Banca online empresarial BBVA','https://www.bbva.es/empresas/productos/banca-electronica/net-cash.html','💳','/icons/apps/bbva.png','Banca y finanzas',array['Contabilidad','Dirección'],array['Dirección'],'','','Activo','Pedro Ruiz','Doble factor obligatorio.','enlace'),
  ('ha-bf2','habana','Revolut Business','Banca digital empresarial Revolut','https://business.revolut.com','💼','https://cdn.simpleicons.org/revolut/0666EB','Banca y finanzas',array['Contabilidad','Dirección'],array['Dirección'],'','','Activo','Pedro Ruiz','','enlace'),
  ('ha-bf3','habana','Stripe','Pasarela de pagos online','https://dashboard.stripe.com','⚡','https://cdn.simpleicons.org/stripe/635BFF','Banca y finanzas',array['Contabilidad','Dirección'],array['Dirección','Gerencia'],'','','Activo','Pedro Ruiz','','oauth'),
  ('ha-rs1','habana','Instagram','Perfil de Instagram de La Habana','https://www.instagram.com','📸','https://cdn.simpleicons.org/instagram/E4405F','Redes sociales',array['Marketing'],array['Dirección','Marketing'],'','','Activo','Carlos Martínez','','enlace'),
  ('ha-rs2','habana','Facebook','Página de Facebook de La Habana','https://www.facebook.com','👍','https://cdn.simpleicons.org/facebook/1877F2','Redes sociales',array['Marketing'],array['Dirección','Marketing'],'','','Activo','Carlos Martínez','','oauth'),
  ('ha-rs3','habana','TikTok','Cuenta TikTok de La Habana','https://www.tiktok.com','🎵','https://cdn.simpleicons.org/tiktok/000000','Redes sociales',array['Marketing'],array['Dirección','Marketing'],'','','Activo','Carlos Martínez','','enlace'),
  ('ha-pd1','habana','Página Web','Sitio web oficial de La Habana','https://www.lahabana.es','🌐',null,'Presencia digital',array['Marketing','Dirección'],array['Dirección','Marketing'],'','','Activo','Carlos Martínez','','enlace'),
  ('ha-pd2','habana','Ficha Google','Google Business Profile de La Habana','https://business.google.com','📍','https://cdn.simpleicons.org/google/4285F4','Presencia digital',array['Marketing','Dirección'],array['Dirección','Marketing'],'','','Activo','Carlos Martínez','','oauth'),

  -- ── BACANAL ──
  ('ba-sg1','bacanal','Banktrack','Control financiero y tesorería empresarial','https://app.banktrack.com','🏦','/icons/apps/banktrack.png','Sistemas de gestión',array['Contabilidad','Dirección'],array['Dirección','Gerencia'],'','','Activo','Lucía Pérez','','enlace'),
  ('ba-sg2','bacanal','Ágora','Software TPV para hostelería','https://www.agora-pv.com','🍽️','/icons/apps/agora.png','Sistemas de gestión',array['Gerencia','Dirección'],array['Dirección','Gerencia'],'','','Activo','Andrés Jiménez','','enlace'),
  ('ba-sg3','bacanal','Sesame','RRHH, fichajes y gestión de personal','https://app.sesamehr.es','👥','https://icon.horse/icon/sesamehr.com','Sistemas de gestión',array['RRHH','Dirección'],array['Dirección','Gerencia','RRHH'],'','','Activo','Lucía Pérez','','enlace'),
  ('ba-sg4','bacanal','Cover Manager','Gestión de reservas para restaurantes','https://www.covermanager.com','📅','https://icon.horse/icon/covermanager.com','Sistemas de gestión',array['Gerencia','Dirección'],array['Dirección','Gerencia'],'','','Activo','Andrés Jiménez','','enlace'),
  ('ba-sg5','bacanal','High Level','CRM y marketing automation','https://app.gohighlevel.com','📊','/icons/apps/highlevel.png','Sistemas de gestión',array['Marketing','Dirección'],array['Dirección','Marketing'],'','','Activo','Andrés Jiménez','','enlace'),
  ('ba-sg6','bacanal','B2com','Plataforma de gestión para hostelería','https://www.b2com.es','🏢','/icons/apps/b2com.png','Sistemas de gestión',array['Dirección'],array['Dirección'],'','','Activo','Andrés Jiménez','','enlace'),
  ('ba-bf1','bacanal','BBVA Net Cash','Banca online empresarial BBVA','https://www.bbva.es/empresas/productos/banca-electronica/net-cash.html','💳','/icons/apps/bbva.png','Banca y finanzas',array['Contabilidad','Dirección'],array['Dirección'],'','','Activo','Andrés Jiménez','Doble factor obligatorio.','enlace'),
  ('ba-bf2','bacanal','Revolut Business','Banca digital empresarial Revolut','https://business.revolut.com','💼','https://cdn.simpleicons.org/revolut/0666EB','Banca y finanzas',array['Contabilidad','Dirección'],array['Dirección'],'','','Activo','Andrés Jiménez','','enlace'),
  ('ba-bf3','bacanal','Stripe','Pasarela de pagos online','https://dashboard.stripe.com','⚡','https://cdn.simpleicons.org/stripe/635BFF','Banca y finanzas',array['Contabilidad','Dirección'],array['Dirección','Gerencia'],'','','Activo','Andrés Jiménez','','oauth'),
  ('ba-rs1','bacanal','Instagram','Perfil de Instagram de Bacanal','https://www.instagram.com','📸','https://cdn.simpleicons.org/instagram/E4405F','Redes sociales',array['Marketing'],array['Dirección','Marketing'],'','','Activo','Andrés Jiménez','','enlace'),
  ('ba-rs2','bacanal','Facebook','Página de Facebook de Bacanal','https://www.facebook.com','👍','https://cdn.simpleicons.org/facebook/1877F2','Redes sociales',array['Marketing'],array['Dirección','Marketing'],'','','Activo','Andrés Jiménez','','oauth'),
  ('ba-rs3','bacanal','TikTok','Cuenta TikTok de Bacanal','https://www.tiktok.com','🎵','https://cdn.simpleicons.org/tiktok/000000','Redes sociales',array['Marketing'],array['Dirección','Marketing'],'','','Activo','Andrés Jiménez','','enlace'),
  ('ba-pd1','bacanal','Página Web','Sitio web oficial de Bacanal','https://www.bacanal.es','🌐',null,'Presencia digital',array['Marketing','Dirección'],array['Dirección','Marketing'],'','','Activo','Andrés Jiménez','','enlace'),
  ('ba-pd2','bacanal','Ficha Google','Google Business Profile de Bacanal','https://business.google.com','📍','https://cdn.simpleicons.org/google/4285F4','Presencia digital',array['Marketing','Dirección'],array['Dirección','Marketing'],'','','Activo','Andrés Jiménez','','oauth')
on conflict (id) do nothing;
