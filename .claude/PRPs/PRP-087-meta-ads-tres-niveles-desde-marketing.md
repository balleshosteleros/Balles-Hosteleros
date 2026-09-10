# PRP-087 — Meta Ads dentro de Marketing: los tres niveles, desde el software

> **Estado**: APROBADO (07-09-2026) — 4 decisiones cerradas, ver *Decisiones abiertas*
> **Fecha**: 07-09-2026
> **Proyecto**: Balles-Hosteleros
> **Relacionado**: PRP-046 (campañas y atribución), PRP-059 (integraciones self-service por empresa), PRP-086 (redes sociales: perfiles y crecimiento)

---

## Objetivo

Que Marketing → Campañas → Meta sea el **Administrador de anuncios de Meta dentro del software**: ver
la cuenta publicitaria real con sus tres niveles (Campaña → Conjunto de anuncios → Anuncio) leídos de
la Meta Marketing API, y poder crear y lanzar desde aquí campañas con creatividad de imagen, **vídeo o
carrusel**, publicándolas al momento o dejándolas programadas. Cada empresa conecta **su propia** cuenta
de Meta desde Ajustes → Integraciones.

---

## Por Qué

| Problema | Solución |
|----------|----------|
| La publicidad de Facebook e Instagram se lleva fuera del software, en el Administrador de anuncios de Meta. Nadie del equipo sabe qué hay activo, cuánto se está gastando ni qué anuncio funciona. | Los tres niveles se ven dentro del software, con su gasto y sus resultados al lado del resto del marketing. |
| Lo que hoy hay en el software **no sirve**: crea una campaña de un tirón (una campaña, un conjunto, un anuncio) y **no lee nada** de Meta. Lo que ya existe en la cuenta publicitaria es invisible. | La cuenta de Meta pasa a ser la fuente de verdad: se lee y se refleja. El software no inventa un mundo paralelo. |
| Las claves de Meta están en variables de entorno **globales**: una sola cuenta publicitaria para todas las empresas. HABANA no puede tener las suyas y BACANAL las suyas. | Credenciales **por empresa**, cifradas, en Ajustes → Integraciones, como Ágora y Revolut. |
| Solo se puede anunciar con una imagen puesta a mano por URL. El vídeo y el carrusel —lo que de verdad funciona en hostelería— no existen. | Biblioteca de medios propia: imagen, vídeo y carrusel de 2 a 10 tarjetas, subidos a Meta desde aquí. |
| No hay forma de programar: todo nace en pausa y hay que acordarse de activarlo a mano. | Publicación inmediata o programada con la hora de la empresa. |

**Valor de negocio**: el gasto en publicidad deja de ser una caja negra. Se ve el gasto del día y el coste
por resultado de cada anuncio junto a las reservas que entran, y se puede parar un anuncio que quema
dinero sin salir del software ni buscar quién tiene la contraseña del Business Manager.

---

## Qué

### Criterios de Éxito

- [ ] En Ajustes → Integraciones hay una tarjeta **Meta** que pasa a "Conectado" cuando la empresa activa
      guarda su acceso, y las claves quedan **cifradas** y nunca vuelven al navegador.
- [ ] Al conectar, el software **lee de la API** y ofrece a elegir: cuenta publicitaria (`act_…`), página de
      Facebook y cuenta de Instagram vinculada. No se teclea ningún identificador a mano.
- [ ] Marketing → Campañas → Meta enseña **todo lo que hay en la cuenta publicitaria real**, incluidas las
      campañas creadas fuera del software, en árbol de tres niveles con su estado, su presupuesto y sus
      resultados (gasto, alcance, impresiones, clics, coste por resultado).
- [ ] Se puede **activar y pausar** en cualquiera de los tres niveles, y el cambio se ve reflejado en Meta.
- [ ] Se puede **crear una campaña completa** (los tres niveles) desde el software y aparece en el
      Administrador de anuncios de Meta con la misma configuración.
- [ ] Un anuncio se puede montar con **imagen, vídeo o carrusel** (de 2 a 10 tarjetas) partiendo de archivos
      subidos desde el software.
- [ ] Publicar **ahora** deja la campaña activa; **programar** la deja lista y arranca sola a la fecha y hora
      indicadas **en el reloj de la empresa**, no en el del navegador.
- [ ] Ninguna campaña se activa sola: activar es siempre un acto explícito y confirmado, porque gasta dinero real.
- [ ] Las variables de entorno globales `META_*` de publicidad **desaparecen** del código.

### Comportamiento Esperado

**Conectar (una vez por empresa)**
1. Ajustes → Integraciones → tarjeta **Meta** → se pega el acceso del Business Manager.
2. El software prueba la conexión y enseña las cuentas publicitarias, páginas y cuentas de Instagram a las
   que ese acceso llega. Se elige la que corresponde a esta empresa y se guarda.
3. La tarjeta se pone en verde. A partir de ahí, todo lo de Meta trabaja con esas claves y solo para esta empresa.

**Ver (el día a día)**
1. Marketing → Campañas → Meta abre la lista de campañas de la cuenta real, con su estado y lo gastado.
2. Al abrir una campaña se ven sus conjuntos de anuncios (público, presupuesto, fechas) y, dentro de cada
   uno, sus anuncios con la creatividad y sus números.
3. Un botón refresca contra Meta. Un cron lo hace solo cada hora para que la pantalla abra al instante.

**Lanzar**
1. "Nueva campaña" abre un asistente de tres pasos: **qué quieres conseguir** (campaña), **a quién y con
   cuánto** (conjunto), **qué le enseñas** (anuncio).
2. En el anuncio se elige formato: una imagen, un vídeo o un carrusel. Los archivos se suben desde el
   software; el vídeo se sube a Meta y se espera a que quede listo antes de poder publicar.
3. Al final: **Publicar ahora** o **Programar**. Programar pide día y hora, y se avisa de cuánto se va a
   gastar como máximo (presupuesto × días) antes de confirmar.
4. Se crea en Meta y vuelve a la lista, ya con su identificador real.

---

## Contexto

### Lo que ya hay (comprobado en el código)

| Pieza | Estado real |
|---|---|
| `src/features/marketing/services/meta-ads-service.ts` | Traduce a Graph API v19 y crea Campaign + AdSet + AdCreative + Ad de un tirón. Credenciales por **variables de entorno globales** (`META_ACCESS_TOKEN`, `META_AD_ACCOUNT_ID`, `META_PAGE_ID`, `META_INSTAGRAM_ACTOR_ID`). Solo **escribe**; lo único que lee son los insights de una campaña que él mismo creó. |
| `src/features/marketing/components/campanas/CampanasMetaView.tsx` | Tarjetas de campañas **locales** con botón "Sincronizar con Meta". Un solo nivel. Creatividad = una URL de imagen tecleada. Ni vídeo, ni carrusel, ni programación. |
| `src/app/(main)/marketing/campanas/meta/page.tsx` | La ruta existe… |
| `src/features/marketing/components/campanas/CampanasHubView.tsx` | …pero el hub enseña Meta como **"Próx."** y abre `ProximamenteDialog`. Hoy nadie llega a esa pantalla desde el menú. |
| `supabase/migrations/044_marketing_campanas.sql` | Tabla `campanas_marketing` (canal `email`/`whatsapp`/`meta`, `payload` JSONB, columnas `meta_campaign_id`, `meta_adset_id`, `meta_ad_id`, `meta_synced_at`, `meta_sync_error`). Su RLS usa el patrón viejo `profiles.empresa_id`, no `empresas_del_usuario()`. |
| `src/features/marketing/data/campanas.ts` | Tipo `CampanaMeta`: un único bloque plano con objetivo + público + creatividad. No distingue los tres niveles. |

**Conclusión**: lo que hay es un boceto de un solo nivel, con claves globales, que además está desconectado
del menú. No se amplía: se **sustituye** (regla de cero deuda).

### Referencias del propio proyecto (patrones a copiar, no reinventar)

- `src/features/ajustes/components/IntegracionesTab.tsx` — rejilla de tarjetas de integración con distintivo
  verde/rojo y diálogo de configuración. Aquí se añade la tarjeta **Meta**.
- `src/features/ajustes/components/AgoraPanel.tsx` + `src/features/ajustes/actions/agora-integracion-actions.ts`
  — patrón exacto de credencial por empresa: campo **write-only**, "Probar conexión", Zod, escritura por
  cliente admin.
- `supabase/migrations/20260901120000_ticket_compras_revolut.sql` (tabla `empresa_revolut_config`) — patrón de
  tabla dedicada de credenciales por empresa, secretos cifrados, `SELECT` con `empresas_del_usuario()` y
  escritura solo por service role.
- `src/features/accesos/lib/crypto.ts` — `encrypt()` / `decrypt()` AES-256-GCM con `CREDENCIALES_ENCRYPTION_KEY`.
- `src/app/api/cron/marketing-automatizaciones/route.ts` — patrón de cron: `Bearer ${CRON_SECRET}`, `runtime nodejs`,
  registrado en `vercel.json`.
- `src/shared/components/SubmoduleToolbar` — barra horizontal única, con filtro por columna y orden.
- `src/features/marketing/pagina-web/services/asset-upload.ts` (imágenes a Supabase Storage) y
  `src/shared/lib/r2.ts` → `presignPutR2` (vídeo grande directo a R2, sin pasar por la función).

### Referencias externas (Meta Marketing API)

- Graph API `v23.0` (fijar versión en una constante única, no repartida por el código).
- Jerarquía y campos: `/act_{id}/campaigns`, `/act_{id}/adsets`, `/act_{id}/ads`, `/act_{id}/adcreatives`.
- Métricas: `/{nivel_id}/insights` con `fields=spend,impressions,reach,clicks,ctr,cpc,actions,cost_per_action_type`.
- Medios: `POST /act_{id}/adimages` (devuelve `image_hash`), `POST /act_{id}/advideos` (devuelve `video_id`;
  hay que **esperar** a `status.video_status = ready` antes de crear la creatividad).
- Carrusel: `object_story_spec.link_data.child_attachments` (2–10 tarjetas).
- Vídeo: `object_story_spec.video_data` con `video_id` + `image_hash` de la miniatura.
- Descubrimiento de activos al conectar: `/me/adaccounts`, `/me/accounts` (páginas),
  `/{page_id}?fields=instagram_business_account`.
- Permisos necesarios en el acceso: `ads_management`, `ads_read`, `pages_show_list`, `pages_read_engagement`,
  `business_management`, `instagram_basic`.
- Límites: la API tiene cupo por cuenta publicitaria y por app. Toda lectura masiva va por el cron, no por clic.

### Arquitectura Propuesta (Feature-First)

```
src/features/marketing/meta-ads/
├── actions/
│   ├── cuenta-actions.ts          # conectar, probar, listar activos (Ajustes)
│   ├── lectura-actions.ts         # árbol de 3 niveles + insights (desde el espejo)
│   ├── escritura-actions.ts       # crear/editar/activar/pausar en los 3 niveles
│   └── medios-actions.ts          # subir imagen/vídeo a Meta, estado del vídeo
├── components/
│   ├── MetaAdsView.tsx            # pantalla principal: árbol Campaña→Conjunto→Anuncio
│   ├── nivel/{CampanaFila,ConjuntoFila,AnuncioFila}.tsx
│   ├── asistente/{PasoCampana,PasoConjunto,PasoAnuncio,PasoPublicacion}.tsx
│   └── creatividad/{EditorImagen,EditorVideo,EditorCarrusel}.tsx
├── services/
│   ├── meta-client.ts             # fetch firmado, versión de API, reintentos, errores en castellano
│   ├── meta-credenciales.ts       # lee y descifra las claves de la EMPRESA ACTIVA
│   ├── meta-lectura.ts            # trae y normaliza los 3 niveles + insights
│   ├── meta-escritura.ts          # crea/actualiza Campaign / AdSet / Ad / AdCreative
│   ├── meta-medios.ts             # adimages, advideos, espera de proceso, miniatura
│   └── meta-espejo.ts             # vuelca lo leído a las tablas espejo
├── lib/
│   ├── objetivos.ts               # objetivo → optimization_goal / billing_event válidos
│   └── formato.ts                 # céntimos↔euros (coma decimal), fechas dd-mm-aaaa
└── types/index.ts

src/app/(main)/marketing/campanas/meta/page.tsx     # reapuntada a MetaAdsView
src/app/api/cron/meta-ads-sync/route.ts             # refresco horario
src/features/ajustes/components/MetaPanel.tsx       # tarjeta/diálogo en Integraciones
```

### Modelo de Datos

**Credenciales por empresa** (patrón `empresa_revolut_config`):

```sql
create table if not exists public.empresa_meta_config (
  empresa_id            uuid primary key references public.empresas(id) on delete cascade,
  access_token_cifrado  text,              -- nunca viaja al navegador
  ad_account_id         text,              -- act_123456789
  page_id               text,
  instagram_actor_id    text,
  nombre_cuenta         text,              -- para enseñarlo en Ajustes
  moneda                text,              -- la de la cuenta publicitaria (EUR)
  token_expira_at       timestamptz,       -- avisar antes de que caduque
  activo                boolean not null default false,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

alter table public.empresa_meta_config enable row level security;
-- Lectura: usuarios de la empresa. Escritura: solo service role desde las acciones de Ajustes.
create policy empresa_meta_config_select on public.empresa_meta_config
  for select to authenticated
  using (empresa_id in (select public.empresas_del_usuario()));
```

**Espejo de la cuenta publicitaria** (la verdad está en Meta; esto es caché para que la pantalla abra rápido):

```sql
-- Una tabla por nivel, todas con el id REAL de Meta como clave de negocio.
create table if not exists public.meta_campanas (
  id              uuid primary key default gen_random_uuid(),
  empresa_id      uuid not null references public.empresas(id) on delete cascade,
  meta_id         text not null,                 -- id de la campaña en Meta
  nombre          text not null,
  objetivo        text,
  estado          text,                          -- ACTIVE / PAUSED / ARCHIVED…
  estado_efectivo text,                          -- effective_status (lo que Meta aplica de verdad)
  presupuesto_diario_cent  bigint,
  presupuesto_total_cent   bigint,
  creada_en_software boolean not null default false,
  raw             jsonb not null default '{}'::jsonb,
  sincronizado_at timestamptz not null default now(),
  unique (empresa_id, meta_id)
);

create table if not exists public.meta_conjuntos (  -- ad sets
  …igual, más: campana_meta_id text, publico jsonb, inicio_at timestamptz, fin_at timestamptz,
  optimization_goal text, billing_event text
);

create table if not exists public.meta_anuncios (   -- ads
  …igual, más: conjunto_meta_id text, creatividad jsonb, formato text  -- imagen | video | carrusel
);

create table if not exists public.meta_insights (
  empresa_id uuid not null references public.empresas(id) on delete cascade,
  nivel      text not null check (nivel in ('campana','conjunto','anuncio')),
  meta_id    text not null,
  dia        date not null,
  gasto_cent bigint, impresiones bigint, alcance bigint, clics bigint,
  resultados bigint, coste_resultado_cent bigint,
  raw        jsonb not null default '{}'::jsonb,
  primary key (empresa_id, nivel, meta_id, dia)
);

-- Medios subidos desde el software y su equivalente en Meta.
create table if not exists public.meta_medios (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id) on delete cascade,
  tipo text not null check (tipo in ('imagen','video')),
  url_origen text not null,          -- Storage/R2
  image_hash text, video_id text,
  estado text not null default 'subiendo',  -- subiendo | listo | error
  error text,
  created_at timestamptz not null default now()
);
```

Todas con RLS por `empresas_del_usuario()`, y todas con `unique (empresa_id, meta_id)` para que el refresco
sea un `upsert` idempotente y nunca duplique.

**Lo que se retira**: `canal_campana = 'meta'` deja de usarse en `campanas_marketing`; el canal Meta ya no
vive en la tabla multicanal (su modelo no encaja: tres niveles, no uno). Las filas existentes de canal `meta`
se migran o se borran según lo que haya en producción (ver *Gotchas*).

---

## Blueprint (Assembly Line)

> Solo fases. Las subtareas se generan al entrar en cada una con `/bucle-agentico`.

### ✅ Fase 1: Conexión por empresa en Ajustes → Integraciones — HECHA (08-09-2026)
**Objetivo**: tabla `empresa_meta_config`, cifrado del acceso, panel `MetaPanel` en la rejilla de
Integraciones con "Probar conexión", y descubrimiento por API de cuenta publicitaria / página / Instagram
para elegirlas de una lista. Se retiran las variables `META_*` de publicidad.
**Validación**: con la empresa HABANA activa la tarjeta se pone verde y enseña el nombre real de la cuenta;
cambiando a BACANAL vuelve a "Sin conectar". El acceso guardado no aparece en ninguna respuesta al navegador.

### ✅ Fase 2: Cliente de la API y espejo de los tres niveles — HECHA (08-09-2026)
**Objetivo**: `meta-client.ts` (versión de API única, errores traducidos a castellano, reintento con espera
ante cupo agotado) y lectura completa de campañas, conjuntos y anuncios de la cuenta a las tablas espejo,
con paginación. Cron `/api/cron/meta-ads-sync` cada hora en `vercel.json`.
**Validación**: una campaña creada a mano en el Administrador de anuncios de Meta aparece en el espejo tras
una pasada del cron, con su estado y su presupuesto correctos.

### ✅ Fase 3: La pantalla — árbol de tres niveles con sus números — HECHA (08/09-09-2026)
**Objetivo**: `MetaAdsView` sustituye a `CampanasMetaView`. Lista de campañas; al abrir una, sus conjuntos;
al abrir uno, sus anuncios. Cada fila con estado, presupuesto, gasto, alcance, clics y coste por resultado.
Barra de herramientas estándar, filtro por columna, importes con coma decimal y fechas dd-mm-aaaa.
**Validación**: los números de una campaña cuadran con los del Administrador de anuncios de Meta para el
mismo período.

### ✅ Fase 4: Mandar sobre lo que ya existe — HECHA (08/09-09-2026)
**Objetivo**: activar, pausar, renombrar y cambiar presupuesto en los tres niveles, escribiendo en Meta y
refrescando el espejo. Activar pide confirmación explícita (gasta dinero) con el aviso de gasto máximo.
**Validación**: pausar un anuncio desde el software se ve pausado en Meta, y al revés tras el refresco.

### ✅ Fase 5: Asistente de creación de los tres niveles — HECHA (08/09-09-2026)
**Objetivo**: crear campaña, conjunto (público, ubicaciones, edades, intereses, presupuesto diario o total,
fechas) y anuncio, en una sola pasada o por partes (añadir un conjunto a una campaña que ya existe; añadir un
anuncio a un conjunto que ya existe). Validación Zod en cada paso y mapa objetivo → objetivo de optimización
válido, que Meta rechaza si no casa.
**Validación**: la campaña creada desde el software aparece completa en el Administrador de anuncios, con el
mismo público y presupuesto, y en pausa.

### ✅ Fase 6: Creatividades — imagen, vídeo y carrusel — HECHA (08/09-09-2026)
**Objetivo**: biblioteca de medios de la empresa. Imagen → `adimages` (`image_hash`, se acaba la URL suelta).
Vídeo → subida del archivo a Storage/R2 y de ahí a `advideos`, con espera a que Meta lo procese y miniatura.
Carrusel → de 2 a 10 tarjetas con imagen, titular, descripción y enlace propios. Vista previa antes de publicar.
**Validación**: se publica un anuncio de vídeo y uno de carrusel, y ambos se ven correctamente en la vista
previa de Meta.

### ✅ Fase 7: Publicar ahora o programar — HECHA (08/09-09-2026)
**Objetivo**: al terminar el asistente, publicar (queda activa) o programar (fecha y hora **en la zona horaria
de la empresa**, convertida a la que espera Meta). Aviso de gasto máximo antes de confirmar. Estado
"Programada" visible en la lista hasta que arranque.
**Validación**: una campaña programada para dentro de una hora arranca sola y aparece activa; la hora mostrada
coincide con el reloj de la empresa, no con el del navegador.

### ✅ Fase 8: Cerrar la puerta a la deuda — HECHA (08/09-09-2026)
**Objetivo**: borrar `meta-ads-service.ts`, el tipo `CampanaMeta`, `CampanasMetaView`, el `ProximamenteDialog`
para el canal Meta y las variables `META_*`; enlazar Meta de verdad en `CampanasHubView`; dar de alta el
permiso del submódulo en el catálogo de Ajustes y respetarlo sin bypass de administrador.
**Validación**: `grep META_ACCESS_TOKEN src` no devuelve nada; un usuario sin el permiso no ve la pantalla ni
llega por URL directa.

### Fase 9: Validación Final
**Objetivo**: sistema funcionando de punta a punta con las dos empresas.
**Validación**:
- [ ] `npm run typecheck` pasa
- [ ] `npm run build` exitoso
- [ ] Playwright confirma: conectar en Ajustes, ver el árbol, crear con vídeo, programar
- [ ] Criterios de éxito cumplidos

---

## 🧠 Aprendizajes (Self-Annealing)

### 2026-09-08: un archivo "use server" no puede exportar constantes
- **Error**: `cuenta-actions.ts` exportaba `META_STATE_COOKIE` / `META_EMPRESA_COOKIE`. Un módulo con
  `"use server"` solo puede exportar funciones async; cualquier otra exportación revienta la compilación.
- **Fix**: las constantes se mudaron a `lib/meta-api.ts`, y tanto la acción como la ruta de callback las
  importan de allí.
- **Aplicar en**: cualquier acción nueva. Ya estaba anotado en [[feedback_use_server_solo_exporta_funciones_async]].

### 2026-09-08: lucide-react ya no trae iconos de marca
- **Error**: `import { Facebook, Instagram } from "lucide-react"` → *has no exported member*. Los retiraron.
- **Fix**: para Meta se usa el `IntegracionLogo logo="meta"` (SVG propio, añadido en esta fase) y para
  Instagram el icono genérico `AtSign`.
- **Aplicar en**: todo el proyecto — no volver a importar iconos de marca de lucide.

### 2026-09-08: el tope de gasto se garantiza en la BASE DE DATOS, no en el formulario
- **Decisión**: `CHECK (NOT activo OR tope_gasto_mensual_cent > 0)`. Comprobado con una inserción real que
  intentaba activar sin tope: la rechaza Postgres.
- **Por qué**: el tope es dinero. Un formulario se salta; una restricción de la base de datos no.

---

### 2026-09-08: el gasto del mes NO se puede sumar leyendo filas
- **Riesgo detectado antes de que ocurriera**: `select gasto_cent` sobre `meta_insights` para sumar el mes.
  Supabase corta a 1.000 filas ([[project_supabase_tope_1000_filas]]); con 60 campañas por 25 días ya son
  1.500 filas y el gasto habría salido MÁS BAJO del real → el tope de gasto dejaría pasar campañas.
- **Fix**: función `public.meta_gasto_periodo(empresa, desde, hasta)` que suma en Postgres.
- **Comprobado de verdad**: insertadas 1.500 filas de prueba a 100 céntimos → la función devuelve 150.000
  céntimos exactos; filas de prueba borradas después.
- **Aplicar en**: cualquier total de dinero u horas que se calcule sobre una tabla grande. Sumar en la BD.

### 2026-09-09: cortar código con expresiones regulares es peligroso
- **Error**: al retirar `crearCampanaMetaVacia` de `data/campanas.ts` con un `re.search(r"\n\}\n")`, el corte
  de `CTA_META` se llevó media declaración y dejó el archivo sin compilar (`TS1128`).
- **Fix**: comprobado con `git diff` archivo por archivo y rematado a mano.
- **Aplicar en**: cualquier borrado de bloques de código. Recortar por patrón deja restos silenciosos; hay que
  mirar el diff antes de dar por buena la limpieza.

## Gotchas

- [ ] **Nunca gastar dinero real para probar.** Todo se crea en `PAUSED`. Para las pruebas, presupuesto mínimo
      y activación manual y consciente; mejor aún, cuenta publicitaria de pruebas. Activar nunca es un efecto
      secundario de guardar.
- [ ] **La cuenta de Meta es la fuente de verdad, el software no.** Si un dato solo existe aquí, está mal. Ante
      discrepancia, manda lo que devuelve la API.
- [ ] **La app de Meta necesita revisión (App Review)** para `ads_management` con cuentas de terceros. Mientras
      no la haya, se conecta con un **usuario de sistema del Business Manager** de cada empresa (acceso de larga
      duración pegado a mano). Hay que decidir esto antes de la Fase 1 — ver *Decisiones abiertas*.
- [ ] **El vídeo no está listo al subirlo.** `advideos` devuelve el id al instante, pero la creatividad falla
      hasta que `status.video_status = ready`. Hay que sondear y no dejar publicar antes.
- [ ] **Presupuesto en céntimos** en toda la API. Y en la moneda de la cuenta publicitaria, que puede no ser
      euro. En pantalla, siempre coma decimal.
- [ ] **Fechas**: la API trabaja en la zona horaria de la **cuenta publicitaria**, que puede no ser la de la
      empresa. Al programar hay que convertir desde el reloj de la empresa y enseñar siempre el de la empresa.
- [ ] **Objetivo y objetivo de optimización tienen que casar.** Meta rechaza combinaciones inválidas
      (p. ej. `OUTCOME_LEADS` con `LINK_CLICKS`) con un error críptico. El mapa vive en un solo sitio.
- [ ] **Cupo de la API.** El refresco completo va por cron; los clics de pantalla leen del espejo. Un botón
      "Actualizar" por campaña, no un refresco global por cada pintada.
- [ ] **Categorías especiales de anuncio** (`special_ad_categories`): hostelería va vacío, pero si alguna vez se
      anuncia empleo hay que declararlo o Meta rechaza la campaña.
- [ ] **RLS del patrón viejo.** La migración 044 usa `profiles.empresa_id`; las tablas nuevas usan
      `empresas_del_usuario()`, que es el helper canónico del proyecto.
- [ ] **Qué hacer con las campañas Meta que ya haya en `campanas_marketing`**: comprobar en producción antes de
      migrar o borrar. Si están todas en borrador y sin `meta_campaign_id`, se borran.
- [x] **RESUELTO (09-09-2026)**: el acceso de Meta **caduca** a los ~60 días y Facebook no lo renueva solo.
      Aviso automático a 7 días, 2 días y el día que caduca (notificación + push + correo uno a uno), al
      departamento de Marketing, desde el cron horario. `dedupeKey` con la fecha de caducidad: al reconectar
      cambia la clave y el ciclo se reinicia solo. Iván descartó la clave permanente de Business Manager.
- [ ] ~~El acceso de Meta **caduca**.~~ Guardar `token_expira_at` y avisar en Ajustes antes de que muera, o un día
      las campañas dejan de refrescarse en silencio.

## Instagram

Instagram **no es un canal aparte**: la misma cuenta publicitaria manda sobre Facebook e Instagram. El sitio
donde aparece el anuncio (feed, stories, reels, explorar) se elige en el nivel del **conjunto de anuncios**
(`publisher_platforms` + `*_positions`), no en un módulo distinto. Requisito previo del lado de Meta: cuenta de
Instagram profesional vinculada a la página de Facebook en el Business Manager; si no lo está, la API no
devuelve `instagram_actor_id` y hay que decirlo en la pantalla en vez de fallar en silencio.

## Decisiones abiertas (preguntar de una en una antes de aprobar)

1. ~~**Cómo se conecta cada empresa**~~ → **DECIDIDO (07-09-2026): botón "Conectar con Facebook" (OAuth).**
   Nada de pegar la clave a mano. En Ajustes → Integraciones → Meta se pulsa el botón, se entra con Facebook y
   después se eligen de una lista la cuenta publicitaria, la página y el Instagram.

   **La revisión de Meta NO bloquea el arranque.** Con la app en modo desarrollo, el flujo funciona íntegro
   para quien tenga rol en la app (administrador / desarrollador / probador) sobre cuentas publicitarias de las
   que ya es administrador — es decir, HABANA y BACANAL se conectan desde el día uno. La revisión de
   `ads_management` + `ads_read` sólo hace falta el día que se conecte una empresa ajena (venta del software a
   otro restaurante). Se solicita en paralelo, no en el camino crítico.

   Consecuencias para la Fase 1: hace falta una app en Meta for Developers (App ID + App Secret, en variables de
   entorno porque identifican al software, no a la empresa), producto "Facebook Login for Business", URI de
   redirección `/api/integraciones/meta/callback` (más la de local), e intercambio del código por acceso de
   larga duración (~60 días) con refresco antes de que caduque. Ver también el aviso de caducidad en Gotchas.
2. ~~**Cuenta de pruebas**~~ → **RESUELTO por criterio ya establecido: no se gasta dinero real para probar.**
   Mismo principio que [[feedback_nunca_cobrar_de_verdad_para_probar]]. Se desarrolla contra la cuenta real pero
   **todo se crea en `status: PAUSED`** y no se activa ni una sola campaña de prueba. Meta permite crear
   campañas, conjuntos, creatividades y anuncios en pausa sin cobrar nada: la validación de la Fase 9 se hace
   sobre objetos pausados que después se borran. Si en algún momento hay que probar una activación real, se
   pide permiso antes y se hace con el presupuesto mínimo y borrando acto seguido.
3. ~~**Quién puede activar y gastar**~~ → **DECIDIDO (07-09-2026): los tres puestos de Marketing** (COMMUNITY,
   FILMMAKER, TRAFFIQER) pueden crear, activar y pausar. No se reserva a Dirección.

   Se implementa como **permiso configurable del submódulo**, no cableado al rol Dirección
   ([[feedback_acceso_por_permiso_configurado_no_por_rol_direccion]]) y **sin bypass de administrador**
   ([[project_herramientas_barra_sin_bypass_admin]]): quien no tenga el permiso no ve el botón de activar,
   aunque sea admin. Por seguir siendo dinero, la activación es **siempre un acto explícito** — nunca efecto
   secundario de guardar — y queda registrada en auditoría con quién y cuándo.
4. ~~**Tope de gasto**~~ → **DECIDIDO (07-09-2026): BLOQUEO duro, no aviso.** Tope de gasto mensual **por
   empresa**, obligatorio al conectar la cuenta (no puede quedar en blanco), editable en Ajustes → Integraciones
   → Meta. Alcanzado el tope, el botón de activar deja de funcionar y hay que subirlo a mano. Mismo criterio que
   [[project_tope_gasto_ia_mensual]].

   Detalles que no se pueden despistar:
   - El mes es el **mes natural en el reloj de la empresa**, no el del navegador ni UTC
     ([[project_zona_horaria_por_empresa]], [[project_dia_que_se_abre_zona_empresa]]).
   - El gasto sale de `insights.spend` **de toda la cuenta publicitaria**, no sólo de las campañas creadas desde
     el software: si el traffiquer gasta 900 € en una campaña hecha en Meta, cuenta para el tope.
   - El bloqueo se comprueba **en el servidor** al activar, no sólo escondiendo el botón.
   - Se enseña siempre el gasto del mes contra el tope, aunque falte mucho.
   - Bloquear **impide activar**; NO pausa lo que ya está corriendo (pausar algo a mitad de mes por un tope sería
     peor que el problema). Si el gasto ya activo va a rebasarlo, se avisa.

## Anti-Patrones

- NO mantener el modelo plano de un solo nivel "por compatibilidad": se sustituye entero.
- NO guardar credenciales de Meta en variables de entorno: van por empresa, cifradas, en Ajustes.
- NO inventar en el software un estado de campaña que Meta no confirme.
- NO activar campañas de forma automática ni como efecto de guardar.
- NO llamar a la Marketing API desde el navegador: siempre desde servidor, con el acceso descifrado allí.
- NO hardcodear la versión de la Graph API en varios sitios: una constante única.
- NO omitir Zod en los formularios del asistente.

---

*PRP aprobado el 07-09-2026. Implementación por fases con `/bucle-agentico`.*
