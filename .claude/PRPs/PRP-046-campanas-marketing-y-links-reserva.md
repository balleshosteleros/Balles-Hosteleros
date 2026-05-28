# PRP-046: Campañas de Marketing + Links de Reserva Trazables

> **Estado**: PENDIENTE
> **Fecha**: 2026-05-28
> **Proyecto**: Balles-Hosteleros (multi-tenant, mismo repo)

---

## Objetivo

Cerrar el ciclo "campaña → reserva atribuida" sin proveedores externos en v1: el restaurante crea **links de reserva nombrados** (`/reservar?o=PALABRA`) que viven en cada campaña (Email, WhatsApp, SMS), y el Jefe de Sala ve en su panel el **origen** de cada reserva. Reemplaza el dashboard actual de Campañas por una vista canónica con toolbar BARRA HORIZONTAL 1 (Email · WhatsApp · SMS · Meta · Google) y editor con segmentación dinámica desde `clientes_sala`. Meta y Google quedan como placeholders.

## Por Qué

| Problema | Solución |
|----------|----------|
| Hoy el dashboard de Campañas (`CampanasDashboardView`) es un panel de KPIs sin acción: no se mide qué campaña generó cuántas reservas, y SMS no existe como canal. | Vista nueva con BARRA HORIZONTAL 1 (5 canales) y listado por canal con columna "Reservas generadas" calculada vía `COUNT(reservas WHERE origen = palabra_clave)`. |
| El Jefe de Sala recibe reservas sin saber si vienen de Instagram, de un email a clientes VIP, de WhatsApp de cumpleaños o de la carta digital. Sin atribución no hay ROI. | Tabla `reserva_links` (palabras_clave libres por empresa) + columna `origen TEXT` en `reservas` + ruta pública `/reservar?o=XXX` que la persiste + badge "Origen" y filtro en `ReservasView`. |
| La segmentación actual es un string fijo ("vip", "inactivos", "nuevos") sin lógica real. No se puede combinar "últimos 30 días + visitas > 5". | Segmento dinámico `segmento_json` (días desde última visita, clasificación, visitas mínimas, combinables AND/OR) con vista previa de cuántos clientes coinciden, ejecutado server-side sobre `clientes_sala`. |
| Las recomendaciones por canal (asunto corto en Email, 160 caracteres en SMS, plantilla aprobada en WhatsApp) están en la cabeza del dueño, no en la UI. Se mandan campañas mal formateadas. | Banner contextual por canal en el editor, con contador en vivo y aviso si supera límites. |
| Probar el flujo end-to-end exige contratar Resend/Twilio/WhatsApp Business antes de validar UX. | "Modo demo — sin envío real": el botón Enviar persiste filas `campanas_envios` con `estado='enviado'` pero no llama a ningún proveedor. Permite iterar el editor y la atribución sin proveedor. |

**Valor de negocio**:
- Atribución cerrada: el dueño verá por fin "esta campaña de WhatsApp generó 18 reservas" en lugar de un open rate aislado.
- SMS como canal disponible (era una ausencia notoria para hostelería en España).
- 0 € de coste en v1 (modo demo) → validar adopción antes de pagar proveedores.
- Listo para conectar Resend/Twilio/Meta cuando la UI esté validada (el modelo de datos ya lo soporta).

---

## Qué

### Criterios de Éxito

- [ ] En `/sala/reservas` existe una sub-vista "Links de reserva" (icono ⚙️ → "Links de reserva") con tabla de `reserva_links` (palabra clave, URL generada, activo, creado, copiar al portapapeles).
- [ ] El formulario "Nuevo link" acepta solo `[A-Z0-9_]` (uppercase forzado), valida UNIQUE por empresa en cliente y servidor, y genera `https://sistema.balleshosteleros.com/reservar?o=PALABRA`.
- [ ] La tabla `reservas` tiene columna `origen TEXT NULL` (nullable, sin FK para no acoplar — el link puede borrarse y la reserva conserva la traza histórica).
- [ ] La ruta pública `/reservar?o=XXX` (sin auth, mismo patrón que `/v/[slug]` y `/inspectores/[token]`) crea la reserva con `origen=XXX` cuando el querystring está presente. Sin querystring funciona igual pero deja `origen=NULL`.
- [ ] `ReservasView` muestra una columna "Origen" (badge con la palabra clave) y un filtro en toolbar "Filtrar por origen" (select multi). El filtro se persiste vía `user_view_preferences`.
- [ ] `/marketing/campanas` ya NO muestra `CampanasDashboardView`. Muestra una nueva vista con BARRA HORIZONTAL 1 con 5 botones-pill en orden: **EMAIL · WHATSAPP · SMS · META · GOOGLE**.
- [ ] Pulsar EMAIL/WHATSAPP/SMS navega a `/marketing/campanas/{canal}` con listado tabla configurado con `SubmoduleToolbar` + `ResizableColumnsProvider` + `TableColumnHeader`. Columnas: Nombre · Enviados · Abiertos · Tasa apertura · Reservas generadas · Estado · Última ejecución.
- [ ] Pulsar META o GOOGLE abre un modal "Próximamente" (sin lógica, sin ruta).
- [ ] La columna "Reservas generadas" se calcula server-side con `SELECT count(*) FROM reservas WHERE origen = $palabra_clave AND empresa_id = $empresaId` (join por `reserva_link_id` → `palabra_clave`).
- [ ] El editor de campaña (Sheet/Dialog lateral) tiene: nombre, mensaje, media (URLs JSONB), selector "Link de reserva" (dropdown de `reserva_links` activos + opción "+ Crear nuevo" inline), banner de recomendaciones por canal, recurrencia (una vez / diaria / semanal / mensual) y segmentación dinámica con vista previa.
- [ ] La segmentación dinámica permite combinar: `ultima_visita_hace_dias` (7/30/90/365 o "sin visitar > N días"), `clasificacion IN (VIP, FRECUENTE, NUEVO, INACTIVO)`, `visitas >= N`, con operadores AND/OR. Vista previa = "Coinciden 47 clientes" calculada server-side al cambiar el filtro (debounced 400ms).
- [ ] El botón "Crear campaña" está **deshabilitado** hasta que todos los campos requeridos del canal estén rellenos (nombre, mensaje, link de reserva seleccionado, segmento con al menos 1 cliente). Aplica regla [Datos completos obligatorio](feedback_datos_completos_obligatorio.md).
- [ ] El botón "Enviar" muestra aviso visible "Modo demo — sin envío real" y al pulsarlo: (a) inserta N filas en `campanas_envios` (una por destinatario) con `estado='enviado'`, (b) actualiza la campaña con `ultima_ejecucion = now()`, (c) NO llama a Resend/Twilio/WhatsApp/etc.
- [ ] RLS de las nuevas tablas usa `empresas_del_usuario()` (multi-tenant). Verificado vía SELECT/INSERT con dos usuarios de empresas distintas.
- [ ] `npm run typecheck` y `npm run build` pasan limpios.

### Comportamiento Esperado

**Happy path Jefe de Sala (crear link y verlo en una reserva):**
1. María (Jefe de Sala) entra a `/sala/reservas`, abre el icono ⚙️ del SubmoduleToolbar y elige "Links de reserva".
2. Crea el link `INSTAGRAM_MAYO` → sistema valida formato, persiste con UNIQUE por empresa, genera `https://sistema.balleshosteleros.com/reservar?o=INSTAGRAM_MAYO` y muestra botón "Copiar".
3. Vuelve a la vista de reservas. Cuando un cliente abre el link público y reserva mesa, la fila aparece con badge azul "INSTAGRAM_MAYO" en la nueva columna "Origen".
4. María filtra por "Origen = INSTAGRAM_MAYO" y exporta el listado.

**Happy path Marketing (crear campaña Email demo):**
1. Iván (Director) entra a `/marketing/campanas`. Ve la BARRA HORIZONTAL 1: `EMAIL · WHATSAPP · SMS · META · GOOGLE`.
2. Pulsa EMAIL → listado vacío. Pulsa `+ Nuevo` → se abre Sheet lateral.
3. Rellena nombre "Reactivación 30d", asunto, mensaje con `{{nombre}}`. En "Link de reserva" elige `EMAIL_REACTIVACION` (creado on-the-fly desde el dropdown).
4. En "Segmentación" combina: `clasificacion=INACTIVO` AND `ultima_visita_hace_dias > 30`. La vista previa muestra "Coinciden 47 clientes".
5. Recurrencia: "una vez". Banner: "Asunto óptimo <50 caracteres (vas por 32)".
6. Pulsa "Crear campaña" → fila en `campanas_email` (canal=email en `campanas_marketing`) con `reserva_link_id` y `segmento_json` poblados.
7. Pulsa "Enviar (modo demo)" → toast "Enviada en modo demo a 47 destinatarios", se insertan 47 filas en `campanas_envios` con `estado='enviado'`, columna "Enviados" pasa a 47, "Última ejecución" se actualiza.

**Atribución (cierre del ciclo):**
8. 3 días después, 5 de esos clientes hacen click y reservan vía `/reservar?o=EMAIL_REACTIVACION`. En el listado de campañas, "Reservas generadas" muestra 5.

**Edge cases:**
- Palabra clave ya existe en la misma empresa → server rechaza con 409 y UI muestra "Ya existe un link con ese nombre".
- Palabra clave en minúsculas o con espacios → UI fuerza uppercase y bloquea espacios; server valida regex `^[A-Z0-9_]+$`.
- Link borrado (soft `activo=false`) → ya NO aparece en el dropdown del editor, pero las reservas históricas conservan el badge con la palabra.
- `/reservar?o=BASURA_NO_EXISTE` → la página pública igual permite reservar; el `origen` queda persistido aunque ya no exista el link (sirve para detectar links viejos compartidos por error).
- Segmento que coincide con 0 clientes → vista previa "0 clientes" y botón "Crear" deshabilitado.

---

## Contexto

### Referencias del codebase

- `src/features/marketing/components/campanas/CampanasDashboardView.tsx` — vista actual que se reemplaza. Mantener componentes auxiliares (`StatCard`, `ModuleCard`) si sirven para las cards de stats internas.
- `src/features/marketing/components/campanas/CampanasEmailView.tsx`, `CampanasWhatsAppView.tsx`, `CampanasMetaView.tsx` — listados actuales por canal. El listado nuevo seguirá una estructura similar pero migrado a `SubmoduleToolbar + ResizableColumnsProvider + TableColumnHeader`.
- `src/features/marketing/data/campanas.ts` — tipos `CampanaEmail`, `CampanaWhatsApp`, `CampanaMeta`. **Crear** `CampanaSms`. Añadir a todos: `reservaLinkId`, `mediaUrls`, `recurrenciaCron`, `segmentoJson`, `ultimaEjecucion`.
- `src/features/marketing/actions/campanas-actions.ts` — server actions ya conectadas a tabla `campanas_marketing` (payload JSONB único). Estrategia: **reutilizar la misma tabla** y añadir columnas top-level (`reserva_link_id`, `recurrencia_cron`, `segmento_json`, `media_urls`, `ultima_ejecucion`). Evita duplicar 3 tablas por canal.
- `src/features/marketing/io/campanas.io.ts` — IO de import/export. Añadir `reservaLinkId` y `reservasGeneradas` (read-only).
- `src/features/marketing/hooks/useCampanas.ts` — hook existente.
- `src/features/sala/components/ReservasView.tsx` — añadir columna "Origen" + filtro toolbar.
- `src/features/sala/actions/reservas-actions.ts` — `createReserva` debe aceptar `origen?: string | null` y persistirlo.
- `src/features/sala/data/clientes.ts` + `src/features/sala/actions/clientes-actions.ts` — fuente para la segmentación. La tabla real es `clientes_sala` (`empresa_id, clasificacion, visitas, ultima_visita`).
- `src/shared/components/SubmoduleToolbar.tsx` — patrón obligatorio para los listados nuevos.
- `src/shared/components/ResizableColumns.tsx`, `src/shared/components/TableColumnHeader.tsx` — columnas redimensionables y header con sort.
- `src/features/logistica/components/ProductosView.tsx` — **referencia viva** de la configuración base universal de submódulo (memoria `feedback_configuracion_base_submodulo`).
- `src/app/v/[slug]/page.tsx` — patrón de ruta pública sin auth con metadata y `force-dynamic`. Replicar en `/reservar/page.tsx`.
- `src/app/api/visita/lead/route.ts` y `src/app/api/inspectores/[token]/route.ts` — patrón de endpoints públicos con validación Zod y rate-limit. Útil si la reserva pública pasa por API.
- `src/lib/seeds/` + `syncSeedsToAllEmpresas` — NO aplica aquí (no hay seeds canónicos: cada empresa crea sus propios links).
- `supabase/migrations/_DEMO_BUNDLE.sql:6837` — definición actual de `campanas_marketing` (tabla única con `payload JSONB`). **Las nuevas columnas son ALTER ADD COLUMN, no nueva tabla por canal.**

### Decisiones de arquitectura

1. **Tabla única `campanas_marketing` (ya existe)**, no 4 tablas separadas. El canal se discrimina por `canal` y la config específica vive en `payload`. Las nuevas columnas (`reserva_link_id`, `recurrencia_cron`, `segmento_json`, `media_urls`, `ultima_ejecucion`) son top-level porque se consultan/filtran/joinean. SMS es un nuevo valor del enum `canal_campana`.
2. **`reservas.origen` es TEXT (no FK)**: el link puede borrarse y la traza histórica se conserva. La atribución se calcula por igualdad de string: `WHERE origen = palabra_clave`. UNIQUE de `palabra_clave` por empresa garantiza que no haya colisiones.
3. **`campanas_envios` es una fila por destinatario**: permite reconstruir analytics granulares (quién abrió, quién no) cuando se conecten proveedores reales. En v1 solo se usa para contar enviados.
4. **Segmentación como JSON estructurado** (`segmento_json`), no string. Permite evaluar server-side, versionar el segmento histórico de la campaña, y migrar a una UI de segmentos guardados sin romper datos.
5. **Modo demo en v1**: la columna `payload.demo_mode = true` por defecto. Cuando se conecten Resend/Twilio se pondrá a false. El botón Enviar siempre persiste `campanas_envios`; solo el efecto secundario (llamada al proveedor) está gated por el flag.
6. **Ruta pública `/reservar`** (no `/r/[slug]` ni `/api/reservar`): el querystring `?o=XXX` es legible, compartible y compatible con el formato pedido. La page renderiza un formulario simple (cliente, teléfono, fecha, hora, personas) y al submit llama a una server action que valida y persiste con `origen`.
7. **Meta y Google solo botones**: no añadir rutas ni componentes. Modal "Próximamente" reutilizable (componente `<ProximamenteDialog canal="meta" />`).

### Modelo de datos

```sql
-- ============================================================
-- 1. RESERVA LINKS (nueva tabla, multi-tenant)
-- ============================================================
create table if not exists public.reserva_links (
  id              uuid primary key default gen_random_uuid(),
  empresa_id      uuid not null references public.empresas(id) on delete cascade,
  palabra_clave   text not null check (palabra_clave ~ '^[A-Z0-9_]+$'),
  url_generada    text not null,
  activo          boolean not null default true,
  creado_por      uuid references auth.users(id),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (empresa_id, palabra_clave)
);

create index if not exists idx_reserva_links_empresa
  on public.reserva_links (empresa_id) where activo;

alter table public.reserva_links enable row level security;

-- RLS multi-tenant (memoria: empresas_del_usuario)
create policy reserva_links_select on public.reserva_links
  for select using (empresa_id in (select empresas_del_usuario()));
create policy reserva_links_insert on public.reserva_links
  for insert with check (empresa_id in (select empresas_del_usuario()));
create policy reserva_links_update on public.reserva_links
  for update using (empresa_id in (select empresas_del_usuario()));
create policy reserva_links_delete on public.reserva_links
  for delete using (empresa_id in (select empresas_del_usuario()));

-- ============================================================
-- 2. RESERVAS — añadir columna origen
-- ============================================================
alter table public.reservas
  add column if not exists origen text;

create index if not exists idx_reservas_origen
  on public.reservas (empresa_id, origen) where origen is not null;

-- ============================================================
-- 3. CAMPANAS_MARKETING — añadir columnas
-- ============================================================
-- Extender enum canal_campana con 'sms'
alter type public.canal_campana add value if not exists 'sms';

alter table public.campanas_marketing
  add column if not exists reserva_link_id uuid references public.reserva_links(id) on delete set null,
  add column if not exists recurrencia_cron text,        -- null=una vez, '0 9 * * *', etc.
  add column if not exists segmento_json jsonb not null default '{}'::jsonb,
  add column if not exists media_urls jsonb not null default '[]'::jsonb,
  add column if not exists ultima_ejecucion timestamptz,
  add column if not exists demo_mode boolean not null default true;

create index if not exists idx_campanas_reserva_link
  on public.campanas_marketing (reserva_link_id) where reserva_link_id is not null;

-- ============================================================
-- 4. CAMPANAS_ENVIOS (nueva tabla, 1 fila por destinatario)
-- ============================================================
create table if not exists public.campanas_envios (
  id              uuid primary key default gen_random_uuid(),
  campana_id      uuid not null references public.campanas_marketing(id) on delete cascade,
  empresa_id      uuid not null references public.empresas(id) on delete cascade,
  cliente_id      uuid references public.clientes_sala(id) on delete set null,
  destinatario    text,                                  -- email/teléfono snapshot
  estado          text not null default 'pendiente'      -- pendiente|enviado|abierto|fallido
                   check (estado in ('pendiente','enviado','abierto','fallido')),
  enviado_en      timestamptz,
  abierto_en      timestamptz,
  proveedor_id    text,                                  -- id externo (resend/twilio) cuando se conecte
  error           text,
  created_at      timestamptz not null default now()
);

create index if not exists idx_envios_campana on public.campanas_envios (campana_id);
create index if not exists idx_envios_empresa on public.campanas_envios (empresa_id);

alter table public.campanas_envios enable row level security;
create policy envios_select on public.campanas_envios
  for select using (empresa_id in (select empresas_del_usuario()));
create policy envios_insert on public.campanas_envios
  for insert with check (empresa_id in (select empresas_del_usuario()));
create policy envios_update on public.campanas_envios
  for update using (empresa_id in (select empresas_del_usuario()));

-- ============================================================
-- 5. View de atribución (para columna "Reservas generadas")
-- ============================================================
create or replace view public.v_campanas_atribucion as
select
  c.id as campana_id,
  c.empresa_id,
  c.nombre,
  c.canal,
  c.estado,
  c.ultima_ejecucion,
  rl.palabra_clave as origen,
  (select count(*) from public.campanas_envios e
    where e.campana_id = c.id and e.estado in ('enviado','abierto')) as enviados,
  (select count(*) from public.campanas_envios e
    where e.campana_id = c.id and e.estado = 'abierto') as abiertos,
  (select count(*) from public.reservas r
    where r.empresa_id = c.empresa_id
      and r.origen = rl.palabra_clave) as reservas_generadas
from public.campanas_marketing c
left join public.reserva_links rl on rl.id = c.reserva_link_id;

-- (la view hereda RLS de las tablas subyacentes vía security_invoker)
alter view public.v_campanas_atribucion set (security_invoker = on);

notify pgrst, 'reload schema';
```

### Arquitectura propuesta (Feature-First)

```
src/
├── app/
│   ├── reservar/
│   │   └── page.tsx                                  # Ruta pública SSR, ?o=XXX persiste origen
│   ├── api/
│   │   └── reservar/
│   │       └── route.ts                              # POST: crear reserva pública con origen
│   └── (main)/
│       ├── marketing/campanas/
│       │   ├── page.tsx                              # Reemplaza CampanasDashboardView
│       │   ├── email/page.tsx                        # Listado (ya existe, migrar a SubmoduleToolbar)
│       │   ├── whatsapp/page.tsx                     # Idem
│       │   └── sms/page.tsx                          # Nuevo (mismo patrón)
│       └── sala/reservas/
│           └── page.tsx                              # ReservasView ya monta sub-vistas
│
├── features/
│   ├── marketing/
│   │   ├── components/campanas/
│   │   │   ├── CampanasHubView.tsx                   # NUEVO: BARRA HORIZONTAL 1 (5 canales)
│   │   │   ├── CampanasListadoView.tsx               # NUEVO: listado genérico por canal
│   │   │   ├── CampanaEditorSheet.tsx                # NUEVO: drawer editor (los 4 tabs internos)
│   │   │   ├── editor/
│   │   │   │   ├── EditorBasico.tsx                  # nombre, mensaje, media
│   │   │   │   ├── EditorLinkReserva.tsx             # dropdown + crear inline
│   │   │   │   ├── EditorSegmento.tsx                # builder dinámico + preview
│   │   │   │   ├── EditorRecurrencia.tsx             # una vez/diaria/semanal/mensual
│   │   │   │   └── BannerRecomendaciones.tsx         # tips por canal
│   │   │   └── ProximamenteDialog.tsx                # Meta/Google placeholder
│   │   ├── actions/
│   │   │   ├── campanas-actions.ts                   # extender: crear/listar con nuevas cols
│   │   │   ├── envios-actions.ts                     # NUEVO: enviar (demo) → campanas_envios
│   │   │   └── segmento-actions.ts                   # NUEVO: previewSegmento(json) → count
│   │   ├── lib/
│   │   │   └── segmento-resolver.ts                  # AST JSON → query Supabase
│   │   └── data/
│   │       └── campanas.ts                           # extender tipos + crear CampanaSms
│   │
│   └── sala/
│       ├── components/
│       │   ├── ReservasView.tsx                      # + columna Origen + filtro
│       │   └── reservas/
│       │       └── LinksReservaPanel.tsx             # NUEVO: sub-vista links
│       ├── actions/
│       │   ├── reservas-actions.ts                   # createReserva acepta origen
│       │   └── reserva-links-actions.ts              # NUEVO: CRUD reserva_links
│       └── data/
│           └── reserva-links.ts                      # NUEVO: tipos + validación palabra_clave
│
└── features/reservar-publica/                        # NUEVO: feature de la ruta pública
    ├── components/
    │   └── ReservaPublicaForm.tsx
    ├── actions/
    │   └── crear-reserva-publica.ts                  # server action con origen
    └── types/
        └── reserva-publica.ts
```

---

## Blueprint (Assembly Line)

> IMPORTANTE: Solo se definen FASES. Las subtareas se generan al entrar a cada fase siguiendo el bucle agéntico (mapear contexto → generar subtareas → ejecutar). El orden está optimizado para que cada fase compile/typecheck por sí sola.

### Fase 1: Migración BD y tipos

**Objetivo**: Esquema listo + tipos TS regenerados. Sin UI todavía.
**Alcance**:
- Migración SQL con todo el bloque del modelo de datos (tabla `reserva_links`, alter `reservas`, alter `campanas_marketing`, tabla `campanas_envios`, enum `sms`, view `v_campanas_atribucion`).
- Política RLS verificada con `mcp__supabase__get_advisors`.
- Regenerar `src/lib/supabase/types.ts` con `mcp__supabase__generate_typescript_types`.
- Extender `src/features/marketing/data/campanas.ts`: añadir `CampanaSms`, añadir campos comunes (`reservaLinkId`, `mediaUrls`, `recurrenciaCron`, `segmentoJson`, `ultimaEjecucion`, `demoMode`) a las 4 interfaces.

**Validación**:
- `mcp__supabase__list_tables` muestra `reserva_links`, `campanas_envios`.
- `mcp__supabase__execute_sql` con `select 'sms'::canal_campana` retorna sin error.
- `mcp__supabase__get_advisors` sin warnings de RLS.
- `npm run typecheck` pasa.

### Fase 2: CRUD de Links de Reserva (`reserva_links`)

**Objetivo**: Jefe de Sala puede crear, listar, activar/desactivar y copiar links desde una sub-vista en `/sala/reservas`.
**Alcance**:
- `src/features/sala/actions/reserva-links-actions.ts`: `listReservaLinks`, `createReservaLink` (valida regex + UNIQUE), `toggleReservaLink`, `deleteReservaLink`.
- Validación Zod (regex `^[A-Z0-9_]+$`, máx 32 chars).
- `src/features/sala/components/reservas/LinksReservaPanel.tsx`: tabla con columnas (palabra, URL, activo, creado, acciones). Botón "Copiar URL" usa `navigator.clipboard`.
- Integración en `ReservasView`: añadir entrada en el menú ⚙️ del SubmoduleToolbar (o tab interno) que monta `LinksReservaPanel`.

**Validación**:
- Crear link `TEST_2026` desde la UI → aparece fila en `reserva_links` con `empresa_id` correcto.
- Intentar crear `TEST_2026` de nuevo → toast error "Ya existe".
- Intentar crear `test 2026` (minúsculas + espacio) → UI bloquea, server rechaza.
- Como usuario de otra empresa, no se ve el link de la primera (RLS).

### Fase 3: Ruta pública `/reservar?o=XXX`

**Objetivo**: Cliente abre el link desde Email/WhatsApp/SMS, reserva mesa, y la fila queda con `origen=PALABRA`.
**Alcance**:
- `src/app/reservar/page.tsx`: server component con `searchParams.o`, valida que existe link activo o deja `origen` pasar tal cual (decisión: registrar siempre, aunque el link ya no exista, para no perder rastro). Renderiza `<ReservaPublicaForm origen={o ?? null} empresaSlug={...resolver...} />`.
- Estrategia para resolver empresa: el querystring `?o=XXX` debe buscar la primera empresa cuyo `palabra_clave=XXX` esté activa. **Si `o` no existe o no resuelve empresa**, la página pide elegir empresa (futuro) — en v1 muestra "Link no válido". Documentar como gotcha.
- `src/app/api/reservar/route.ts` o server action en `src/features/reservar-publica/actions/`: POST público con Zod (nombre, teléfono, fecha, hora, personas, origen, empresa_id). Inserta en `reservas` con service role (RLS bypass justificado: ruta pública sin sesión). Rate-limit básico por IP (memoria existente del cron de visita).
- Estilo: minimalista, mobile-first, reusa tokens del design system. Sin login.

**Validación**:
- Abrir `/reservar?o=INSTAGRAM_MAYO` → carga form. Submit → fila en `reservas` con `origen='INSTAGRAM_MAYO'`.
- Abrir `/reservar` sin querystring → form igual, fila queda con `origen=NULL`.
- Submit con datos inválidos → 400 con mensaje Zod.

### Fase 4: Columna "Origen" + filtro en ReservasView

**Objetivo**: Jefe de Sala ve y filtra reservas por origen en `/sala/reservas`.
**Alcance**:
- Añadir columna "Origen" en la tabla (badge con palabra_clave o "—").
- Filtro en la fila secundaria del toolbar: multi-select de orígenes presentes en las reservas del rango actual. Persistir vía `user_view_preferences`.
- `listReservas` actualizado para devolver `origen` (ya viene en `select *`, solo mapear).

**Validación**:
- Reserva creada en Fase 3 aparece con badge "INSTAGRAM_MAYO".
- Filtrar por "INSTAGRAM_MAYO" reduce la tabla. Refrescar página → filtro persiste.

### Fase 5: Hub de Campañas (BARRA HORIZONTAL 1 con 5 canales)

**Objetivo**: `/marketing/campanas` muestra la barra de canales. Email/WhatsApp/SMS llevan al listado. Meta/Google abren modal "Próximamente".
**Alcance**:
- Crear `CampanasHubView.tsx`: header con título "Campañas" (sin subtítulo duplicado, regla memoria) y BARRA HORIZONTAL 1 con 5 pills (icono + label). Cada pill es `<Link>` excepto Meta/Google que disparan `<ProximamenteDialog>`.
- `src/app/(main)/marketing/campanas/page.tsx`: reemplazar import de `CampanasDashboardView` por `CampanasHubView`.
- `CampanasDashboardView.tsx`: marcar como deprecated o eliminar (decisión en la fase: si no se usa en otro sitio, eliminar; el código relevante de stats migra al listado por canal en Fase 6).

**Validación**:
- `/marketing/campanas` muestra los 5 botones en orden EMAIL · WHATSAPP · SMS · META · GOOGLE.
- Click en META → modal "Próximamente". Click en EMAIL → navega a `/marketing/campanas/email`.

### Fase 6: Listado canónico por canal (`SubmoduleToolbar + ResizableColumns + TableColumnHeader`)

**Objetivo**: Los 3 listados (email/whatsapp/sms) usan la configuración base universal de submódulo y muestran las 7 columnas pedidas.
**Alcance**:
- `CampanasListadoView.tsx`: componente genérico parametrizado por `canal: 'email'|'whatsapp'|'sms'`.
- Columnas: Nombre, Enviados (de `v_campanas_atribucion.enviados`), Abiertos, Tasa apertura (`abiertos/enviados * 100`), Reservas generadas (de view), Estado (badge), Última ejecución (relativa).
- Botón `+ Nuevo` abre `CampanaEditorSheet` con `canal` precargado.
- Migrar `CampanasEmailView`, `CampanasWhatsAppView` para usar el genérico. Crear `CampanasSmsView`.
- Crear ruta `src/app/(main)/marketing/campanas/sms/page.tsx`.

**Validación**:
- Las 3 rutas renderizan tabla con columnas redimensionables, sort funcional, y persistencia de visibilidad de columnas vía `user_view_preferences`.
- Crear campaña dummy desde la fase 7 (mock) → aparece en la tabla con valores correctos.

### Fase 7: Editor de Campaña (Sheet)

**Objetivo**: Crear/editar campaña con todos los campos del scope, validación bloqueante hasta datos completos.
**Alcance**:
- `CampanaEditorSheet.tsx`: Sheet lateral con secciones (acordeón o tabs):
  1. Básico (nombre, mensaje, media — upload a Supabase Storage bucket `campanas-media`).
  2. Link de reserva (dropdown desde `reserva_links` activos + opción "+ Crear nuevo" que abre mini-dialog y crea inline; tras crear refresca dropdown y selecciona).
  3. Recurrencia (radio: una vez / diaria / semanal / mensual → genera `recurrencia_cron` o null).
  4. Segmentación (builder visual usando `EditorSegmento`).
- `BannerRecomendaciones`: tips contextuales por canal con contadores en vivo:
  - Email: asunto < 50 caracteres (rojo si supera).
  - SMS: 160 caracteres totales, sin emojis (rojo si supera o detecta emoji).
  - WhatsApp: plantilla aprobada (input nombre plantilla), mensaje corto.
- Validación bloqueante: botón "Crear campaña" deshabilitado hasta que `nombre + mensaje + reservaLinkId + segmento.coincidencias > 0` estén OK. Reutilizar patrón de `feedback_datos_completos_obligatorio`.
- Persistencia: `createCampanaAction` (extiende la actual) acepta los nuevos campos.

**Validación**:
- Crear campaña Email con todo relleno → fila en `campanas_marketing` con `canal=email`, `reserva_link_id` correcto, `segmento_json` poblado.
- Dejar segmento en blanco → botón gris, tooltip "Define un segmento con al menos 1 cliente".
- Asunto de 60 caracteres en Email → banner rojo, botón sigue habilitado (es warning no bloqueo).

### Fase 8: Segmentación dinámica + preview

**Objetivo**: Builder visual genera `segmento_json` AST. Preview muestra "Coinciden N clientes" debounced.
**Alcance**:
- `EditorSegmento.tsx`: UI tipo query builder simple. Reglas disponibles:
  - `ultima_visita_hace_dias` (`<=` 7/30/90/365)
  - `sin_visitar_desde_dias` (`>` N)
  - `clasificacion` (`IN [VIP, FRECUENTE, NUEVO, INACTIVO]` multi-select)
  - `visitas_min` (`>=` N)
- Botón `+ Añadir condición`. Operador entre condiciones: AND/OR (toggle global, no por par para simplificar v1).
- `segmento-resolver.ts`: traduce AST JSON a query Supabase sobre `clientes_sala` (`.gte('ultima_visita', ...).in('clasificacion', ...)`).
- `previewSegmentoAction`: recibe `segmento_json`, devuelve `count`. Debounced 400ms en el cliente.
- Mostrar "Coinciden N clientes" + ejemplos (primeros 5 nombres opcionales).

**Validación**:
- Segmento `clasificacion=INACTIVO AND ultima_visita_hace_dias > 30`: contador refleja el `SELECT count(*)` real de Supabase.
- Cambiar a `clasificacion=VIP`: contador recalcula.
- Cero coincidencias → contador "0" + botón Crear deshabilitado.

### Fase 9: Envío en modo demo (`campanas_envios`)

**Objetivo**: Botón "Enviar" persiste filas en `campanas_envios` y actualiza KPIs, sin proveedor externo.
**Alcance**:
- `envios-actions.ts`: `enviarCampanaDemoAction(campanaId)`:
  1. Resuelve segmento → lista de `cliente_id` (de `clientes_sala`).
  2. INSERT batch en `campanas_envios` (una fila por cliente) con `estado='enviado'`, `enviado_en=now()`, `destinatario` snapshot (email o telefono según canal).
  3. UPDATE `campanas_marketing` `ultima_ejecucion=now()`, `estado='finalizada'` si recurrencia=una vez.
- En el editor y en el listado: botón "Enviar" con tooltip "Modo demo — sin envío real". Banner amarillo visible permanente en el editor.
- Actualizar contadores en la columna "Enviados" del listado (vía view `v_campanas_atribucion`).

**Validación**:
- Crear campaña con segmento de 5 clientes → pulsar Enviar → 5 filas en `campanas_envios`, columna "Enviados" pasa a 5.
- Botón muestra aviso amarillo "Modo demo".
- No hay llamadas a Resend/Twilio (verificar con grep en código que el flag `demo_mode` cortocircuita las llamadas reales en `campanas-actions.ts`).

### Fase 10: Atribución end-to-end + QA

**Objetivo**: Cerrar el ciclo. Una reserva creada vía `/reservar?o=X` aparece como "Reservas generadas" en la campaña asociada al link X.
**Alcance**:
- Verificar que la columna "Reservas generadas" del listado lee de `v_campanas_atribucion.reservas_generadas`.
- Test manual completo:
  1. Crear link `QA_2026_PRP046` en `/sala/reservas`.
  2. Crear campaña Email asociada a `QA_2026_PRP046` (segmento 1 cliente, demo enviar).
  3. Abrir `/reservar?o=QA_2026_PRP046` en otra pestaña, crear 2 reservas.
  4. Volver a `/marketing/campanas/email` → ver "Reservas generadas: 2".
  5. Filtrar `/sala/reservas` por origen `QA_2026_PRP046` → ver las 2 reservas.
- Cleanup de `CampanasDashboardView` si quedó sin usar.
- Actualizar memoria del proyecto: añadir `project_campanas_atribucion_origen.md` resumen.

**Validación**:
- Flujo completo descrito pasa sin errores.
- `npm run typecheck` y `npm run build` limpios.
- Playwright CLI: navegar el flujo end-to-end y capturar screenshot por fase.
- `mcp__supabase__get_advisors` sin nuevos warnings.

---

## Gotchas

- [ ] **`alter type ... add value`** no es transaccional en Postgres antes de 12.x y aun en 14+ tiene caveats: ejecutarlo en una migración separada del primer `INSERT` que use el valor (o usar `COMMIT;` intermedio). Aquí no aplica si todo va en un migration file ejecutado en autocommit, pero documentar.
- [ ] **Empresa en `/reservar?o=XXX`**: el querystring solo lleva la palabra_clave, no la empresa. Como `palabra_clave` es UNIQUE por empresa (no global), dos empresas pueden tener `INSTAGRAM`. La query `where palabra_clave='INSTAGRAM'` sin filtrar empresa devolvería múltiples filas. Solución v1: en `reserva_links` añadir `unique(palabra_clave)` global temporalmente, o resolver siempre la primera. Mejor: el link generado lleva el slug en el path → `/reservar/{empresaSlug}?o=X`. **Decidir en Fase 3** antes de codear. Recomendación: usar `/reservar?o=XXX&e={empresaSlug}` para no perder compatibilidad con el formato pedido.
- [ ] **RLS en `campanas_envios`**: el INSERT batch desde server action lo hace el usuario autenticado → la política de `with check (empresa_id in (select empresas_del_usuario()))` lo permite. No usar service role salvo necesidad.
- [ ] **View `v_campanas_atribucion` con security_invoker**: necesario en Postgres 15+ para que la RLS de tablas subyacentes aplique. Verificar que la versión de Supabase del proyecto lo soporta (sí, está en 15+).
- [ ] **`canal_campana` enum y `sms`**: si no existe el type aún (definido en `_DEMO_BUNDLE.sql`), no se puede hacer `add value`. Verificar primero con `mcp__supabase__execute_sql` `select 1 from pg_type where typname='canal_campana'`. Si no existe, crear el type completo `('email','whatsapp','sms','meta')`.
- [ ] **Recurrencia v1**: solo guardar `recurrencia_cron`, NO programar realmente (no hay scheduler en v1). El listado mostrará "Programada" pero no se autoejecuta. Documentar para no crear expectativa falsa.
- [ ] **Media uploads**: bucket `campanas-media` debe crearse con política de lectura pública si las imágenes irán en Emails/WhatsApp. Confirmar en Fase 7 antes de implementar.
- [ ] **Sustituir `CampanasDashboardView`** no debe romper imports en otros sitios (calendario marketing, dashboards directivos). Hacer grep antes de eliminar.
- [ ] **`reservas.empresa_id` es TEXT en `_DEMO_BUNDLE`** (no UUID con FK). La migración debe respetar ese tipo o introducir el cast. Verificar en Fase 1.
- [ ] **Datos completos obligatorio**: el botón "Crear" deshabilitado, NO "Guardar borrador habilitado". El editor en v1 no tiene borrador; todo o nada.

## Anti-Patrones

- NO crear 3 tablas separadas (`campanas_email`, `campanas_whatsapp`, `campanas_sms`). Reutilizar `campanas_marketing` con `payload` + columnas top-level.
- NO meter `origen` como FK a `reserva_links`. La traza histórica debe sobrevivir a borrados de links.
- NO conectar Resend/Twilio/WhatsApp en v1. El flag `demo_mode=true` es la fuente de verdad.
- NO usar campos `_text` ni helpers RLS legacy. Usar `empresas_del_usuario()` (UUID) sí o sí (memoria).
- NO renderizar el editor como página completa. Es Sheet/Drawer lateral que conserva el listado al fondo.
- NO ocultar el aviso "Modo demo": debe ser un banner visible en el editor y un tooltip en el botón Enviar de la lista.
- NO añadir filtros/toggles a la BARRA HORIZONTAL 1: los 5 canales son botones, los filtros van en fila aparte si hacen falta (memoria).
- NO autopurgar `reserva_links`. Soft delete con `activo=false` solo.
- NO permitir `palabra_clave` con espacios, minúsculas o caracteres especiales. UI fuerza uppercase + regex.

---

## Aprendizajes (Self-Annealing / Neural Network)

> Esta sección crece con cada error encontrado durante la implementación.
> El conocimiento persiste para futuros PRPs. El mismo error NUNCA ocurre dos veces.

_(vacío — se rellenará al ejecutar con /bucle-agentico)_

---

*PRP pendiente de aprobación. No se ha modificado código.*
