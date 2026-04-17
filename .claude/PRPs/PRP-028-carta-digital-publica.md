# PRP-028: Carta Digital — submódulo público de Sala

> **Estado**: PENDIENTE APROBACIÓN
> **Fecha**: 2026-04-17
> **Proyecto**: Balles-Hosteleros
> **Ruta admin**: `/sala/carta-digital`
> **Ruta pública**: `/carta/[slug]` (fuera del grupo `(main)`, sin auth)
> **Feature dir**: `src/features/sala/carta-digital/`
> **Depende de**: `productos`, `escandallos`, `empresas`, Supabase Storage

---

## Objetivo

Construir un **submódulo público de carta digital interactiva** dentro de SALA que cumple dos roles:

1. **Admin (privado)** — `/sala/carta-digital`: el equipo del restaurante crea/edita la carta, sube fotos, organiza categorías, fija precios, marca platos visibles/destacados, define el slug público de cada empresa.
2. **Público (anónimo)** — `https://{dominio}/carta/{slug-empresa}`: cualquier cliente con el enlace o QR ve **sólo** la carta (sin sidebar, sin login, sin acceso a otros módulos), navega categorías, abre fichas con fotos grandes, descripción y alérgenos, y puede dar **❤️ Me gusta** (1 voto por dispositivo). El contador es visible y se actualiza en tiempo real para que otros vean cuántos likes tiene cada plato.

## Por Qué

| Problema | Solución |
|----------|----------|
| El restaurante no tiene carta digital propia: depende de QR genéricos o PDFs estáticos. | Carta nativa, editable, con fotos profesionales y branding propio del restaurante. |
| No hay feedback de qué platos gustan más a los clientes reales (no sólo a los que comentan). | Voto silencioso "Me gusta" — métrica masiva que sirve para diseñar carta y eliminar bajos. |
| Dependencia de plataformas externas (TheFork, Glovo) para mostrar la carta = comisiones y datos perdidos. | Carta propia en el dominio de la app; el cliente entra, ve y vuelve sin intermediarios. |
| Cambios de carta (precio, foto, alta/baja de plato) tardan días en sincronizarse en PDFs/QRs externos. | Edición instantánea desde admin → cambio visible en la URL pública en <1 s. |
| Falta de un canal "viral" suave: ver "🔥 234 me gusta" en un plato genera prueba social. | Likes públicos visibles → confianza y conversión a pedido en sala. |

**Valor de negocio**:
- Reducción del tiempo de decisión del comensal (foto + descripción + popularidad).
- Datos accionables: top 10 platos más votados por mes para optimizar carta.
- Eliminación de coste de impresión/reimpresión de cartas físicas.
- Base para futuras features: carta multilenguaje, carta del día, pedido desde el móvil del cliente.

## Qué

### Criterios de Éxito

- [ ] Existe ruta `/sala/carta-digital` (privada, rol `SALA`/`ENCARGADO`/`GERENTE`) para gestionar la carta.
- [ ] El admin puede: crear categorías, crear platos (nombre, descripción, precio, alérgenos, foto), reordenar, ocultar/mostrar, marcar como destacado.
- [ ] El admin define el `slug` público de su empresa (ej.: `bambao`, `donalfredo`) — único, validado, inmutable tras 1ª publicación (con confirmación).
- [ ] La URL pública `/carta/{slug}` carga sin login, sin sidebar, sin layout de app: layout dedicado limpio mobile-first.
- [ ] Plato con foto se ve en grid + ficha modal con foto grande, descripción, precio, alérgenos, contador de likes y botón ❤️.
- [ ] Click en ❤️ registra 1 voto único por dispositivo (cookie + fingerprint ligero), idempotente; segundo click lo retira (toggle).
- [ ] Contador se actualiza en tiempo real en todos los dispositivos abiertos (Supabase Realtime).
- [ ] El cliente anónimo NO puede acceder a `/sala/*` ni a ningún otro módulo aunque manipule la URL — middleware lo bloquea.
- [ ] Lighthouse mobile ≥ 90 en `/carta/{slug}` (perf, a11y, best practices).
- [ ] Funciona offline-friendly: la carta se cachea en SWR/Next caching; los likes se reintentan si la red falla.
- [ ] Anti-spam: rate-limit 60 likes/min por IP; bloqueo si supera umbral.
- [ ] Vista admin con métricas: top 10 platos por likes en últimos 7/30 días.

### Comportamiento Esperado (Happy Path)

**Admin**:
1. Encargada entra en `/sala/carta-digital`, primera vez ve onboarding: "Define tu URL pública: balleshosteleros.app/carta/[___]".
2. Escribe `bambao`, sistema valida (no en uso, sin caracteres extraños), guarda slug.
3. Crea categorías "Entrantes", "Principales", "Postres" arrastrando para reordenar.
4. Crea plato "Croquetas de jamón", sube foto desde móvil, escribe descripción, precio 8.50€, marca alérgenos `gluten,lactosa`, lo asocia opcionalmente a un `producto_id` del catálogo POS.
5. Marca plato como "destacado" → aparece en sección "Recomendados" arriba.
6. Comparte URL `https://balleshosteleros.app/carta/bambao` o genera QR (botón "Descargar QR").

**Cliente anónimo**:
1. Escanea QR en mesa → abre `https://balleshosteleros.app/carta/bambao` en móvil.
2. Ve cabecera con logo + nombre del restaurante, debajo un grid de categorías horizontal scrollable.
3. Toca "Principales" → ve grid 2 columnas con fotos cuadradas, nombre y precio.
4. Toca "Risotto de boletus" → modal full-screen con foto grande, descripción, alérgenos, precio, contador "❤️ 47" y botón corazón.
5. Toca el corazón → animación + contador a 48; cookie guardada `cd_liked_{itemId}=1`.
6. Otro cliente en otra mesa ve el contador subir a 48 sin recargar (Realtime).
7. Vuelve atrás, navega más categorías, sale. La cookie persiste para evitar dobles likes.

---

## Contexto

### Referencias (patrones existentes)

- **Feature-first**: `src/features/sala/pos/` como referencia de submódulo de SALA con actions/components/services/types.
- **Sidebar SALA**: `src/features/layout/components/app-sidebar.tsx:65` (`salaSubs`) — añadir entrada "CARTA DIGITAL" con icono `BookOpenText` o `QrCode`.
- **App layout**: `src/features/layout/components/app-layout.tsx` — añadir `/sala/carta-digital` a `SECTION_TITLES` y `SECTION_ICONS`. La ruta `/carta/{slug}` NO usa este layout.
- **Layout público nuevo**: `src/app/carta/[slug]/layout.tsx` — sin sidebar, sin auth, sin AppLayout. Sólo `<html><body>{children}</body></html>` minimal con tema propio.
- **Middleware**: `src/middleware.ts` (revisar). La matcher debe **excluir** `/carta/:path*` de la verificación de sesión Supabase.
- **Supabase client**: dos clientes ya en uso → `src/lib/supabase/server.ts` (con cookies auth) para admin, y un nuevo `src/lib/supabase/anon.ts` con `anon key` plana para la ruta pública (sin sesión, RLS pública).
- **Storage**: bucket público `carta-fotos` con políticas: lectura anónima, escritura sólo authenticated con `empresa_id` matching.
- **MEMORY.md**:
  - Botones `<Button variant="primary" size="lg">` con icono.
  - Protocolo guardado: try/catch + logs en toda escritura, sin localStorage como fuente de verdad (sí como UX hint para likes).
  - Modo autónomo: ejecutar sin pedir confirmación.
- **Estándar UI público**: la carta pública NO usa shadcn pesado; tipografía grande, contraste alto, mobile-first. Reutilizar tokens Tailwind del proyecto.

### Arquitectura Propuesta

```
src/features/sala/carta-digital/
├── components/
│   ├── admin/
│   │   ├── CartaAdminBoard.tsx       # Tabla/Grid de categorías + items (admin)
│   │   ├── CategoriaCard.tsx          # Card de categoría con drag handle
│   │   ├── ItemEditorModal.tsx        # Modal CRUD plato (foto, precio, alérgenos)
│   │   ├── SlugConfigCard.tsx         # Setup inicial del slug público
│   │   ├── QrDownloadButton.tsx       # Genera y descarga QR (lib qrcode)
│   │   ├── FotoUploader.tsx           # Drag & drop a Supabase Storage
│   │   └── MetricasLikesPanel.tsx     # Top 10 platos por likes
│   └── public/
│       ├── CartaPublicPage.tsx        # Page principal pública (server component)
│       ├── CategoriaTabs.tsx          # Tabs horizontales scroll
│       ├── ItemGrid.tsx               # Grid 2col mobile / 3-4col desktop
│       ├── ItemCard.tsx               # Card mini con foto + nombre + precio + ❤️
│       ├── ItemFichaModal.tsx         # Modal full-screen ficha
│       ├── LikeButton.tsx             # Botón ❤️ con animación + counter live
│       └── HeaderRestaurante.tsx      # Logo + nombre + horarios
├── hooks/
│   ├── useCartaPublica.ts             # Fetch + cache de la carta por slug
│   ├── useLikeItem.ts                 # Toggle like (cookie + fingerprint)
│   └── useLikesRealtime.ts            # Suscripción a contadores
├── services/
│   ├── carta-fetch.ts                 # Lectura pública por slug (RPC anon)
│   ├── carta-admin-fetch.ts           # Lectura admin
│   ├── slug-validator.ts              # Reglas: kebab-case, único, blacklist
│   ├── like-anti-spam.ts              # Rate-limit + fingerprint
│   └── foto-upload.ts                 # Sube a bucket carta-fotos, devuelve URL
├── actions/
│   ├── carta-admin-actions.ts         # CRUD categorías + items (server action)
│   ├── slug-actions.ts                # setSlugEmpresa(slug) con validación
│   └── like-actions.ts                # toggleLike(itemId, deviceId) public action
├── types/
│   └── index.ts                       # CartaCategoria, CartaItem, LikeRecord, CartaPublica
└── data/
    └── alergenos-catalog.ts           # Catálogo estándar UE 14 alérgenos
```

Rutas App Router:
```
src/app/(main)/sala/carta-digital/page.tsx           # Admin entry (auth)
src/app/(main)/sala/carta-digital/metricas/page.tsx  # Métricas likes
src/app/carta/[slug]/page.tsx                        # Público (sin (main), sin auth)
src/app/carta/[slug]/layout.tsx                      # Layout limpio público
src/app/carta/[slug]/not-found.tsx                   # Slug no existe
```

Middleware:
```
src/middleware.ts → matcher excluye /carta/:path* y /api/carta/:path*
```

### Modelo de Datos — migración `038_carta_digital.sql`

> Nota: la 037 está reservada por PRP-027 (cocina/comandas). Esta migración usa el siguiente número libre (038).


```sql
-- ─── 0. Slug público en empresas ─────────────────────────────
alter table public.empresas
  add column if not exists carta_slug text unique,
  add column if not exists carta_publicada boolean not null default false,
  add column if not exists carta_horarios jsonb,
  add column if not exists carta_descripcion text;

create index if not exists idx_empresas_carta_slug
  on public.empresas(carta_slug) where carta_slug is not null;

-- ─── 1. Categorías de carta ──────────────────────────────────
create table if not exists public.carta_categorias (
  id           uuid primary key default gen_random_uuid(),
  empresa_id   uuid not null references public.empresas(id) on delete cascade,
  nombre       text not null,
  descripcion  text,
  orden        smallint not null default 0,
  visible      boolean not null default true,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index if not exists idx_carta_cat_empresa
  on public.carta_categorias(empresa_id, orden);

-- ─── 2. Items de carta ───────────────────────────────────────
create table if not exists public.carta_items (
  id              uuid primary key default gen_random_uuid(),
  empresa_id      uuid not null references public.empresas(id) on delete cascade,
  categoria_id    uuid not null references public.carta_categorias(id) on delete cascade,
  producto_id     uuid references public.productos(id) on delete set null,
  nombre          text not null,
  descripcion     text,
  precio          numeric(10,2) not null default 0,
  foto_url        text,
  foto_storage_path text,
  alergenos       text[] not null default '{}',
  orden           smallint not null default 0,
  visible         boolean not null default true,
  destacado       boolean not null default false,
  likes_count     integer not null default 0,  -- denormalizado para perf pública
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index if not exists idx_carta_items_cat
  on public.carta_items(categoria_id, orden) where visible = true;
create index if not exists idx_carta_items_destacado
  on public.carta_items(empresa_id, destacado) where destacado = true and visible = true;

-- ─── 3. Likes (1 por dispositivo) ────────────────────────────
create table if not exists public.carta_item_likes (
  id          uuid primary key default gen_random_uuid(),
  item_id     uuid not null references public.carta_items(id) on delete cascade,
  device_id   text not null,           -- hash cookie + fingerprint
  ip_hash     text,                    -- sha256 IP (no IP cruda)
  user_agent  text,
  created_at  timestamptz not null default now(),
  unique (item_id, device_id)
);
create index if not exists idx_carta_likes_item
  on public.carta_item_likes(item_id);
create index if not exists idx_carta_likes_iphash_recent
  on public.carta_item_likes(ip_hash, created_at desc);

-- ─── 4. Trigger sync likes_count ─────────────────────────────
create or replace function public.carta_likes_sync()
returns trigger language plpgsql as $$
begin
  if tg_op = 'INSERT' then
    update public.carta_items set likes_count = likes_count + 1 where id = new.item_id;
  elsif tg_op = 'DELETE' then
    update public.carta_items set likes_count = greatest(likes_count - 1, 0) where id = old.item_id;
  end if;
  return null;
end $$;

drop trigger if exists trg_carta_likes_sync on public.carta_item_likes;
create trigger trg_carta_likes_sync
  after insert or delete on public.carta_item_likes
  for each row execute function public.carta_likes_sync();

-- ─── 5. RLS ──────────────────────────────────────────────────
alter table public.carta_categorias enable row level security;
alter table public.carta_items      enable row level security;
alter table public.carta_item_likes enable row level security;

-- Lectura pública de categorías visibles de empresas con carta_publicada=true
drop policy if exists "carta_cat_public_read" on public.carta_categorias;
create policy "carta_cat_public_read" on public.carta_categorias
  for select to anon, authenticated
  using (
    visible = true and exists (
      select 1 from public.empresas e
      where e.id = empresa_id and e.carta_publicada = true
    )
  );

-- Escritura admin
drop policy if exists "carta_cat_admin_write" on public.carta_categorias;
create policy "carta_cat_admin_write" on public.carta_categorias
  for all to authenticated
  using (empresa_id in (select p.empresa_id from public.profiles p where p.user_id = auth.uid()))
  with check (empresa_id in (select p.empresa_id from public.profiles p where p.user_id = auth.uid()));

-- Misma lógica para items
drop policy if exists "carta_items_public_read" on public.carta_items;
create policy "carta_items_public_read" on public.carta_items
  for select to anon, authenticated
  using (
    visible = true and exists (
      select 1 from public.empresas e
      where e.id = empresa_id and e.carta_publicada = true
    )
  );

drop policy if exists "carta_items_admin_write" on public.carta_items;
create policy "carta_items_admin_write" on public.carta_items
  for all to authenticated
  using (empresa_id in (select p.empresa_id from public.profiles p where p.user_id = auth.uid()))
  with check (empresa_id in (select p.empresa_id from public.profiles p where p.user_id = auth.uid()));

-- Likes: insert/delete público con device_id, lectura sólo agregada (count público)
drop policy if exists "carta_likes_public_insert" on public.carta_item_likes;
create policy "carta_likes_public_insert" on public.carta_item_likes
  for insert to anon, authenticated
  with check (true);  -- la validación de spam se hace server-side en action

drop policy if exists "carta_likes_public_delete" on public.carta_item_likes;
create policy "carta_likes_public_delete" on public.carta_item_likes
  for delete to anon, authenticated
  using (true);  -- el action verifica device_id antes de borrar

-- Lectura individual sólo permitida con device_id en filtro (para "ya liked?")
drop policy if exists "carta_likes_public_select_own" on public.carta_item_likes;
create policy "carta_likes_public_select_own" on public.carta_item_likes
  for select to anon, authenticated
  using (true);  -- los counts vienen de carta_items.likes_count denormalizado

-- ─── 6. Realtime publication ─────────────────────────────────
alter publication supabase_realtime add table public.carta_items;

-- ─── 7. Storage bucket ───────────────────────────────────────
-- Ejecutar en SQL editor o via dashboard:
-- insert into storage.buckets (id, name, public) values ('carta-fotos', 'carta-fotos', true)
--   on conflict (id) do nothing;
--
-- create policy "carta_fotos_public_read" on storage.objects for select
--   to anon, authenticated using (bucket_id = 'carta-fotos');
-- create policy "carta_fotos_admin_upload" on storage.objects for insert
--   to authenticated with check (bucket_id = 'carta-fotos');
-- create policy "carta_fotos_admin_delete" on storage.objects for delete
--   to authenticated using (bucket_id = 'carta-fotos');
```

**Reutilizados (sin modificación)**: `productos`, `empresas` (extendida con 4 cols), `profiles`.

---

## Blueprint (Assembly Line)

> Sólo se definen FASES. Subtareas se generan al entrar en cada fase con bucle agéntico.

### Fase 1: Migración BD + Storage + tipos
- Aplicar `038_carta_digital.sql` idempotente.
- Crear bucket `carta-fotos` y políticas Storage.
- Generar tipos espejo `types/index.ts`.
- **Validación**: select de columnas nuevas funciona, `npm run typecheck` verde, upload de prueba a bucket.

### Fase 2: Slug público + cliente Supabase anónimo
- `slug-validator.ts` (kebab-case, blacklist `admin|api|sala|cocina|login`, único).
- `slug-actions.ts` para fijar slug por empresa, primera publicación inmutable.
- `src/lib/supabase/anon.ts` cliente sin sesión para ruta pública.
- **Validación**: dos empresas no pueden compartir slug, slug "admin" rechazado.

### Fase 3: Layout público + ruta `/carta/[slug]`
- `src/app/carta/[slug]/layout.tsx` minimal sin AppLayout.
- `src/app/carta/[slug]/page.tsx` server component que fetchea por slug.
- `not-found.tsx` para slug inexistente.
- Actualizar `src/middleware.ts` matcher para excluir `/carta/:path*`.
- **Validación**: visitar `/carta/test-slug` sin login funciona; visitar `/sala/pos` sin login redirect a `/login` (no se rompe el resto).

### Fase 4: Admin CRUD categorías + items
- `carta-admin-actions.ts` con createCategoria/updateCategoria/deleteCategoria, idem items.
- `CartaAdminBoard.tsx` con drag-and-drop reordenar (`@dnd-kit`).
- `ItemEditorModal.tsx` con shadcn Dialog + form Zod.
- **Validación**: crear categoría, plato, reordenar, ocultar — refleja en BD y en URL pública (incógnito).

### Fase 5: Subida de fotos (Storage)
- `FotoUploader.tsx` drag&drop + preview, comprime a 1280px max via `browser-image-compression`.
- `foto-upload.ts` sube a `carta-fotos/{empresa_id}/{item_id}.jpg`, devuelve URL pública.
- Borrado de foto al borrar item (en action).
- **Validación**: subir foto 5MB → comprime y sube en <3 s; URL accesible anon.

### Fase 6: UI pública — categorías, grid, ficha modal
- `HeaderRestaurante.tsx` con logo (de `empresa_logos` ya existente).
- `CategoriaTabs.tsx` scroll horizontal sticky.
- `ItemGrid.tsx` + `ItemCard.tsx` Tailwind mobile-first.
- `ItemFichaModal.tsx` full-screen con foto + descripción + alérgenos + precio + Like.
- **Validación**: Lighthouse mobile ≥ 90 en `/carta/{slug}` con 30 platos.

### Fase 7: Sistema de Likes (anti-spam + realtime)
- `useLikeItem.ts` con cookie `cd_liked_{itemId}` + fingerprint ligero (`fingerprintjs` lite o hash UA+resolución).
- `like-actions.ts` con rate-limit (60/min/IP via tabla in-memory cache + ip_hash).
- `useLikesRealtime.ts` suscribe a `carta_items` UPDATEs filtrando por categoria visible.
- Animación corazón con framer-motion al click.
- **Validación**: 1 like por dispositivo verificado en 2 navegadores; 60 intentos rápidos → bloqueo; otra pestaña ve contador subir en <2 s.

### Fase 8: Métricas admin + QR + slug onboarding
- `MetricasLikesPanel.tsx` top 10 platos por likes 7d/30d.
- `QrDownloadButton.tsx` con `qrcode` lib, exporta PNG.
- `SlugConfigCard.tsx` onboarding inicial cuando no hay slug.
- Botón "Publicar carta" (toggle `carta_publicada`).
- **Validación**: QR escaneado abre `/carta/{slug}`, métricas suman likes correctos.

### Fase 9: Sidebar + ruta + permisos admin
- Añadir "CARTA DIGITAL" a `salaSubs` en `app-sidebar.tsx` con icono `BookOpenText`.
- Añadir `/sala/carta-digital` a `SECTION_TITLES` y `SECTION_ICONS`.
- Guard de rol en page server component.
- **Validación**: usuario sin rol SALA redirigido; entrada visible en sidebar.

### Fase 10: QA + Playwright + Lighthouse
- E2E: admin crea plato → visita pública en otra ventana → da like → ve contador subir.
- Lighthouse mobile ≥ 90.
- Test cross-browser de likes (Chrome + Safari iOS).
- RLS cross-empresa: usuario A no puede editar items de empresa B.
- **Validación**: `npm run typecheck`, `npm run build`, criterios de éxito ✅.

---

## Aprendizajes (Self-Annealing)

> Esta sección crece durante implementación. Vacía al aprobar.

---

## Gotchas

- [ ] **Middleware de auth**: Next.js middleware actual probablemente protege todo bajo `/`. Ajustar `matcher` para excluir `/carta/:path*`. Si no, la ruta pública pedirá login.
- [ ] **RLS y cliente anónimo**: las policies `to anon, authenticated` deben estar EXPLÍCITAS. Sin `to anon`, el cliente sin sesión no lee nada.
- [ ] **Storage público**: el bucket `carta-fotos` debe ser `public=true` y tener policy de lectura para `anon`. Sin esto las fotos dan 403.
- [ ] **Likes denormalizados**: trigger mantiene `likes_count` en `carta_items`. Si se borra masivo, recalcular con `update carta_items set likes_count = (select count(*) from carta_item_likes where item_id = carta_items.id)`.
- [ ] **Anti-spam**: device_id basado sólo en cookie es trivial de saltarse (incógnito). Combinar con `fingerprintjs` open-source + rate-limit por `ip_hash` (sha256 + salt fijo, no IP cruda — RGPD).
- [ ] **RGPD**: NO almacenar IP cruda. Hash sha256 con salt fijo de servidor. NO almacenar user_agent completo si revela mucho — truncar.
- [ ] **Realtime y anon**: las suscripciones realtime con cliente anónimo funcionan si la policy de SELECT permite `anon`. Probar.
- [ ] **Slug colisiones**: validar contra blacklist de rutas existentes (`admin`, `api`, `sala`, `cocina`, `login`, `auth`, `carta`). Si Next.js tiene una ruta con ese nombre, el slug la sobreescribe o no — comprobar.
- [ ] **Slug inmutable**: cambiarlo rompe QRs ya impresos. Permitir cambio sólo con confirmación doble + alerta.
- [ ] **Carga de fotos pesadas**: comprimir client-side antes de subir (`browser-image-compression`). Servir con `next/image` con `unoptimized` o configurar `images.remotePatterns` para Supabase Storage.
- [ ] **Cache pública**: `/carta/{slug}` usar `revalidate: 60` (ISR) + `revalidateTag` cuando admin guarda. Likes NO deben invalidar cache (solo realtime client-side actualiza counter).
- [ ] **Mobile Safari cookies**: iOS Safari bloquea cookies third-party. La cookie `cd_liked_*` debe ser first-party (mismo dominio) — ya lo es.
- [ ] **Doble click like**: deshabilitar botón 500 ms tras click + optimistic update.
- [ ] **Borrar plato con likes**: `on delete cascade` borra los likes. Decidir si interesa preservar histórico (soft-delete con `deleted_at`).
- [ ] **Multilenguaje**: fuera de alcance F1, pero dejar `descripcion` extensible a `descripcion_i18n jsonb` en futuro.

## Anti-Patrones

- NO usar `localStorage` como fuente de verdad de likes — es la BD. Cookie/storage es sólo UX hint.
- NO exponer la `service_role key` al cliente público nunca.
- NO bloquear el render de la carta por esperar likes — fetch en paralelo.
- NO duplicar fotos en otra tabla — el bucket Storage es la fuente.
- NO usar `any` en payloads ni en formularios — Zod siempre.
- NO meter el contador de likes en el server component (queda estático). Va en client component con realtime.
- NO permitir voto múltiple por incógnito sin protección — combinar device_id + ip_hash.
- NO mezclar el layout público con el `(main)` — son dos árboles separados.
- NO confiar en el cliente para validar `empresa_id` en escrituras — siempre RLS server-side.

---

*PRP pendiente aprobación. No se ha modificado código aún.*
