-- ============================================================
-- 20260907235000_paginas_web_replicas_y_embudos.sql — PRP-088
--
-- Traer una web ajena IDÉNTICA dando solo el dominio (el proceso inverso al
-- importador de GoHighLevel) y guardar embudos: pasos encadenados en vez de
-- una web con menú.
--
-- Añade:
--   pagina_web_tipo += 'EMBUDO_PASO'
--   paginas_web     += html_replica, replica_origen_url, replica_capturada_at,
--                      replica_assets, embudo_id, embudo_orden
--   paginas_web_embudos (agrupa los pasos)
--
-- Idempotente. No borra ni modifica nada existente.
-- ============================================================

-- ─── 1. Formato nuevo de página ──────────────────────────────
-- Un paso de embudo NO es una web: no lleva menú ni navegación, y cada paso
-- tiene un único objetivo (registrarse, ver el vídeo, reservar la llamada).
alter type pagina_web_tipo add value if not exists 'EMBUDO_PASO';

-- ─── 2. La copia fiel, dentro de la propia página ────────────
-- `html_replica` guarda la página ya pintada, con las rutas apuntando a
-- nuestro almacenamiento. Cuando tiene contenido, el sitio público sirve ESE
-- html en vez de pintar los bloques.
--
-- ⚠️ NO se sanitiza con DOMPurify al servir: quitaría los estilos y la copia
-- dejaría de ser idéntica. La limpieza (fuera scripts, fuera píxeles de
-- terceros) la hace el clonador ANTES de guardar, y solo lo escribe personal
-- autorizado de la empresa — nunca un visitante.
alter table public.paginas_web
  add column if not exists html_replica         text,
  add column if not exists replica_origen_url   text,
  add column if not exists replica_capturada_at timestamptz,
  add column if not exists replica_assets       jsonb;

comment on column public.paginas_web.html_replica is
  'PRP-088: copia fiel de una web externa, ya con las rutas reescritas a R2. Si no es null, manda sobre bloques.';
comment on column public.paginas_web.replica_origen_url is
  'PRP-088: de dónde se copió. La copia queda congelada: para actualizarla hay que volver a clonar.';
comment on column public.paginas_web.replica_assets is
  'PRP-088: inventario de archivos subidos a R2 (clave, tipo, tamaño) para poder borrarlos si se elimina la página.';

-- ─── 3. El embudo que agrupa los pasos ───────────────────────
create table if not exists public.paginas_web_embudos (
  id          uuid primary key default gen_random_uuid(),
  empresa_id  uuid not null references public.empresas(id) on delete cascade,
  nombre      text not null,
  origen_url  text,
  created_by  uuid references auth.users(id),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists idx_paginas_web_embudos_empresa
  on public.paginas_web_embudos(empresa_id);

alter table public.paginas_web
  add column if not exists embudo_id    uuid references public.paginas_web_embudos(id) on delete set null,
  add column if not exists embudo_orden int;

create index if not exists idx_paginas_web_embudo
  on public.paginas_web(embudo_id, embudo_orden);

-- ─── 4. RLS: igual que el resto de páginas web ───────────────
alter table public.paginas_web_embudos enable row level security;

do $$ begin
  create policy "embudos_select_empresa" on public.paginas_web_embudos
    for select to authenticated
    using (empresa_id in (select public.empresas_del_usuario()));
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "embudos_insert_empresa" on public.paginas_web_embudos
    for insert to authenticated
    with check (empresa_id in (select public.empresas_del_usuario()));
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "embudos_update_empresa" on public.paginas_web_embudos
    for update to authenticated
    using (empresa_id in (select public.empresas_del_usuario()))
    with check (empresa_id in (select public.empresas_del_usuario()));
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "embudos_delete_empresa" on public.paginas_web_embudos
    for delete to authenticated
    using (empresa_id in (select public.empresas_del_usuario()));
exception when duplicate_object then null; end $$;
