# PRP-040: Inspectores — Bolsa de empleo + integración con Inspecciones

> **Estado**: PENDIENTE
> **Fecha**: 2026-05-25
> **Proyecto**: Balles-Hosteleros
> **Módulo**: Calidad → Inspecciones → Inspectores (nuevo submódulo)
> **Relacionado**: PRP-034 (Reclutamiento), módulo Inspecciones existente, PRP-029 (Página Web CMS)

---

## Objetivo

Crear un nuevo apartado **"Inspectores"** dentro de Calidad → Inspecciones que funcione como una **bolsa de empleo única por empresa** (un solo "puesto": Inspector externo). Permite que cualquier persona se inscriba desde un formulario público sin auth, el responsable de calidad gestiona los inscritos en un pipeline kanban, y la página web pública de la empresa puede incluir un bloque que enlaza a esa bolsa.

Los inspectores **NO son empleados** ni usuarios — son entidades externas independientes, con su propia tabla, su propio ciclo y su propio histórico ligado a `inspeccion_envios` (cuando han realizado inspecciones).

## Por Qué

| Problema | Solución |
|----------|----------|
| Los inspectores externos hoy se contactan por WhatsApp/email manualmente; no hay registro de quién ha trabajado, ni de quién quiere trabajar | Bolsa única por empresa con pipeline kanban + histórico ligado a inspecciones realizadas |
| No hay forma de captar inspectores nuevos: el equipo de calidad pierde tiempo buscando | Formulario público (sin auth) + bloque integrable en la web de la empresa = inbound continuo |
| El módulo Inspecciones ya genera envíos (`inspeccion_envios`) pero el dato del inspector vive solo como texto libre en `nombre_inspector` | Vincular cada envío histórico al registro real del inspector → trazabilidad y reputación interna por inspector |
| Reclutamiento (RRHH) sirve para empleados internos, no aplica a colaboradores externos puntuales | Bolsa específica con fases adaptadas (Bolsa → Entrevista → Prueba → Activo → Histórico + Descartado), sin múltiples vacantes |

**Valor de negocio**:
- **Captación cero-coste**: la página web ya existe; añadir un bloque "Únete como inspector" convierte tráfico orgánico en candidatos.
- **Reducción de fricción operativa**: cuando se necesita inspector, se elige directamente desde el pipeline en lugar de buscar en WhatsApp.
- **Reputación interna**: ver cuántas inspecciones ha hecho cada inspector, su nota media y su historial → decisiones informadas.

## Qué

### Criterios de Éxito

- [ ] Existe tab **"Inspectores"** en `CalidadInspeccionesView` (junto a Presentación, Plantillas, Realizadas).
- [ ] El tab tiene dos sub-vistas: **Pipeline** (kanban) y **Listado** (tabla con patrón estándar).
- [ ] Tabla `inspectores` creada en Supabase con RLS multiempresa (UNION `profiles.empresa_id` ∪ `user_empresas`).
- [ ] Tabla `inspector_asignaciones` creada y poblada para los envíos existentes que tengan match por nombre+teléfono (best-effort backfill opcional; sin match queda solo el texto en `inspeccion_envios.nombre_inspector`).
- [ ] Ruta pública `/inspectores/bolsa/[empresa-slug]` accesible sin auth: muestra branding de la empresa + formulario de inscripción.
- [ ] El envío del formulario crea un registro con `fase = "bolsa"`, sin pedir login, validado con Zod, con rate-limit por IP+device.
- [ ] Existe un nuevo tipo de bloque `bolsa_inspectores` en `src/features/marketing/pagina-web/types` que renderiza un CTA enlazando al formulario público de la empresa actual.
- [ ] El detalle de un inspector muestra su **histórico de inspecciones** (lista de `inspeccion_envios` asociados con fecha, local y nota).
- [ ] El número de teléfono del inspector se usa como clave natural por empresa (no se admiten duplicados activos en la misma empresa).
- [ ] `npm run typecheck` y `npm run build` pasan.

### Comportamiento Esperado

**Inscripción pública (Happy path)**:
1. La empresa publica en su web (vía bloque `bolsa_inspectores`) un CTA "Únete a nuestra bolsa de inspectores".
2. Click → `/inspectores/bolsa/[empresa-slug]` (página pública, sin auth, branding de la empresa).
3. Persona rellena: nombre, apellidos, email, teléfono, ciudad/provincia, disponibilidad (días/franja), CV (opcional, Supabase Storage), notas.
4. Submit → server action valida con Zod, comprueba que `empresa_slug` existe, comprueba que `telefono` no está duplicado activo en esa empresa, inserta con `fase = "bolsa"` y `estado_actividad = "futuro"`.
5. Pantalla de éxito + opcionalmente email de confirmación (opcional, no bloqueante).

**Gestión interna (responsable de calidad)**:
1. Navega a Calidad → Inspecciones → tab "Inspectores".
2. Por defecto ve sub-vista **Pipeline** (kanban) con columnas:
   - **Bolsa** (recién inscritos)
   - **Entrevista** (en evaluación)
   - **Prueba** (haciendo su primera inspección de prueba)
   - **Activo** (colabora regularmente)
   - **Histórico** (colaboró pero ya no activo)
   - **Descartado** (no continuamos con él)
3. Drag&drop entre columnas → action `moverInspectorFase` registra el cambio (con `updated_at`, `updated_por`).
4. Click en card → modal con detalle: datos personales, CV, notas, historial de inspecciones (`inspeccion_envios` asociados vía `inspector_asignaciones`).
5. Sub-vista **Listado**: tabla con patrón estándar (SubmoduleToolbar + ResizableColumnsProvider + TableColumnHeader). Columnas: nº secuencial, nombre, teléfono, ciudad, fase, nº inspecciones realizadas, nota media, última inspección, acciones.

**Vinculación automática con envíos**:
- Cuando se crea o se "revisa" un `inspeccion_envios`, se busca match por `telefono_inspector` con la tabla `inspectores` de esa empresa. Si hay match → se inserta fila en `inspector_asignaciones` automáticamente (sin tocar el campo de texto del envío, que se conserva como snapshot). Sin match → no se vincula (no se crea inspector implícito).

**Bloque web**:
- Tipo nuevo `bolsa_inspectores` con `BloqueDatos`: `{ titulo, descripcion?, cta_label, mostrar_foto?: boolean }`.
- Render público: hero pequeño + botón → `/inspectores/bolsa/[empresa-slug]`.
- Form admin nuevo `BolsaInspectoresForm.tsx`.

---

## Contexto

### Referencias

- `src/features/calidad/inspecciones/` — módulo existente: actions, types, public-data, componentes.
- `src/features/calidad/components/CalidadInspeccionesView.tsx` — donde se añade el 4º tab.
- `src/features/rrhh/components/reclutamiento/KanbanPipeline.tsx` — patrón kanban a clonar (drag&drop, columnas, cards).
- `src/features/rrhh/actions/candidatos-actions.ts` — patrón de actions de pipeline + RLS empresarial.
- `src/features/rrhh/data/reclutamiento.ts` — patrón de FASES_*_CONFIG (labels, colores, transiciones).
- `src/features/logistica/components/ProductosView.tsx` — patrón estándar de submódulo (SubmoduleToolbar sin `campos`/`ordenOpciones` + ResizableColumnsProvider + TableColumnHeader). Memoria: `feedback_configuracion_base_submodulo`.
- `src/app/inspectores/[token]/page.tsx` — patrón de ruta pública sin auth, branding de empresa (atención: esta ruta `/inspectores/[token]` es para inspector haciendo inspección; la nueva `/inspectores/bolsa/[empresa-slug]` es para inscripción a la bolsa — son flujos distintos pero comparten estilo visual).
- `src/app/(public)/carta/[slug]/page.tsx` (si existe) — patrón de `[empresa-slug]` con branding.
- `src/features/marketing/pagina-web/types/index.ts` — `BLOQUE_TIPOS` + tipos `Bloque*Datos` donde se añade el nuevo bloque.
- `src/features/marketing/pagina-web/components/admin/editor/forms/` — donde se añade el form del bloque nuevo.
- `src/features/marketing/pagina-web/components/public/BloquePublico.tsx` — switch de render donde se añade el case nuevo.
- `numero_counters` + triggers (memoria `project_id_secuencial_inmutable`) — para `numero_secuencial` por empresa en inspectores.

### Memorias activas aplicables

- `project_rls_multiempresa` — toda policy RLS con `empresa_id` debe aceptar `profiles.empresa_id` ∪ `user_empresas`.
- `project_empresa_activa_cookie` — usar `getEmpresaActivaForUser()` (no `profiles.empresa_id`).
- `project_id_secuencial_inmutable` — `inspectores.numero_secuencial` per-empresa.
- `feedback_configuracion_base_submodulo` — toolbar + columnas redimensionables en sub-vista Listado.
- `feedback_barra_horizontal_1` — toolbar minimalista por defecto.
- `feedback_links_pestana_nueva` — links a la bolsa pública en `target="_blank"`.
- `project_inspecciones_propias` — arquitectura del módulo padre; mismo patrón de ruta pública sin auth.
- `feedback_seeds_canonicos_propagan` — si se siembra algún seed (no debería en este PRP), debe propagarse a TODAS las empresas.

### Arquitectura Propuesta (Feature-First)

Reutilizamos el feature existente `calidad/inspecciones` y añadimos un submódulo `inspectores`:

```
src/features/calidad/inspecciones/
├── inspectores/                  # NUEVO subfolder
│   ├── actions.ts                # listInspectores, createInspector, moverFase, etc.
│   ├── public-actions.ts         # inscribirInspectorPublico (sin auth)
│   ├── public-data.ts            # fetchBolsaPublicaEmpresa(slug)
│   ├── types.ts                  # Inspector, InspectorFase, InspectorAsignacion, etc.
│   ├── data.ts                   # FASES_INSPECTOR config (labels, colores, transiciones)
│   └── components/
│       ├── InspectoresTab.tsx          # Wrapper sub-vistas Pipeline | Listado
│       ├── InspectoresKanban.tsx       # Kanban
│       ├── InspectoresListado.tsx      # Tabla estándar
│       ├── InspectorDetailModal.tsx    # Detalle + histórico envíos
│       ├── InspectorFormDialog.tsx     # Alta/edición manual interna
│       └── BolsaPublicaShell.tsx       # Render del formulario público

src/app/inspectores/
├── [token]/page.tsx              # YA EXISTE — no tocar
└── bolsa/                        # NUEVO
    └── [empresa-slug]/
        └── page.tsx              # Página pública de inscripción

src/features/marketing/pagina-web/
├── types/index.ts                # Añadir "bolsa_inspectores" a BLOQUE_TIPOS + interface
├── components/admin/editor/forms/
│   └── BolsaInspectoresForm.tsx  # NUEVO
└── components/public/
    └── BloquePublico.tsx         # Añadir case "bolsa_inspectores"
```

### Modelo de Datos

```sql
-- ─── Tabla inspectores ──────────────────────────────────────────────
create table if not exists public.inspectores (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id) on delete cascade,
  numero_secuencial int,                          -- per-empresa, vía numero_counters

  -- Datos personales
  nombre text not null,
  apellidos text,
  email text,
  telefono text not null,                         -- clave natural
  dni_nie text,
  fecha_nacimiento date,

  -- Ubicación / disponibilidad
  ciudad text,
  provincia text,
  pais text default 'España',
  disponibilidad jsonb,                           -- { dias: ["L","M",...], franja: "mañana|tarde|ambas", notas: "..." }

  -- CV + media
  cv_url text,                                    -- Supabase Storage public bucket "inspectores-cv"
  foto_url text,

  -- Pipeline
  fase text not null default 'bolsa'
    check (fase in ('bolsa','entrevista','prueba','activo','historico','descartado')),
  estado_actividad text not null default 'futuro'
    check (estado_actividad in ('futuro','activo','historico')),  -- derivado/cache de fase

  -- Captación
  origen text not null default 'formulario_publico'
    check (origen in ('formulario_publico','alta_manual','referido')),
  pagina_slug text,                               -- de qué bloque/web vino (opcional, info)
  ip_hash text,                                   -- anti-abuso (no PII)
  user_agent text,

  -- Gestión interna
  notas text,
  notas_internas text,                            -- visible solo en gestión
  rating_interno int check (rating_interno between 1 and 5),
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  updated_por uuid references auth.users(id),

  -- Uniqueness por empresa
  constraint inspectores_telefono_empresa_unique
    unique (empresa_id, telefono)
);

create index inspectores_empresa_fase_idx on public.inspectores(empresa_id, fase);
create index inspectores_empresa_created_at_idx on public.inspectores(empresa_id, created_at desc);

-- ─── Tabla inspector_asignaciones ──────────────────────────────────
-- Vincula inspector con envíos de inspecciones que ha realizado.
create table if not exists public.inspector_asignaciones (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id) on delete cascade,
  inspector_id uuid not null references public.inspectores(id) on delete cascade,
  envio_id uuid not null references public.inspeccion_envios(id) on delete cascade,
  created_at timestamptz default now(),

  constraint inspector_asignaciones_envio_unique unique (envio_id)
);

create index inspector_asignaciones_inspector_idx on public.inspector_asignaciones(inspector_id);
create index inspector_asignaciones_empresa_idx on public.inspector_asignaciones(empresa_id);

-- ─── Counters secuenciales ─────────────────────────────────────────
-- Registrar 'inspectores' en numero_counters como cualquier otra tabla con id secuencial inmutable.
-- (El trigger de asignación ya está definido genéricamente — ver memoria id_secuencial_inmutable.)

-- ─── RLS ───────────────────────────────────────────────────────────
alter table public.inspectores enable row level security;
alter table public.inspector_asignaciones enable row level security;

-- inspectores SELECT (multiempresa: profiles ∪ user_empresas)
create policy "inspectores_select_tenant"
  on public.inspectores for select to authenticated
  using (
    empresa_id in (select p.empresa_id from public.profiles p where p.user_id = auth.uid())
    or empresa_id in (select ue.empresa_id from public.user_empresas ue where ue.user_id = auth.uid())
  );

-- inspectores INSERT/UPDATE/DELETE autenticado (mismo tenant)
create policy "inspectores_write_tenant"
  on public.inspectores for all to authenticated
  using (
    empresa_id in (select p.empresa_id from public.profiles p where p.user_id = auth.uid())
    or empresa_id in (select ue.empresa_id from public.user_empresas ue where ue.user_id = auth.uid())
  )
  with check (
    empresa_id in (select p.empresa_id from public.profiles p where p.user_id = auth.uid())
    or empresa_id in (select ue.empresa_id from public.user_empresas ue where ue.user_id = auth.uid())
  );

-- inspectores INSERT anónimo (formulario público de inscripción)
-- Solo permite insertar en empresa_id correspondiente al slug de la URL.
-- Validación adicional ocurre server-side en la action (rate-limit, captcha si se decide).
create policy "inspectores_insert_publico"
  on public.inspectores for insert to anon
  with check (
    fase = 'bolsa'
    and estado_actividad = 'futuro'
    and origen = 'formulario_publico'
  );

-- inspector_asignaciones: solo authenticated mismo tenant
create policy "inspector_asignaciones_all_tenant"
  on public.inspector_asignaciones for all to authenticated
  using (
    empresa_id in (select p.empresa_id from public.profiles p where p.user_id = auth.uid())
    or empresa_id in (select ue.empresa_id from public.user_empresas ue where ue.user_id = auth.uid())
  )
  with check (
    empresa_id in (select p.empresa_id from public.profiles p where p.user_id = auth.uid())
    or empresa_id in (select ue.empresa_id from public.user_empresas ue where ue.user_id = auth.uid())
  );

-- ─── Trigger updated_at ────────────────────────────────────────────
create or replace function public.set_inspectores_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end; $$;

create trigger inspectores_set_updated_at
  before update on public.inspectores
  for each row execute function public.set_inspectores_updated_at();

-- ─── Storage bucket para CVs ───────────────────────────────────────
-- bucket 'inspectores-cv' (público read, restringido upload size).
-- Política: any uploader puede insertar con prefix `${empresa_slug}/`.
```

**Notas modelo de datos**:
- `telefono` es la clave natural por empresa (memoria reclutamiento usa email; aquí elegimos teléfono porque el caso real es alguien que se inscribe rápido con móvil). Email se acepta opcional.
- `estado_actividad` (futuro / activo / histórico) se deriva de `fase` pero se cachea para facilitar filtros: `bolsa|entrevista|prueba → futuro`, `activo → activo`, `historico → histórico`. `descartado` queda fuera de los 3 estados y solo se filtra por fase.
- Backfill opcional inicial: para `inspeccion_envios` existentes, intentar match por `telefono_inspector` con `inspectores.telefono` dentro de la misma empresa. Si match único → crear `inspector_asignaciones`. Si no → no se hace nada (no se crea inspector implícito).

---

## Blueprint (Assembly Line)

### Fase 1: Base de datos
**Objetivo**: Tablas `inspectores` + `inspector_asignaciones` creadas en Supabase con RLS multiempresa, índices, triggers y storage bucket.
**Validación**:
- `mcp__supabase__list_tables` muestra ambas tablas.
- `mcp__supabase__get_advisors` sin errores críticos en RLS.
- Insert de prueba autenticado funciona en empresa propia; falla en empresa ajena.
- Insert anónimo con `fase='bolsa'` y `origen='formulario_publico'` funciona; insert con otra fase falla.
- `numero_counters` reconoce la tabla `inspectores` (trigger asigna secuencial).

### Fase 2: Tipos + actions + seeds de fases
**Objetivo**: `src/features/calidad/inspecciones/inspectores/types.ts`, `data.ts` (FASES_INSPECTOR_CONFIG), `actions.ts` (CRUD + moverFase + listar histórico).
**Validación**:
- `npm run typecheck` pasa.
- Listado de inspectores devuelve datos correctos por empresa activa.
- Cambio de cookie `bh_empresa_activa` cambia el listado.

### Fase 3: UI admin — Tab + Pipeline kanban + Listado
**Objetivo**: Añadir tab "Inspectores" en `CalidadInspeccionesView` con sub-vistas Pipeline y Listado. Kanban con drag&drop (clon adaptado de `KanbanPipeline.tsx` de RRHH). Listado con patrón estándar (toolbar + columnas redimensionables).
**Validación**:
- Tab visible y conmutable.
- Drag&drop funciona, persiste, refresca.
- Listado paginado, búsqueda, ocultar columnas funciona.
- Modal de detalle muestra histórico de envíos vinculados.

### Fase 4: Acción manual desde envío (vinculación)
**Objetivo**: En `RealizadasView.tsx`, al ver detalle de envío, mostrar el inspector vinculado (si lo hay) con link al detalle, o botón "Vincular a inspector existente / Crear inspector desde este envío" si no hay match automático. Match automático por `telefono_inspector` al crear/revisar envío.
**Validación**:
- Envíos existentes muestran vinculación si hay match.
- Botón "Crear inspector desde envío" prefill datos del envío y abre formulario.

### Fase 5: Página pública de inscripción
**Objetivo**: Ruta `/inspectores/bolsa/[empresa-slug]` con branding de empresa (mismo patrón que `/inspectores/[token]`) y formulario de inscripción.
**Validación**:
- URL pública accesible sin auth con branding correcto.
- Validación Zod en cliente + server.
- Bloqueo de duplicados por teléfono en misma empresa.
- Subida de CV a Storage funciona.
- Pantalla de éxito tras submit.
- Rate-limit por IP-hash (ej: 5 inscripciones por IP/hora) implementado server-side.

### Fase 6: Bloque "bolsa_inspectores" en CMS de páginas web
**Objetivo**: Nuevo tipo de bloque en `src/features/marketing/pagina-web` con form admin, render público y entrada en `BloqueLibrary`.
**Validación**:
- Aparece en biblioteca de bloques.
- Form permite editar título, descripción, label del CTA.
- Render público pinta el bloque y enlaza correctamente a `/inspectores/bolsa/[empresa-slug]` con `target="_blank"`.
- Slug se resuelve desde `contexto.empresa.slug` (no hardcoded).

### Fase 7: Backfill opcional + QA
**Objetivo**: Script idempotente (action server) que recorre `inspeccion_envios` existentes y crea `inspector_asignaciones` cuando hay match único por teléfono. QA end-to-end con Playwright.
**Validación**:
- Script ejecutable desde botón en Calidad → Inspectores → "Backfill histórico" (admin only).
- Reporte muestra cuántos vinculados, cuántos sin match.
- Re-ejecutar el script no duplica.
- Playwright: inscripción pública → aparece en kanban → mover a Activo → vincular envío → ver histórico.

### Fase 8: Validación Final
**Objetivo**: Sistema funcionando end-to-end en BACANAL y HABANA.
**Validación**:
- [ ] `npm run typecheck` pasa.
- [ ] `npm run build` exitoso.
- [ ] Playwright screenshot confirma UI en BACANAL y HABANA con sus respectivos brandings.
- [ ] Todos los criterios de éxito cumplidos.
- [ ] Memoria actualizada (`project_inspectores_bolsa.md`).

---

## Gotchas

- [ ] **Ruta `/inspectores/[token]` vs `/inspectores/bolsa/[empresa-slug]`**: Next.js puede confundir `[token]` con `bolsa` si no se ordena bien. La carpeta literal `bolsa/` toma precedencia sobre el segmento dinámico `[token]`, pero hay que verificar que `params.token === "bolsa"` no rompa la ruta existente. Test explícito en QA.
- [ ] **`empresa_slug` debe existir y resolverse a `empresa_id`**: usar la misma función helper que `/carta/[slug]` (revisar `src/features/empresa/lib/`). Si no hay slug, devolver 404.
- [ ] **Storage bucket público para CVs**: configurar tamaño máx (5MB) y MIME whitelist (pdf, doc, docx). RLS en bucket: insert anon permitido con prefix por empresa, delete solo authenticated.
- [ ] **Rate-limit anónimo**: el bypass más fácil sería spam de inscripciones. Implementar throttle por IP-hash en la action (5/hora). Considerar añadir hCaptcha invisible si hay abuso.
- [ ] **Match telefónico**: normalizar teléfono antes de comparar (quitar espacios, prefijo `+34` opcional). Función `normalizarTelefono(string)` reutilizable.
- [ ] **RLS anon INSERT**: la policy `inspectores_insert_publico` permite insert anónimo. Cualquier extensión futura (`fase != 'bolsa'`, etc.) DEBE chequearse en el `with check`.
- [ ] **`inspeccion_envios` no tiene FK directa a inspectores**: el campo `nombre_inspector` se conserva como snapshot textual (importante para auditoría si el inspector se elimina más tarde).
- [ ] **Multiempresa**: la sub-vista debe respetar `bh_empresa_activa` cookie, no `profiles.empresa_id`.
- [ ] **Bloque CMS**: al añadir `bolsa_inspectores` a `BLOQUE_TIPOS`, hay que actualizar el discriminator de `Bloque` (union type) y el switch de `BloquePublico.tsx` o TypeScript se queja con exhaustive check.
- [ ] **No usar combobox cmdk dentro del Dialog del form admin**: memoria `feedback_combobox_dentro_dialog` — usar dropdown nativo.

## Anti-Patrones

- NO crear inspector implícito al guardar un `inspeccion_envios` sin match (rompe la separación de fuentes).
- NO reutilizar tabla `candidatos` ni `empleados` (memoria explícita del usuario).
- NO permitir múltiples "vacantes" o tipos de inspector (memoria explícita: hay UN solo puesto).
- NO crear endpoint API REST aparte cuando un Server Action de Next.js sirve igual.
- NO hardcodear el path `/inspectores/bolsa/${slug}` en el bloque CMS: derivarlo de `contexto.empresa`.
- NO omitir validación Zod en la action pública.
- NO confundir las tablas RLS `profiles` y `user_empresas`: usar UNION en TODAS las policies (memoria `project_rls_multiempresa`).
- NO crear seeds de fases en BD: las fases viven en `data.ts` como constantes TS (igual que reclutamiento).
- NO permitir editar `numero_secuencial` desde UI (memoria `project_id_secuencial_inmutable`).

---

## Aprendizajes (Self-Annealing)

> Esta sección se rellena durante la ejecución del Blueprint con errores reales y sus fixes.

*(vacío — pendiente ejecución)*

---

*PRP pendiente aprobación. No se ha modificado código.*
