# PRP-029: Marketing — submódulo Página Web (CMS multi-tenant + editor de bloques + dominios Vercel)

> **Estado**: PENDIENTE APROBACIÓN
> **Fecha**: 2026-04-18
> **Proyecto**: Balles-Hosteleros
> **Ruta admin**: `/marketing/pagina-web`
> **Rutas públicas**: catch-all por hostname → resuelve empresa + página → renderiza bloques
> **Feature dir**: `src/features/marketing/pagina-web/`
> **Depende de**: `empresas`, `empresa_logos` (PRP-023), `productos`, `carta_items` (PRP-028), Supabase Storage, Vercel Domains API
> **Primera web a migrar**: `www.bacanalmadrid.com` (reconstrucción 1:1 desde contenido público)

---

## Objetivo

Construir un **CMS multi-tenant de páginas web** dentro de Marketing que permita a cada empresa del SaaS diseñar, publicar y mantener **múltiples sitios web** (web corporativa + one-pages de campañas), cada uno con su propio dominio/subdominio, usando un **editor visual de bloques con vista previa en vivo**. La primera entrega sirve como migración de `www.bacanalmadrid.com` a la plataforma, manteniendo SiteGround como registro del dominio y apuntando DNS a Vercel con SSL automático.

## Por Qué

| Problema | Solución |
|----------|----------|
| Cada empresa paga hosting + mantenimiento externo de su web corporativa; cambios requieren un técnico. | CMS interno: el equipo de marketing edita bloques en vivo y publica con un click. |
| Las one-pages de campañas (Navidad, menú de San Valentín, bodas, eventos) se externalizan o se hacen en Wix/Canva sin tracking unificado. | Generar en minutos una one-page con los bloques ya diseñados y dominio dedicado (`sanvalentin.bacanalmadrid.com`). |
| Datos de leads (formularios de reserva/contacto) terminan en Gmail o plataformas externas → se pierden. | Formularios capturan a `leads_web` con `empresa_id` + `pagina_id` y quedan disponibles para el CRM de Marketing. |
| No hay coherencia de marca entre módulos (POS, carta digital, web, redes sociales). | La web usa `empresa_logos` + tokens de branding compartidos con carta digital / presentaciones. |
| Migrar/renovar una web externa = semanas + coste. | Editor de bloques reconstruye Bacanal 1:1 como prueba piloto y queda replicable para cualquier cliente del SaaS. |
| Gestión de dominios y SSL es dolorosa (Cloudflare manual, certificados, renovación). | Vercel Domains API automatiza custom domains + SSL sin tocar el panel Vercel. |

**Valor de negocio**:
- Eliminación de coste de hosting/WordPress por empresa (~€30-80/mes/empresa).
- Lanzamiento de one-pages de campaña en <30 min (vs. 1-2 semanas fuera).
- **Lead capture unificado**: formularios directamente en BD + reutilizables desde CRM.
- Consistencia de marca entre web pública, carta digital y presentaciones internas.
- Argumento de venta SaaS: "tu web y tu back-office en la misma plataforma".
- Caso piloto medible: reducir el time-to-publish de cambios en `bacanalmadrid.com` de días a segundos.

## Qué

### Criterios de Éxito

- [ ] Existe ruta `/marketing/pagina-web` (privada, rol `MARKETING` / `GERENTE` / `DIRECCION`) con listado de páginas creadas por la empresa.
- [ ] El usuario puede crear una página nueva eligiendo tipo (`WEB_PRINCIPAL` o `ONE_PAGE`) y un slug interno.
- [ ] Cada página tiene un **editor visual de bloques** con tres columnas: biblioteca de bloques (izq.), canvas con drag & drop (centro), propiedades del bloque seleccionado (der.).
- [ ] Los 11 tipos de bloque funcionan: `hero`, `galeria`, `menu`, `reservas`, `testimonios`, `cta`, `formulario`, `mapa`, `footer`, `texto_libre`, `video`.
- [ ] El editor tiene **preview en vivo** (split view o pestaña) que refleja cambios con <300ms de lag.
- [ ] Al publicar, la página queda accesible en su dominio configurado con SSL en <2 min.
- [ ] Un mismo admin puede gestionar varios dominios (ej.: `bacanalmadrid.com` y `sanvalentin.bacanalmadrid.com`) desde la misma UI.
- [ ] La asignación de dominio usa la **Vercel Domains API**: añade dominio, muestra los registros DNS a configurar en SiteGround, verifica propagación y emite SSL automático.
- [ ] La resolución pública es multi-tenant por **hostname**: `middleware` (o `app/[[...slug]]/page.tsx` con `headers()`) mapea `host → empresa_id → pagina` sin depender de rutas `/empresa/x/...`.
- [ ] `www.bacanalmadrid.com` queda reconstruido 1:1 en la plataforma: hero + galería + menú + reservas + testimonios + CTA + formulario + mapa + footer, visible en la URL real tras cambiar DNS.
- [ ] Los formularios graban en `leads_web` con `empresa_id`, `pagina_id`, `bloque_id`, payload JSON, UTM, referrer, user_agent (truncado) e `ip_hash` (RGPD).
- [ ] RLS estricto: una empresa **sólo** ve/edita sus páginas y leads. La lectura pública por hostname usa cliente `anon` con RLS que filtra por `publicada = true`.
- [ ] SEO: `generateMetadata` por página (title, description, OG image), sitemap dinámico en `/sitemap.xml`, `robots.txt`, OG image por página.
- [ ] Lighthouse mobile ≥ 90 en la home pública reconstruida de Bacanal.
- [ ] `npm run typecheck` y `npm run build` pasan.
- [ ] No hay regresión en el resto de módulos (sala, cocina, carta digital, marketing/contenido, etc.).

### Comportamiento Esperado (Happy Path)

**Admin — crear one-page de San Valentín**

1. Responsable de marketing entra a `/marketing/pagina-web` y ve la lista con "BACANAL — Web principal (publicada)".
2. Hace click en "Nueva página", elige tipo `ONE_PAGE`, nombre "San Valentín 2026", slug interno `san-valentin-2026`.
3. El editor abre vacío. Arrastra desde la biblioteca: `hero` → `texto_libre` → `menu` → `reservas` → `footer`.
4. Click en bloque `hero` → panel derecho muestra form con título, subtítulo, CTA, foto de fondo (subida a Supabase Storage). Guarda.
5. Cada cambio genera un autosave (`estado = BORRADOR`) + actualiza preview a la derecha.
6. En "Dominio" pulsa "Añadir dominio" → escribe `sanvalentin.bacanalmadrid.com` → sistema llama a Vercel Domains API, devuelve registros DNS (CNAME a `cname.vercel-dns.com`).
7. Responsable copia los registros, los pega en SiteGround. Al volver, la UI detecta "Dominio verificado + SSL activo".
8. Pulsa "Publicar". La página pasa a `estado = PUBLICADA` y queda disponible en `https://sanvalentin.bacanalmadrid.com`.

**Cliente final — visita la web**

1. Cliente abre `https://sanvalentin.bacanalmadrid.com`.
2. Next.js resuelve por hostname → empresa → página → bloques. Server Component renderiza SSR.
3. Ve hero con foto, menú de San Valentín (bloque `menu` puede enlazar con `carta_items`), testimonios, y un formulario de reserva.
4. Rellena el formulario. POST a server action → `leads_web` + confirmación (opcional: email con Resend ya integrado).
5. Al día siguiente el equipo de Marketing ve el lead en `/marketing/captacion` (reutilizando feature existente).

**Migración Bacanal (primera ejecución)**

1. Admin pulsa "Importar de URL" en la web principal → pega `https://www.bacanalmadrid.com`.
2. Un script server-side (fase dedicada) fetchea el HTML público, extrae textos/imágenes, y pre-rellena bloques (`hero`, `galeria`, `menu`, `reservas`, `testimonios`, `footer`).
3. El admin revisa bloque por bloque, ajusta textos/fotos, y publica. Vercel Domains registra `bacanalmadrid.com` y `www.bacanalmadrid.com` con el mismo contenido (redirect `www → apex` o al revés, configurable).
4. Al cambiar DNS en SiteGround a Vercel, la web vive en la plataforma con SSL.

---

## Contexto

### Referencias (patrones existentes)

- **Feature-first ya en marketing**: `src/features/marketing/` con `actions/`, `components/`, `services/`, `hooks/`, `types/`, `data/`, `contexts/`. Añadir subcarpeta `pagina-web/`.
- **Precedente de módulo público + admin**: `src/features/marketing/carta-digital/` (PRP-028) — usa cliente anon, layout limpio, RLS con `to anon`, cookies de sesión vs. cliente anónimo separados. **ESTE ES EL PATRÓN A SEGUIR**.
- **Cliente Supabase anónimo**: `src/lib/supabase/anon.ts` ya creado. Reutilizable para rutas públicas de webs.
- **Middleware / proxy**: `src/lib/supabase/proxy.ts` + `proxy.ts` raíz. La rewrite por hostname se resuelve a nivel `middleware.ts` o con un router catch-all. Debe **excluir el tráfico de dominios externos** del guard de auth.
- **Sidebar Marketing**: `src/features/layout/components/app-sidebar.tsx:85` (`marketingSubs`) — añadir "PÁGINA WEB" con icono `Globe` o `LayoutTemplate`.
- **Storage existente**: `empresa_logos` bucket + políticas (migración `023_empresa_logos.sql`). Crear nuevo bucket `paginas-web-assets` siguiendo el mismo patrón.
- **Tipos/validación**: Zod se usa en todas las actions (`src/features/marketing/actions/publicaciones-actions.ts` como referencia). Zustand ya presente en el editor de presentaciones (`src/features/direccion/presentaciones/`) — patrón replicable.
- **Server Actions**: patrón consolidado → `"use server"` + validación Zod + try/catch + logs (MEMORY.md — Protocolo Guardado Supabase).
- **MEMORY.md activo**:
  - Botones `<Button variant="primary" size="lg">` con icono.
  - `localStorage` prohibido para datos críticos (autosave → siempre BD).
  - Modo autónomo: ejecutar sin pedir confirmación una vez aprobado.
  - Tocar `services/`, `types/`, `supabase/migrations/`; `components/` y `app/` sólo cuando la feature lo exige (aquí sí, porque es nueva UI).
- **Vercel Domains API docs**: `https://vercel.com/docs/rest-api/endpoints/domains` — endpoints `POST /v10/domains`, `POST /v9/projects/:idOrName/domains`, `GET /v6/domains/:domain/config`, `GET /v9/projects/:idOrName/domains/:domain/verify`. Se requiere `VERCEL_TOKEN` + `VERCEL_PROJECT_ID` + `VERCEL_TEAM_ID` como env vars server-side.
- **Leads/captación existentes**: `src/features/marketing/components/CaptacionView.tsx` — reutilizar UI para listar leads provenientes de `leads_web`.

### Arquitectura Propuesta

```
src/features/marketing/pagina-web/
├── components/
│   ├── admin/
│   │   ├── PaginasListView.tsx             # Tabla de páginas por empresa
│   │   ├── NuevaPaginaModal.tsx            # Elegir tipo (WEB_PRINCIPAL / ONE_PAGE)
│   │   ├── editor/
│   │   │   ├── EditorShell.tsx             # Layout 3 columnas (library/canvas/props)
│   │   │   ├── BloqueLibrary.tsx           # Sidebar izq. con los 11 bloques draggables
│   │   │   ├── Canvas.tsx                  # Centro: bloques ordenables con @dnd-kit
│   │   │   ├── BloqueRenderer.tsx          # Render genérico en canvas (modo edit)
│   │   │   ├── PropiedadesPanel.tsx        # Form Zod del bloque seleccionado
│   │   │   ├── PreviewPane.tsx             # Preview en vivo (iframe a /preview/[id])
│   │   │   └── AutosaveIndicator.tsx       # "Guardado hace 3s"
│   │   ├── dominios/
│   │   │   ├── DominiosPanel.tsx           # Lista dominios asociados a la página
│   │   │   ├── AnadirDominioDialog.tsx     # Call API Vercel + mostrar DNS
│   │   │   └── EstadoDominio.tsx           # Verified/pending/SSL
│   │   ├── seo/
│   │   │   ├── SeoPanel.tsx                # Meta, OG image, slug público
│   │   │   └── OgImagePreview.tsx
│   │   ├── branding/
│   │   │   └── BrandingSnapshot.tsx        # Tokens de color/tipografía por empresa
│   │   ├── importar/
│   │   │   ├── ImportarDeUrlDialog.tsx     # Input URL + trigger scrape
│   │   │   └── MigracionBacanalButton.tsx  # Acción directa al piloto
│   │   └── leads/
│   │       └── LeadsPorPaginaTable.tsx     # Tab "Leads" dentro del editor
│   ├── bloques/                              # 1 archivo por bloque, edit + render compartido
│   │   ├── HeroBloque.tsx
│   │   ├── GaleriaBloque.tsx
│   │   ├── MenuBloque.tsx
│   │   ├── ReservasBloque.tsx
│   │   ├── TestimoniosBloque.tsx
│   │   ├── CtaBloque.tsx
│   │   ├── FormularioBloque.tsx
│   │   ├── MapaBloque.tsx
│   │   ├── FooterBloque.tsx
│   │   ├── TextoLibreBloque.tsx
│   │   └── VideoBloque.tsx
│   └── public/
│       ├── PaginaPublicaShell.tsx          # Wrapper SSR que itera bloques
│       └── BloquePublico.tsx               # Switch por tipo → render read-only optimizado
├── hooks/
│   ├── useEditorStore.ts                   # Zustand: bloques, selección, dirty flag
│   ├── useAutosave.ts                      # Debounce + server action
│   ├── useDominioStatus.ts                 # Polling Vercel API cada 10s
│   └── useLivePreview.ts                   # Broadcast canal → iframe preview
├── services/
│   ├── paginas-fetch.ts                    # Admin fetch
│   ├── pagina-publica-fetch.ts             # Anon fetch por hostname
│   ├── vercel-domains.ts                   # Wrapper tipado de Vercel Domains API
│   ├── hostname-resolver.ts                # host → empresa_id + pagina_id
│   ├── bloque-schemas.ts                   # Zod schema por tipo de bloque
│   ├── importador-html.ts                  # Scrape + mapping a bloques (piloto Bacanal)
│   └── og-image-generator.ts               # Runtime OG image con @vercel/og
├── actions/
│   ├── paginas-actions.ts                  # CRUD páginas
│   ├── bloques-actions.ts                  # upsertBloque / reorder / delete
│   ├── publicar-actions.ts                 # publicar / despublicar
│   ├── dominios-actions.ts                 # añadir / verificar / eliminar dominio
│   ├── importar-url-actions.ts             # disparar scrape + pre-rellenar
│   └── leads-actions.ts                    # insert desde formularios públicos
├── types/
│   └── index.ts                            # PaginaWeb, Bloque<Tipo>, LeadWeb, etc.
└── data/
    ├── bloques-catalogo.ts                 # Metadata visual de cada bloque
    └── bloques-defaults.ts                 # Valores iniciales al arrastrar
```

Rutas App Router:

```
src/app/(main)/marketing/pagina-web/page.tsx                     # Listado
src/app/(main)/marketing/pagina-web/nueva/page.tsx               # Wizard creación
src/app/(main)/marketing/pagina-web/[id]/page.tsx                # Editor
src/app/(main)/marketing/pagina-web/[id]/dominios/page.tsx       # Dominios
src/app/(main)/marketing/pagina-web/[id]/leads/page.tsx          # Leads
src/app/(main)/marketing/pagina-web/[id]/preview/page.tsx        # Preview interno (autenticado)
src/app/api/pagina-web/importar-url/route.ts                     # Scrape fetch server-side
src/app/api/pagina-web/og/[paginaId]/route.tsx                   # OG image runtime
src/app/api/pagina-web/leads/route.ts                            # Endpoint público formularios
src/app/api/pagina-web/vercel/verify/route.ts                    # Webhook / polling Vercel

src/app/sitemap.ts                                               # Sitemap dinámico
src/app/robots.ts                                                # Robots.txt

# RUTAS PÚBLICAS por hostname (fuera de (main), sin auth)
src/app/(public-site)/layout.tsx                                 # Layout vacío (html/body)
src/app/(public-site)/[[...slug]]/page.tsx                       # Catch-all resuelve host → bloques
```

**Estrategia de resolución por hostname**

- En `src/middleware.ts` (o en un nuevo `middleware` que convive con el proxy), detectar hostname:
  - Si `host` coincide con el dominio principal del SaaS (`sistema.balleshosteleros.com`) → flujo normal (auth, panel).
  - Si `host` es un dominio de cliente registrado en `paginas_web_dominios` → rewrite interno a `/(public-site)/[[...slug]]?__host={host}` pasando hostname por header/param.
- El catch-all lee el hostname vía `headers()`, consulta `hostname-resolver.ts`, obtiene `{empresa_id, pagina_id}`, y carga los bloques para SSR.

### Modelo de Datos — migración `040_marketing_pagina_web.sql`

> Nota: `038_carta_digital.sql` y `039_rename_nuevos_platos.sql` ya ocupadas. Se asigna el siguiente número libre (`040`).

```sql
-- ─── 0. Enums ────────────────────────────────────────────────
do $$ begin
  create type pagina_web_tipo    as enum ('WEB_PRINCIPAL', 'ONE_PAGE');
exception when duplicate_object then null; end $$;

do $$ begin
  create type pagina_web_estado  as enum ('BORRADOR', 'PUBLICADA', 'ARCHIVADA');
exception when duplicate_object then null; end $$;

do $$ begin
  create type bloque_tipo as enum (
    'hero','galeria','menu','reservas','testimonios',
    'cta','formulario','mapa','footer','texto_libre','video'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type dominio_estado as enum ('PENDIENTE_DNS','VERIFICADO','ERROR');
exception when duplicate_object then null; end $$;

-- ─── 1. Páginas ──────────────────────────────────────────────
create table if not exists public.paginas_web (
  id             uuid primary key default gen_random_uuid(),
  empresa_id     uuid not null references public.empresas(id) on delete cascade,
  tipo           pagina_web_tipo not null,
  nombre         text not null,
  slug_interno   text not null,                                 -- nombre técnico único por empresa
  bloques        jsonb not null default '[]'::jsonb,            -- array ordenado de bloques
  branding       jsonb,                                         -- snapshot colores/tipografías
  seo            jsonb,                                         -- { title, description, og_image, robots }
  estado         pagina_web_estado not null default 'BORRADOR',
  publicada_at   timestamptz,
  created_by     uuid references auth.users(id),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  unique (empresa_id, slug_interno)
);

create index if not exists idx_paginas_web_empresa
  on public.paginas_web(empresa_id, estado);

-- ─── 2. Dominios ─────────────────────────────────────────────
create table if not exists public.paginas_web_dominios (
  id               uuid primary key default gen_random_uuid(),
  empresa_id       uuid not null references public.empresas(id) on delete cascade,
  pagina_id        uuid not null references public.paginas_web(id) on delete cascade,
  hostname         text not null unique,                        -- ej. www.bacanalmadrid.com
  es_principal     boolean not null default false,              -- apex vs www
  estado           dominio_estado not null default 'PENDIENTE_DNS',
  vercel_domain_id text,                                        -- id devuelto por Vercel
  dns_hint         jsonb,                                        -- { tipo, name, value } a mostrar al admin
  ssl_activo       boolean not null default false,
  verificado_at    timestamptz,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create index if not exists idx_paginas_web_dom_hostname
  on public.paginas_web_dominios(hostname);
create index if not exists idx_paginas_web_dom_pagina
  on public.paginas_web_dominios(pagina_id);

-- ─── 3. Leads (capturados por formularios públicos) ──────────
create table if not exists public.leads_web (
  id          uuid primary key default gen_random_uuid(),
  empresa_id  uuid not null references public.empresas(id) on delete cascade,
  pagina_id   uuid references public.paginas_web(id) on delete set null,
  bloque_id   text,                                             -- id del bloque formulario dentro de bloques[]
  nombre      text,
  email       text,
  telefono    text,
  mensaje     text,
  payload     jsonb not null default '{}'::jsonb,               -- campos arbitrarios
  utm         jsonb,                                             -- { source, medium, campaign }
  referrer    text,
  user_agent  text,
  ip_hash     text,                                              -- sha256 salt fijo (RGPD)
  created_at  timestamptz not null default now()
);

create index if not exists idx_leads_web_empresa_created
  on public.leads_web(empresa_id, created_at desc);

-- ─── 4. Versiones (historial para rollback) ──────────────────
create table if not exists public.paginas_web_versiones (
  id          uuid primary key default gen_random_uuid(),
  pagina_id   uuid not null references public.paginas_web(id) on delete cascade,
  version     integer not null,
  snapshot    jsonb not null,                                    -- copia bloques+seo+branding
  created_by  uuid references auth.users(id),
  created_at  timestamptz not null default now(),
  unique (pagina_id, version)
);

create index if not exists idx_paginas_web_ver_pagina
  on public.paginas_web_versiones(pagina_id, version desc);

-- ─── 5. RLS ──────────────────────────────────────────────────
alter table public.paginas_web            enable row level security;
alter table public.paginas_web_dominios   enable row level security;
alter table public.paginas_web_versiones  enable row level security;
alter table public.leads_web              enable row level security;

-- ADMIN: sólo su empresa
drop policy if exists "paginas_web_admin_rw" on public.paginas_web;
create policy "paginas_web_admin_rw" on public.paginas_web
  for all to authenticated
  using (empresa_id in (select p.empresa_id from public.profiles p where p.user_id = auth.uid()))
  with check (empresa_id in (select p.empresa_id from public.profiles p where p.user_id = auth.uid()));

drop policy if exists "paginas_web_dom_admin_rw" on public.paginas_web_dominios;
create policy "paginas_web_dom_admin_rw" on public.paginas_web_dominios
  for all to authenticated
  using (empresa_id in (select p.empresa_id from public.profiles p where p.user_id = auth.uid()))
  with check (empresa_id in (select p.empresa_id from public.profiles p where p.user_id = auth.uid()));

drop policy if exists "paginas_web_ver_admin_rw" on public.paginas_web_versiones;
create policy "paginas_web_ver_admin_rw" on public.paginas_web_versiones
  for all to authenticated
  using (pagina_id in (
    select pw.id from public.paginas_web pw
    join public.profiles p on p.empresa_id = pw.empresa_id
    where p.user_id = auth.uid()
  ))
  with check (pagina_id in (
    select pw.id from public.paginas_web pw
    join public.profiles p on p.empresa_id = pw.empresa_id
    where p.user_id = auth.uid()
  ));

-- Leads: lectura admin, insert anónimo vía server action (server usa service_role o filtro empresa)
drop policy if exists "leads_web_admin_read" on public.leads_web;
create policy "leads_web_admin_read" on public.leads_web
  for select to authenticated
  using (empresa_id in (select p.empresa_id from public.profiles p where p.user_id = auth.uid()));

-- PÚBLICO ANÓNIMO — lectura de páginas publicadas por hostname
drop policy if exists "paginas_web_public_read" on public.paginas_web;
create policy "paginas_web_public_read" on public.paginas_web
  for select to anon, authenticated
  using (
    estado = 'PUBLICADA'
    and id in (select pagina_id from public.paginas_web_dominios where estado = 'VERIFICADO')
  );

drop policy if exists "paginas_web_dom_public_read" on public.paginas_web_dominios;
create policy "paginas_web_dom_public_read" on public.paginas_web_dominios
  for select to anon, authenticated
  using (estado = 'VERIFICADO');

-- Inserts de leads: se hacen desde server action con service_role client
-- (no se expone policy for insert anon directa → se controla 100% server-side).

-- ─── 6. Trigger updated_at + versiones ───────────────────────
create or replace function public.paginas_web_touch()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

drop trigger if exists trg_paginas_web_touch on public.paginas_web;
create trigger trg_paginas_web_touch
  before update on public.paginas_web
  for each row execute function public.paginas_web_touch();

-- Snapshot a versiones cuando se publica
create or replace function public.paginas_web_snapshot_on_publish()
returns trigger language plpgsql as $$
declare
  next_ver integer;
begin
  if new.estado = 'PUBLICADA'
     and (old.estado is distinct from 'PUBLICADA'
          or old.bloques is distinct from new.bloques) then
    select coalesce(max(version), 0) + 1 into next_ver
      from public.paginas_web_versiones where pagina_id = new.id;
    insert into public.paginas_web_versiones (pagina_id, version, snapshot, created_by)
      values (new.id, next_ver,
              jsonb_build_object('bloques', new.bloques, 'seo', new.seo, 'branding', new.branding),
              new.created_by);
  end if;
  return new;
end $$;

drop trigger if exists trg_paginas_web_snapshot on public.paginas_web;
create trigger trg_paginas_web_snapshot
  after update on public.paginas_web
  for each row execute function public.paginas_web_snapshot_on_publish();

-- ─── 7. Storage bucket ───────────────────────────────────────
-- Ejecutar en dashboard o como SQL adicional:
-- insert into storage.buckets (id, name, public) values
--   ('paginas-web-assets', 'paginas-web-assets', true) on conflict do nothing;
-- policy lectura anon + escritura authenticated con empresa match
--   (ver ejemplo en 023_empresa_logos.sql)
```

**Schema de `bloques` (JSONB) — normalizado en Zod**

Cada entrada de `bloques` es:

```ts
type BloqueBase = { id: string; tipo: BloqueTipo; orden: number; visible: boolean };

type Bloque =
  | (BloqueBase & { tipo: "hero";        datos: { titulo: string; subtitulo?: string; cta?: { label: string; href: string }; foto_url?: string; overlay?: number } })
  | (BloqueBase & { tipo: "galeria";     datos: { imagenes: Array<{ url: string; alt: string }>; layout: "grid" | "masonry" | "carrusel" } })
  | (BloqueBase & { tipo: "menu";        datos: { fuente: "carta_items" | "manual"; categoria_ids?: string[]; items_manual?: Array<{ nombre: string; precio: number; descripcion?: string }> } })
  | (BloqueBase & { tipo: "reservas";    datos: { modo: "embed_cover" | "formulario_propio" | "enlace_externo"; url?: string; campos?: string[] } })
  | (BloqueBase & { tipo: "testimonios"; datos: { items: Array<{ nombre: string; texto: string; estrellas?: number; foto_url?: string }> } })
  | (BloqueBase & { tipo: "cta";         datos: { titulo: string; texto?: string; boton: { label: string; href: string; variante: "primary"|"ghost" } } })
  | (BloqueBase & { tipo: "formulario";  datos: { titulo: string; campos: Array<{ name: string; label: string; tipo: "text"|"email"|"tel"|"textarea"; required: boolean }>; mensaje_exito: string } })
  | (BloqueBase & { tipo: "mapa";        datos: { lat: number; lng: number; zoom: number; direccion_texto: string } })
  | (BloqueBase & { tipo: "footer";      datos: { columnas: Array<{ titulo: string; items: Array<{ label: string; href: string }> }>; redes?: Array<{ red: string; url: string }>; texto_legal?: string } })
  | (BloqueBase & { tipo: "texto_libre"; datos: { html_seguro: string } })           // sanitizado con DOMPurify server-side
  | (BloqueBase & { tipo: "video";       datos: { proveedor: "youtube"|"vimeo"|"url_directa"; url: string; autoplay: boolean; muted: boolean } });
```

**Reutilizados (sin modificación)**: `empresas`, `profiles`, `empresa_logos`, `carta_items` (para bloque `menu`), Resend (para email de lead opcional).

---

## Blueprint (Assembly Line)

> Sólo se definen FASES. Las subtareas se generan al entrar a cada fase con `/bucle-agentico`.

### Fase 1: Migración BD + Storage + tipos + Zod schemas
- Aplicar `040_marketing_pagina_web.sql` idempotente (tablas, enums, RLS, triggers, versiones).
- Crear bucket `paginas-web-assets` (público, con políticas anon read / authenticated write con `empresa_id` match).
- Generar tipos espejo en `types/index.ts` + Zod schemas de cada bloque en `services/bloque-schemas.ts`.
- **Validación**: select de columnas funciona, RLS denega cross-empresa, upload de prueba al bucket, `npm run typecheck` verde.

### Fase 2: Listado de páginas + creación (CRUD básico sin editor)
- Ruta `/marketing/pagina-web` con `PaginasListView.tsx`.
- `NuevaPaginaModal.tsx` (tipo + nombre + slug interno).
- `paginas-actions.ts` (create/list/delete/renombrar) + `paginas-fetch.ts`.
- **Validación**: crear dos páginas en dos empresas distintas; RLS verificado (B no ve las de A); borrado en cascada limpia dominios/versiones.

### Fase 3: Editor visual de bloques — estructura
- `EditorShell.tsx` layout 3 columnas.
- `BloqueLibrary.tsx` con 11 bloques arrastrables (`@dnd-kit`).
- `Canvas.tsx` con reordenamiento, selección, borrado.
- `useEditorStore.ts` (Zustand) con `bloques`, `seleccionado`, `dirty`, `hydrate(paginaId)`.
- **Validación**: añadir/mover/borrar bloques en UI sin tocar BD todavía; estado consistente en devtools.

### Fase 4: Propiedades por bloque + autosave
- Un componente por bloque en `components/bloques/` con form Zod.
- `PropiedadesPanel.tsx` renderiza el form del bloque seleccionado.
- `useAutosave.ts` con debounce 1s → `bloques-actions.ts::saveBloques`.
- `AutosaveIndicator.tsx` muestra estado.
- **Validación**: editar título de hero → persiste en BD en 1s; recargar página conserva cambios; concurrencia entre pestañas se maneja con `updated_at` + last-write-wins + warning.

### Fase 5: Preview en vivo
- Ruta interna `/marketing/pagina-web/[id]/preview` (autenticada) que renderiza bloques en read-only.
- `PreviewPane.tsx` embebe esta ruta en iframe.
- `useLivePreview.ts` con `BroadcastChannel` o `postMessage` para actualizar el iframe sin recarga completa.
- **Validación**: editar bloque hero → cambio visible en preview en <300ms sin recargar iframe.

### Fase 6: Bloque `menu` conectado a carta_items + bloque `galeria` con subida
- Bloque `MenuBloque.tsx` soporta `fuente = carta_items` con picker de categorías (reutiliza `carta_items`).
- Bloque `GaleriaBloque.tsx` con uploader a `paginas-web-assets/{empresa_id}/{pagina_id}/{uuid}.jpg`, compresión client-side (`browser-image-compression`).
- **Validación**: cambiar un plato en carta digital → se refleja en bloque menú al recargar preview; subir 10 imágenes y reordenarlas.

### Fase 7: Bloques restantes + formulario con endpoint
- Implementar `hero`, `testimonios`, `cta`, `formulario`, `mapa`, `footer`, `texto_libre` (sanitizar con DOMPurify), `video`, `reservas`.
- `src/app/api/pagina-web/leads/route.ts` → POST insert en `leads_web` con validación Zod, ip_hash (sha256+salt), throttle por ip/minuto.
- `leads-actions.ts` server action para uso desde server component también.
- **Validación**: formulario envía → lead aparece en `/marketing/captacion` con UTM y referrer; rate limit funciona.

### Fase 8: Resolución pública por hostname + catch-all
- Actualizar `src/middleware.ts` (o crear uno nuevo coexistiendo con `proxy.ts`) para detectar hostname externo y rewrite a `(public-site)/[[...slug]]`.
- `src/app/(public-site)/layout.tsx` minimal (sin sidebar, sin AppLayout).
- `src/app/(public-site)/[[...slug]]/page.tsx` lee `headers().get('x-forwarded-host')`, consulta `hostname-resolver.ts`, renderiza bloques vía `BloquePublico.tsx`.
- Cliente anon reutilizado.
- **Validación**: localmente con `/etc/hosts` mapeando `bacanal.test → 127.0.0.1`, cargar `http://bacanal.test:3000` muestra bloques; rutas `/sala/*` siguen protegidas en el dominio principal.

### Fase 9: Vercel Domains API + panel dominios
- `services/vercel-domains.ts` con funciones `addDomain`, `getDomainConfig`, `verifyDomain`, `removeDomain`.
- `dominios-actions.ts` persiste `paginas_web_dominios` + llama API.
- `DominiosPanel.tsx` + `AnadirDominioDialog.tsx` muestran registros DNS y estado.
- Polling `useDominioStatus.ts` cada 10s hasta `VERIFICADO + SSL`.
- Env vars: `VERCEL_TOKEN`, `VERCEL_PROJECT_ID`, `VERCEL_TEAM_ID` en `.env.local` (server-only, nunca `NEXT_PUBLIC_`).
- **Validación**: añadir dominio test (ej. un subdominio propio), registros DNS mostrados, tras configurarlos en SiteGround / Cloudflare el estado pasa a VERIFICADO.

### Fase 10: Publicación + versiones + rollback
- `publicar-actions.ts` con toggle `estado` y validación (al menos un dominio verificado).
- Trigger BD genera snapshot en `paginas_web_versiones`.
- UI listado de versiones con "Restaurar" (copia snapshot → bloques).
- **Validación**: publicar, editar, publicar de nuevo → aparecen dos versiones; restaurar la v1 trae el contenido antiguo.

### Fase 11: SEO + sitemap + OG image runtime + robots
- `generateMetadata` por página (title, description, og).
- `src/app/sitemap.ts` enumera páginas PUBLICADAS con dominios VERIFICADOS.
- `src/app/robots.ts` base; overridable por página.
- `og-image-generator.ts` con `@vercel/og` para generar OG image runtime a partir del hero.
- **Validación**: inspector Facebook/Twitter Card muestra OG correcto; `/sitemap.xml` lista URLs reales.

### Fase 12: Importador de `www.bacanalmadrid.com` + piloto de migración
- `importador-html.ts` hace `fetch` server-side (endpoint `api/pagina-web/importar-url`) → HTML → parser ligero (Cheerio o `node-html-parser`) → heurísticas para mapear secciones a bloques (hero por `<h1>`, galería por `<img>` >300px, etc.).
- Resultado se carga en el editor como BORRADOR.
- Admin revisa bloque a bloque y ajusta.
- Configurar dominios `bacanalmadrid.com` + `www.bacanalmadrid.com` en Vercel.
- Plan de corte DNS documentado en el PRP (no se ejecuta cambio DNS en SiteGround hasta OK explícito del usuario).
- **Validación**: página pre-rellenada con >70% de secciones reconocidas; despliegue en dominio de staging (`staging.bacanalmadrid.com`) idéntico a la original visualmente.

### Fase 13: Sidebar + permisos + accesos rápidos
- Añadir "PÁGINA WEB" en `marketingSubs` (`app-sidebar.tsx`) con icono `Globe` o `LayoutTemplate`.
- Añadir `/marketing/pagina-web` a `SECTION_TITLES` y `SECTION_ICONS` en `app-layout.tsx`.
- Guard por rol `MARKETING` / `GERENTE` / `DIRECCION` en page server components.
- Acceso rápido desde `AccesosDirectos` → "Crear one-page de campaña".
- **Validación**: usuario sin rol redirigido; entrada visible en sidebar; atajo funciona.

### Fase 14: QA + Playwright + Lighthouse + seguridad
- E2E con Playwright: crear página → arrastrar 5 bloques → editar hero → publicar → abrir en segunda ventana por hostname → llenar formulario → ver lead en captación.
- Lighthouse mobile ≥ 90 en la home reconstruida de Bacanal.
- Tests RLS cross-empresa (SQL) y XSS en `texto_libre` (DOMPurify verificado).
- Pentest rápido de `leads` endpoint (rate limit, validación Zod estricta, CSRF token opcional si se activa cookies).
- **Validación final**:
  - [ ] `npm run typecheck`
  - [ ] `npm run build`
  - [ ] Playwright E2E verde
  - [ ] Lighthouse mobile ≥ 90
  - [ ] RLS cross-empresa denegado
  - [ ] Dominio Bacanal de staging operativo con SSL
  - [ ] Todos los criterios de éxito ✅

---

## Aprendizajes (Self-Annealing)

> Esta sección crece durante la implementación. Vacía al aprobar el PRP.

---

## Gotchas

- [ ] **Multi-host en un único proyecto Vercel**: Vercel admite múltiples custom domains en un mismo proyecto. El middleware debe leer `request.headers.get('host')` (no `request.url`, que ya rewritea). Verificar con `x-forwarded-host` en producción detrás del edge.
- [ ] **Coexistencia middleware + proxy actual**: el proxy de auth (`proxy.ts`) aplica a todo lo no-assets. Hay que **excluir rutas `(public-site)/*` y cualquier hostname que NO sea el principal del SaaS** antes de que entre el guard de sesión.
- [ ] **Vercel Domains API — team scope**: si el proyecto está en un team, todas las llamadas requieren `teamId` en query string (`?teamId=...`). Olvidarlo da 404 silenciosos.
- [ ] **Token Vercel con permisos correctos**: el PAT debe tener scope "Full Account" o al menos "Domains + Projects". Leer-solo NO basta.
- [ ] **DNS desde SiteGround**: SiteGround no permite `ALIAS` en apex. Para `bacanalmadrid.com` usar un A record al IP anycast de Vercel (`76.76.21.21`) o delegar NS a Vercel. Documentar ambas opciones.
- [ ] **SSL inicial puede tardar**: Vercel emite Let's Encrypt cuando el DNS valida. Puede tardar 1-10 min. La UI debe mostrar estado "emitiendo SSL" sin bloquear.
- [ ] **`www.` vs apex**: hay que registrar **ambos** y decidir cuál redirige al otro (convención: apex → www para SEO consistente).
- [ ] **RLS con `to anon`**: sin `to anon` explícito el cliente anónimo no lee nada. Testear con `supabase.auth.signOut()` antes de fetchear.
- [ ] **Catch-all + rutas del dashboard**: `(public-site)/[[...slug]]` no debe capturar `/marketing/*`, `/sala/*`, etc., que ya existen en `(main)`. La solución es rewrite por hostname en middleware → nunca llegan al `(public-site)` desde el host principal.
- [ ] **Sanitización de `texto_libre`**: usar DOMPurify **server-side** (en la action, antes de persistir) para evitar XSS. En render público, confiar en lo ya sanitizado.
- [ ] **Inputs Zod estrictos en bloques**: `bloques` es JSONB libre → siempre validar con el Zod schema del tipo antes de guardar. Sin validación, un bug de UI puede guardar datos que rompan el render público.
- [ ] **Concurrencia autosave**: dos pestañas editando la misma página → `updated_at` compare + warning "otra pestaña ha editado; recargar o sobrescribir".
- [ ] **Leads spam**: sin reCAPTCHA el formulario es spammeable. Fase 7 implementa rate-limit por ip_hash; considerar hCaptcha como Fase 15 opcional si el spam aparece.
- [ ] **RGPD**: no almacenar IP cruda ni user-agent completo. Hash sha256 con salt de servidor + truncar UA a 120 chars. Incluir aviso de cookies configurable en bloque `footer`.
- [ ] **Imágenes pesadas**: comprimir client-side antes de subir (`browser-image-compression`) a 1920px max. Usar `next/image` con `remotePatterns` apuntando a Supabase Storage.
- [ ] **Migración Bacanal — NO tocar DNS sin OK**: el piloto termina con dominio de staging. El switch DNS productivo en SiteGround requiere ventana coordinada (usuario da OK + posible downtime < 5 min).
- [ ] **`bloques` JSONB vs tabla**: se elige JSONB por flexibilidad de schema. Contra: búsqueda/indexación interna cuesta más. Pro: versionado trivial + payload atómico a render público. Si en el futuro hay >1000 bloques por página, considerar normalizar.
- [ ] **SEO — sitemap dinámico**: `src/app/sitemap.ts` itera dominios VERIFICADOS; cuidado con caches CDN (usar `revalidate` y/o `revalidateTag` al publicar).
- [ ] **Next.js 16 + Cache Components**: aprovechar `use cache` con `cacheTag(paginaId)` en el render público para revalidar selectivamente al publicar (Fase 10).
- [ ] **`bloque.formulario` y fields dinámicos**: permitir al admin añadir campos arbitrarios significa que el schema del payload varía. Guardar en `leads_web.payload` JSONB; validar con Zod runtime desde la definición del bloque.
- [ ] **OG image runtime**: `@vercel/og` requiere edge runtime. Declarar `export const runtime = 'edge'` en el route handler, sin `next/image`.

## Anti-Patrones

- NO usar `localStorage` como fuente de verdad del editor — autosave siempre va a BD.
- NO exponer el `VERCEL_TOKEN` al cliente bajo ningún prefijo. Sólo server actions / API routes lo usan.
- NO permitir `texto_libre` sin sanitizar server-side.
- NO mezclar el layout público con el `(main)` — son dos árboles separados.
- NO renderizar bloques con `dangerouslySetInnerHTML` sin DOMPurify.
- NO hardcodear `vercel-dns.com` u otros hostnames; leer de la respuesta de Vercel API.
- NO asumir que una empresa tiene un único dominio; el modelo soporta N dominios por página.
- NO confiar en `empresa_id` enviado por el cliente para guardar — derivarlo siempre del `profiles` del usuario autenticado server-side.
- NO construir URLs públicas asumiendo `/empresa/{id}/...` — la resolución es por hostname, no por path.
- NO importar `@supabase/ssr` en ruta pública anónima; usar `src/lib/supabase/anon.ts`.
- NO dejar el bloque `formulario` sin rate-limit ni validación Zod — es superficie de ataque directa.
- NO reutilizar el bucket `carta-fotos` para assets de web; crear `paginas-web-assets` independiente para políticas más flexibles.

---

*PRP pendiente aprobación. No se ha modificado código aún.*
