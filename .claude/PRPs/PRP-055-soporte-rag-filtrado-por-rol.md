# PRP-055: Asistente de soporte por chat con RAG filtrado por rol

> **Estado**: IMPLEMENTADO (2026-06-10)
> **Fecha**: 2026-06-09
> **Proyecto**: Balles-Hosteleros
> **Evoluciona a**: PRP-023 (Sistema Ayuda y Soporte v1, ya implementado parcialmente)

---

## Objetivo

Convertir el chat de Soporte actual (que hoy lee una base estática `BASE_CONOCIMIENTO` en código) en un **asistente RAG real**: el empleado pulsa "Soporte", el bot lo identifica, calcula qué módulos/departamentos ve su rol vía `puedeVer()`, y responde SOLO con conocimiento de esos módulos — recuperado por búsqueda vectorial (pgvector) sobre una tabla global `soporte_conocimiento` que indexa automáticamente el contenido de Formación más artículos de soporte escritos a mano, adjuntando enlaces y vídeos formativos relevantes.

## Por Qué

| Problema | Solución |
|----------|----------|
| El chat actual responde de un manual estático de ~docena de artículos en código; no escala ni cubre el contenido real del software | RAG sobre tabla global indexada (Formación + artículos a mano) con embeddings; el conocimiento crece sin tocar código |
| Un empleado podría recibir respuestas sobre módulos que su rol no ve (fuga de info por privacidad) | Doble candado: filtro de la búsqueda vectorial por módulos de `puedeVer()` + RLS por empresa + refuerzo en system prompt |
| El bot no es resolutivo: no enlaza al vídeo/lección que resuelve la duda | Cada chunk lleva `enlaces`/`videos` en jsonb; la respuesta adjunta los recursos formativos del módulo permitido |
| No hay datos de qué dudas tienen los empleados | Tabla de log de consultas para analítica (pregunta, módulos, si escaló, chunks usados) |

**Valor de negocio**: menos tickets repetidos al gerente, onboarding autoservido, y telemetría de dudas para priorizar formación. Primer caso RAG productivo del SaaS — sienta el patrón para futuras features con IA.

## Qué

### Criterios de Éxito
- [ ] El chat recupera respuestas por similitud vectorial (no por `includes()` de palabras clave) sobre `soporte_conocimiento`.
- [ ] La búsqueda vectorial recibe la lista de módulos que el usuario ve (derivada de `puedeVer()` server-side) y NUNCA devuelve chunks de un módulo no permitido — verificado con un empleado de rol `empleado` que pregunta por COCINA/CONTABILIDAD y no obtiene contenido de esos módulos.
- [ ] El contenido del módulo Formación (cursos/secciones/lecciones/novedades) queda indexado en `soporte_conocimiento`, etiquetado por módulo y por puesto/departamento, y se re-indexa al editarlo desde `AdminFormacionPanel`.
- [ ] Existen artículos de soporte escritos a mano en la misma tabla, gestionables sin tocar código.
- [ ] Las respuestas resolutivas adjuntan enlaces y vídeos relevantes (de `enlaces`/`videos` jsonb del chunk) cuando existen.
- [ ] RLS por empresa activa en las tablas con datos por empresa; `soporte_conocimiento` es global (estilo seeds canónicos) y solo escribible por service role.
- [ ] Cada consulta queda registrada para analítica (pregunta, módulos permitidos, chunks recuperados, escaló sí/no).
- [ ] Botón Soporte + drawer de chat siguen funcionando (se reutiliza la UI existente), también en móvil.
- [ ] `npm run typecheck` y `npm run build` pasan.

### Comportamiento Esperado (Happy Path)
1. El empleado pulsa el botón flotante de Soporte → abre el drawer de chat existente (`soporte-drawer.tsx`).
2. Escribe una duda ("¿cómo monto un escandallo?").
3. El cliente llama a `/api/soporte/chat`. El handler:
   - Resuelve `user` y `empresa_id` server-side, y calcula los **módulos visibles** del rol (misma lógica que `puedeVer()`, evaluada en servidor a partir de `getUserPermisos()`), más los puestos/departamentos del empleado.
   - Genera el embedding de la pregunta (OpenRouter / modelo de embeddings).
   - Llama a la RPC `buscar_soporte_conocimiento(embedding, modulos_permitidos, empresa_id, top_k)` que aplica el filtro de módulos DENTRO de la query vectorial (candado 1) y RLS por empresa (candado 2).
   - Construye el system prompt con SOLO esos chunks + refuerzo de privacidad (candado 3): "responde solo con el contexto dado; si la duda cae fuera, dilo y ofrece escalar".
   - Llama al LLM (Vercel AI SDK v5 + OpenRouter, ya en uso vía `openrouterChat`) y devuelve respuesta + recursos (enlaces/vídeos) + flag `escalar`.
4. El drawer pinta la respuesta con sus tarjetas de vídeo/enlace.
5. Se inserta una fila en `soporte_consultas` para analítica.
6. Si pregunta por algo fuera de su rol o pide "hablar con persona", el bot responde con cortesía sin filtrar info y marca `escalar`.

---

## Contexto

### Referencias (código existente — REUTILIZAR, no recrear)
- `src/app/api/soporte/chat/route.ts` — handler de chat actual (auth + rate limit + openrouter + JSON {escalar,respuesta}). Se **reescribe internamente** para RAG manteniendo el contrato de respuesta.
- `src/app/api/soporte/ayuda-rapida/route.ts` — endpoint de ayuda rápida (mismo patrón).
- `src/lib/ia/openrouter.ts` — `openrouterChat(messages)` con `google/gemini-2.5-flash`. Añadir aquí un helper de embeddings.
- `src/lib/soporte/base-conocimiento.ts` — `BASE_CONOCIMIENTO` estático. Se **migra** a `soporte_conocimiento` (artículos a mano) y deja de ser fuente de verdad.
- `src/features/soporte/components/soporte-drawer.tsx` — drawer de chat (Sheet de shadcn). Reutilizar; solo ampliar para renderizar recursos (vídeos/enlaces) por mensaje.
- `src/features/soporte/components/floating-soporte-button.tsx` — botón flotante, montado en `app-layout.tsx:600`. Sin cambios.
- `src/features/soporte/components/faq-admin-panel.tsx` + `actions/faq-actions.ts` — patrón de panel admin + server actions con Zod y `requireAdminOrDirector()`. Patrón a seguir para gestionar artículos a mano.
- `src/features/auth/contexts/auth-context.tsx` — `puedeVer(modulo)`, `permisos`, `ROLE_MODULES`. La lógica de "qué módulos ve" hay que replicarla **en servidor** (el contexto es client-only).
- `src/features/auth/actions/permisos-actions.ts` — `getUserPermisos()` devuelve `{ empresaId, appRoles, permisos }`. Base server-side del cálculo de módulos visibles.
- `src/features/formacion/store/use-formacion-store.ts` — **Zustand + persist en localStorage** (clave `balles_formacion_v2`). El contenido de Formación NO está en Supabase hoy. `AdminFormacionPanel.tsx` escribe contra este store.
- `src/features/formacion/types/index.ts` — modelo Curso → Sección → Lección (+ `recursos`, `url` de vídeo) + Novedad. `ambito` general|puesto, `puesto`, `categoria`.
- `src/lib/seeds/*` + `src/lib/seeds/sync.ts` (`syncSeedsToAllEmpresas`) — patrón de datos "globales del software".
- `src/lib/seeds/roles.ts` — **nombres canónicos de módulo** (UPPERCASE + acentos): DIRECCIÓN, SALA, COCINA, GERENCIA, CALIDAD, RECURSOS HUMANOS, MARKETING, LOGÍSTICA, CONTABILIDAD, GESTORÍA, JURÍDICO, AJUSTES. La etiqueta `modulo` de cada chunk DEBE usar estos nombres para casar con `puedeVer()`.
- `src/shared/lib/rate-limit-memory.ts` — `rateLimit()` ya usado en el chat.

### Infraestructura verificada
- pgvector (`vector` 0.8.0) **disponible pero NO instalado** → requiere `CREATE EXTENSION vector` (cambio de schema, pedir permiso).
- `pg_cron` instalado (para re-indexado programado si hiciera falta), `pg_net` disponible (HTTP async desde Postgres).
- `ai` / `@ai-sdk/*` / `@openrouter/ai-sdk-provider` **NO instalados** (package.json solo tiene zod, zustand). El stack actual llama a OpenRouter por `fetch` directo. Decisión: o bien instalar Vercel AI SDK v5 (pedir permiso de `npm install`), o ampliar el `fetch` helper actual con embeddings (cero deps). Ver Gotchas.

### Docs externas a consultar en implementación
- OpenRouter embeddings / modelo de embeddings disponible (p.ej. `openai/text-embedding-3-small` 1536 dims vía OpenRouter, o el que ofrezca).
- pgvector: tipo `vector(N)`, operador `<=>` (distancia coseno), índice `hnsw`/`ivfflat`.
- Vercel AI SDK v5 `embed`/`embedMany` y `streamText` (si se opta por instalarlo).

### Arquitectura Propuesta (Feature-First)
```
src/features/soporte/
├── components/
│   ├── soporte-drawer.tsx            # (existente) + render de recursos por mensaje
│   ├── conocimiento-admin-panel.tsx  # NUEVO: gestión de artículos a mano + estado del índice
│   └── faq-admin-panel.tsx           # (existente)
├── actions/
│   ├── conocimiento-actions.ts       # NUEVO: CRUD artículos a mano (service role) + Zod
│   └── faq-actions.ts                # (existente)
├── services/
│   ├── indexar-formacion.ts          # NUEVO: snapshot de Formación → chunks → embeddings → upsert
│   └── buscar-conocimiento.ts        # NUEVO: embedding de query + RPC vectorial filtrada
└── types/index.ts                    # + tipos de chunk/consulta

src/lib/ia/openrouter.ts              # + openrouterEmbed(texts) helper
src/lib/soporte/modulos-visibles.ts   # NUEVO: cálculo server-side de módulos del rol (espejo de puedeVer)
src/app/api/soporte/chat/route.ts     # reescrito a RAG (mismo contrato de salida)
src/app/api/soporte/reindex-formacion/route.ts  # NUEVO: recibe snapshot del store y reindexa
```

### Modelo de Datos
```sql
-- Extensión (cambio de schema — requiere aprobación)
CREATE EXTENSION IF NOT EXISTS vector;

-- Tabla GLOBAL del software (no por empresa, estilo seeds canónicos).
-- Indexa Formación + artículos a mano. Solo service role escribe.
CREATE TABLE soporte_conocimiento (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fuente TEXT NOT NULL CHECK (fuente IN ('formacion', 'manual')),
  -- Origen para re-indexado idempotente (ej: 'leccion:<id>', 'curso:<id>', 'novedad:<id>')
  origen_ref TEXT,
  modulo TEXT NOT NULL,           -- nombre canónico: 'COCINA','SALA','RECURSOS HUMANOS'... (casa con puedeVer)
  departamento TEXT,              -- opcional, para afinar
  puesto TEXT,                    -- opcional (Formación ambito=puesto)
  titulo TEXT NOT NULL,
  contenido TEXT NOT NULL,        -- chunk de texto que se embebe
  enlaces JSONB DEFAULT '[]',     -- [{titulo,url}]
  videos JSONB DEFAULT '[]',      -- [{titulo,url,duracion_min}]
  embedding VECTOR(1536),         -- dims según modelo de embeddings elegido
  activo BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX ON soporte_conocimiento USING hnsw (embedding vector_cosine_ops);
CREATE INDEX ON soporte_conocimiento (modulo) WHERE activo;
-- Global y de solo lectura para usuarios autenticados; escritura solo service role.
ALTER TABLE soporte_conocimiento ENABLE ROW LEVEL SECURITY;
CREATE POLICY "lectura autenticados" ON soporte_conocimiento
  FOR SELECT TO authenticated USING (activo);
-- (sin policy de INSERT/UPDATE/DELETE → solo service role bypassa RLS)

-- Log de consultas para analítica (por empresa, RLS multi-tenant).
CREATE TABLE soporte_consultas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id UUID NOT NULL,
  user_id UUID REFERENCES auth.users(id),
  pregunta TEXT NOT NULL,
  modulos_permitidos TEXT[] NOT NULL,
  chunks_usados UUID[] DEFAULT '{}',
  escalo BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE soporte_consultas ENABLE ROW LEVEL SECURITY;
-- RLS multi-tenant con el helper canónico (ver MEMORY):
CREATE POLICY "soporte_consultas por empresa" ON soporte_consultas
  FOR SELECT TO authenticated
  USING (empresa_id IN (SELECT empresas_del_usuario()));
-- INSERT lo hace el route handler (service role) tras resolver empresa_id.

-- RPC de búsqueda con DOBLE filtro (módulos + activo). empresa no aplica a
-- soporte_conocimiento por ser global; el candado de empresa vive en consultas.
CREATE OR REPLACE FUNCTION buscar_soporte_conocimiento(
  query_embedding VECTOR(1536),
  modulos_permitidos TEXT[],
  top_k INT DEFAULT 6
) RETURNS TABLE (
  id UUID, modulo TEXT, titulo TEXT, contenido TEXT,
  enlaces JSONB, videos JSONB, distancia FLOAT
) LANGUAGE sql STABLE AS $$
  SELECT id, modulo, titulo, contenido, enlaces, videos,
         (embedding <=> query_embedding) AS distancia
  FROM soporte_conocimiento
  WHERE activo
    AND modulo = ANY(modulos_permitidos)   -- CANDADO 1: filtro de módulos en la propia query
  ORDER BY embedding <=> query_embedding
  LIMIT top_k;
$$;
```

**Nota sobre Formación y multi-tenant**: hoy Formación vive en `localStorage` por dispositivo, no en Supabase, y su contenido es (en la práctica) común. Para v1 se indexa como conocimiento **global** (igual que los seeds). Si más adelante Formación se migra a Supabase por empresa, `soporte_conocimiento` ganaría una columna `empresa_id` nullable (NULL = global) y la RPC añadiría `(empresa_id IS NULL OR empresa_id = ANY(empresas_del_usuario()))`. Decidir en Fase 1.

---

## Blueprint (Assembly Line)

> Solo FASES. Las subtareas se generan al entrar a cada fase con `/bucle-agentico`.

### Fase 1: Decisiones de arquitectura + esquema BD
**Objetivo**: Cerrar las 3 decisiones abiertas (Vercel AI SDK vs fetch; modelo y dims de embeddings; Formación global vs por empresa en v1). Crear extensión `vector`, tablas `soporte_conocimiento` y `soporte_consultas`, la RPC `buscar_soporte_conocimiento`, RLS y migración versionada. Mapear cada `modulo`/`ambito`/`categoria` de Formación a un nombre canónico de módulo.
**Validación**: migración aplicada; `SELECT buscar_soporte_conocimiento(...)` ejecuta (sin datos aún); advisors de Supabase sin warnings de RLS.

### Fase 2: Capa de embeddings + indexado de artículos a mano
**Objetivo**: `openrouterEmbed()` en `openrouter.ts`. Migrar `BASE_CONOCIMIENTO` a `soporte_conocimiento` (fuente `manual`) con su embedding, etiquetados por módulo canónico. Panel `conocimiento-admin-panel.tsx` + `conocimiento-actions.ts` (service role, Zod) para crear/editar/desactivar artículos y re-embeber al guardar.
**Validación**: artículos a mano aparecen en la tabla con embedding no nulo; CRUD desde el panel re-genera el embedding.

### Fase 3: Indexado automático de Formación
**Objetivo**: `indexar-formacion.ts` que convierte un snapshot del store (curso/sección/lección/novedad) en chunks etiquetados por módulo + puesto/departamento, con `enlaces`/`videos` (la `url` de la lección y sus `recursos`), genera embeddings y hace **upsert idempotente** por `origen_ref`. Endpoint `/api/soporte/reindex-formacion` y disparo desde `AdminFormacionPanel` al guardar cambios (Formación vive en localStorage → el cliente envía el snapshot).
**Validación**: tras editar una lección en el panel, su chunk se actualiza en `soporte_conocimiento`; lecciones de puesto quedan etiquetadas con su puesto.

### Fase 4: RAG en el chat con doble candado
**Objetivo**: `modulos-visibles.ts` (espejo server-side de `puedeVer()` a partir de `getUserPermisos()`). `buscar-conocimiento.ts`. Reescribir `/api/soporte/chat/route.ts`: embedding de la pregunta → RPC filtrada por módulos → system prompt con SOLO esos chunks + refuerzo de privacidad → LLM → respuesta + recursos + `escalar`. Insertar fila en `soporte_consultas`. Mantener el contrato `{escalar, respuesta}` y añadir `recursos`.
**Validación**: empleado de rol `empleado` no recibe contenido de COCINA/CONTABILIDAD; director sí; respuestas adjuntan vídeos/enlaces; se registra la consulta.

### Fase 5: UI de recursos en el drawer
**Objetivo**: Ampliar `soporte-drawer.tsx` para pintar tarjetas de vídeo/enlace por mensaje del asistente, sin romper el flujo actual ni el móvil.
**Validación**: las tarjetas se ven y abren en pestaña nueva (`target="_blank"`); responsive correcto.

### Fase 6: Validación Final
**Objetivo**: Sistema RAG end-to-end con seguridad verificada y analítica.
**Validación**:
- [ ] `npm run typecheck` pasa
- [ ] `npm run build` exitoso
- [ ] Playwright: empleado pregunta fuera de su rol → no hay fuga; director recupera todo
- [ ] Advisors de Supabase sin warnings de seguridad (RLS)
- [ ] Filas en `soporte_consultas` tras conversaciones de prueba
- [ ] Criterios de éxito cumplidos

---

## 🧠 Aprendizajes (Self-Annealing)

### 2026-06-10: Claves nuevas de Supabase (`sb_secret_`) no son JWT
- **Error**: la edge function `soporte-embeddings` desplegada con `verify_jwt=true` rechazaba la `SUPABASE_SERVICE_ROLE_KEY` con `UNAUTHORIZED_INVALID_JWT_FORMAT`. El proyecto usa el formato de claves nuevo (`sb_secret_…`, `sb_publishable_…`), que NO son JWT.
- **Fix**: redeploy con `verify_jwt=false` + auth propia dentro de la función (compara `Authorization: Bearer <SUPABASE_SERVICE_ROLE_KEY>` contra `Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')`).
- **Aplicar en**: cualquier edge function futura llamada server-side en este proyecto.

### 2026-06-10: pgvector + upsert + PostgREST
- **Error 1**: el embedding insertado como array JS crudo no entra en `VECTOR(384)`. **Fix**: serializar a literal `'[0.1,0.2,…]'` con `JSON.stringify(arr)`.
- **Error 2**: `onConflict: 'origen_ref'` fallaba ("no unique or exclusion constraint matching") porque el índice único era PARCIAL (`WHERE origen_ref IS NOT NULL`). **Fix**: constraint único normal — Postgres trata cada NULL como distinto, así que los artículos a mano sin `origen_ref` siguen coexistiendo.

### 2026-06-10: Acentos en el candado de módulos
- `normalizarModulo()` (auth-context) quita acentos, pero `soporte_conocimiento.modulo` los guarda ("LOGÍSTICA") y la RPC compara por igualdad EXACTA. `modulos-visibles.ts` mapea cada permiso a su forma canónica CON acento vía un `Map(normalizado → canónico)`.

### Decisiones de Fase 1 (cerradas con el usuario)
- Embeddings: motor propio de Supabase `gte-small` (384 dims) vía edge function. Sin AI SDK ni deps nuevas (helper `fetch`).
- Formación v1: se indexa como conocimiento GLOBAL (no se migró a Supabase). Snapshot enviado desde `AdminFormacionPanel` (botón "Sincronizar asistente"), porque Formación vive en localStorage.

### Verificación de seguridad (no-fuga por rol)
- Probado a nivel BD: pregunta "cómo fichar" con módulos `[COCINA]` → 0 resultados; con `[RECURSOS HUMANOS, GENERAL]` → fichaje/onboarding/agenda. Una lección de COCINA no aparece para `[SALA, GENERAL]`. El filtro vive DENTRO de la RPC.

### Pendiente / deuda
- `src/lib/soporte/base-conocimiento.ts` queda HUÉRFANA (ya nadie la importa). No se borró (regla de permiso). Borrar cuando se confirme.
- Cross-empresa: si dos empresas tienen cursos distintos con IDs distintos, generan chunks separados (dup leve). Aceptable en v1 (Formación es común).
- QA en navegador con Playwright (empleado real vs director) queda como validación viva; el candado está probado a nivel BD.

---

## Gotchas

- [ ] **Formación NO está en Supabase** — vive en `localStorage` (`balles_formacion_v2`, Zustand persist). No se puede indexar con un cron server-side puro: o se migra Formación a Supabase, o el cliente envía el snapshot al re-indexar (Fase 3 asume snapshot enviado desde `AdminFormacionPanel`). Decidir en Fase 1 si se aprovecha para migrar Formación a BD.
- [ ] **pgvector requiere `CREATE EXTENSION vector`** (no instalado) → cambio de schema, pedir permiso (regla de seguridad CLAUDE.md).
- [ ] **`puedeVer()` es client-only** (vive en el AuthContext de React). El candado de seguridad debe calcularse en SERVIDOR a partir de `getUserPermisos()`; nunca confiar en módulos enviados por el cliente.
- [ ] **Nombres de módulo deben casar exactamente** con los canónicos de `roles.ts` (UPPERCASE + acentos, p.ej. "RECURSOS HUMANOS", "LOGÍSTICA"). Reusar el normalizador `normalizarModulo()` para comparar.
- [ ] **Dimensión del embedding** fija la columna `VECTOR(N)`; cambiar de modelo después obliga a re-embeber todo. Elegir modelo y dims en Fase 1 y dejarlo en constante.
- [ ] **`director`/`admin` ven todo** (`puedeVer` hace bypass) → la lista de módulos permitidos para ellos debe ser TODOS los módulos canónicos, no vacía.
- [ ] **Coste/latencia de embeddings**: cachear el embedding por chunk (no re-embeber si el `contenido` no cambió). El embedding de la pregunta sí es por request.
- [ ] **Vercel AI SDK v5 no está instalado**. El usuario dijo "stack: Vercel AI SDK v5 + OpenRouter (ya en uso)", pero hoy solo se usa `fetch` directo a OpenRouter. Confirmar en Fase 1 si instalamos `ai` + provider (npm install → permiso) o ampliamos el helper `fetch` (cero deps, recomendado para v1).
- [ ] **`soporte_conocimiento` es global** → su escritura solo por service role (no policy de INSERT). Las server actions de gestión deben usar el cliente service role, igual que los seeds canónicos.
- [ ] **RLS multi-tenant** de `soporte_consultas` debe usar `empresas_del_usuario()` (regla MEMORY), no filtrar solo por `profiles.empresa_id`.

## Anti-Patrones
- NO confiar en los módulos permitidos enviados por el cliente (calcular server-side).
- NO crear una tabla `soporte_conocimiento` por empresa (es global, estilo seeds).
- NO recrear el drawer/botón de Soporte: ya existen, se reutilizan.
- NO dejar la base de conocimiento en código (`BASE_CONOCIMIENTO`) como fuente de verdad tras la migración.
- NO devolver chunks fuera del filtro de módulos ni "para que el LLM decida": el filtro va DENTRO de la query vectorial.
- NO hardcodear dims/modelo de embeddings dispersos por el código (constante única).
- NO usar `uppercase` en la UI de las tarjetas (regla de capitalización MEMORY); sentence case.

---

*PRP pendiente aprobación. No se ha modificado código.*
