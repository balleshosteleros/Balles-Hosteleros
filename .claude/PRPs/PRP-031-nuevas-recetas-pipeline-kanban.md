# PRP-031: Nuevas Recetas — Pipeline Kanban por Fases (ciclo completo)

> **Estado**: PENDIENTE (a la espera de luz verde para migración BD)
> **Fecha**: 2026-04-18
> **Proyecto**: Balles-Hosteleros
> **Ruta**: `/cocina/nuevas-recetas`
> **Feature dir**: `src/features/cocina/nuevas-recetas/` (promoción desde `components/nuevas-recetas/`)
> **Reemplaza a**: PRP-001 (versión simple con 5 checkboxes)
> **Depende de**: tablas existentes `nuevas_recetas`, `fichas_tecnicas`, `productos` (logística), `productos_venta`, `comunicados`, `carta_digital_items`, `tareas` (del drawer)

---

## Objetivo

Reescribir el submódulo **NUEVAS RECETAS** como un **pipeline tipo Reclutamiento**: kanban horizontal de **5 fases prefijadas pero editables por empresa**, con drag-and-drop entre fases, gatekeepers (datos obligatorios al mover), responsables asignables por fase, catas estructuradas con foto-por-QR-móvil, integración con Fichas Técnicas / Logística / Comunicados / Carta Digital, historial, y flags de plazo por fase (verde/rojo).

## Por Qué

| Problema actual | Solución |
|-----------------|----------|
| Lista plana con 5 booleans hardcoded — se pierden pasos. | Kanban de 5 fases por columna; responsabilidad visual clara. |
| No se fuerza orden, no hay gatekeepers. | Al mover fase → diálogo que exige datos mínimos. |
| La receta nace "suelta" y luego hay que re-tipear la ficha técnica. | La propuesta inicial **captura los mismos datos** que una ficha técnica (almacenados en `nuevas_recetas`); al aprobarse se crea el registro oficial en `fichas_tecnicas`. |
| Ingredientes sin priorización para cocina. | Etiquetas **principal / secundario** por ingrediente. |
| Proveedores no vinculados a Logística. | Selector de proveedor desde el módulo Logística + botón `+` abre alta directa. |
| Catas sin estructura (coste, PVP, decisión). | Ficha de cata con 4 opciones de valoración, foto-en-vivo vía QR-móvil, escandallo visible. |
| No hay notificaciones al responsable de la siguiente fase. | Al pasar fase → email + tarea en `TareasDrawer` (ya existe) al usuario asignado. |
| Ficha técnica aprobada no se propaga a Logística, TPV, Carta Digital. | Botón "Publicar oficial" → crea ficha + productos de compra + botón secundario "Añadir a Carta Digital". |

## Qué

### Criterios de Éxito

- [ ] `/cocina/nuevas-recetas` muestra kanban horizontal con las 5 fases de la empresa actual (seed inicial editable).
- [ ] Cada fase = columna con gradiente de color, título editable, icono ⚙️ pequeño en header para editar.
- [ ] Card arrastrable entre fases; soltar en fase siguiente → diálogo gatekeeper.
- [ ] **Botón "Comunicar"** al mover fase → envía email + crea tarea al usuario asignado a la fase destino.
- [ ] Badge de días en fase con **semáforo verde/rojo** según fecha límite configurable por fase.
- [ ] Toggle **Kanban / Tabla**. Por defecto Kanban.
- [ ] Filtros permanentes: Estado general (En progreso / Aprobada / Archivada) · Fecha creación · Título (search). Default: En progreso.
- [ ] Detalle receta con tabs: **Ficha técnica · Compra · Cata 1 · Cata 2 · Marketing · Historial**.
- [ ] En fases de cata: foto-en-vivo con **QR al móvil** (genera URL firmada temporal; cocina escanea y sube foto desde móvil directo al detalle).
- [ ] Escandallo + PVP provisional **visibles en Cata 1 y Cata 2** (se calcula desde ficha técnica borrador).
- [ ] 4 valoraciones por cata: `Rehacer entera` · `Rehacer media` · `Semi-aprobada` · `Aprobada` + comentarios `Aciertos` / `Mejoras`.
- [ ] "Rehacer entera" → mueve a fase 1 con histórico preservado. "Rehacer media" → se queda en cata esperando nueva convocatoria.
- [ ] Fase 5 botón **"Publicar oficial"** → crea registro en `fichas_tecnicas` (quitando flag borrador) + crea `productos` (compra) que faltasen + estado general receta = Aprobada.
- [ ] Botón secundario **"Añadir a Carta Digital"** → crea item en `carta_digital_items`.
- [ ] Botón **"Comunicado final"** → usa plantilla preinstalada en Gerencia → Comunicados con variables `{{titulo}}`, `{{dia_entrada_carta}}`, `{{link_ficha_tecnica}}`. Selector: toda la empresa / departamento / usuarios.
- [ ] Config de fases: icono ⚙️ en header de cada fase (edición rápida) + botón "Gestionar fases" (pantalla completa drag-and-drop).
- [ ] Límites: máx 10 fases, máx 6 sub-estados por fase, mín 2 fases.
- [ ] Borrar fase con recetas → popup bloqueante + lista de recetas afectadas.
- [ ] Seed inicial automático al primer acceso de la empresa.
- [ ] Acceso completo controlado por sistema de roles existente (no lógica propia).

### Seed inicial de 5 fases

| Orden | Fase | Color | Responsable default | Gatekeepers entrada | Plazo default |
|-------|------|-------|---------------------|---------------------|---------------|
| 1 | **Propuesta de receta** | azul | cualquier usuario | — (fase inicial) | 3 días |
| 2 | **Propuesta de compra** | naranja | Jefe Cocina / Logística | título · ingredientes (con principal/secundario) | 7 días |
| 3 | **Primera cata** | ámbar | Director | proveedores elegidos · productos con precio · fecha recepción | 14 días |
| 4 | **Segunda cata** | violeta | Director | cata 1 registrada (foto + valoración + aciertos/mejoras) | 7 días |
| 5 | **Marketing y carta** | verde | Marketing / Gerencia | cata 2 aprobada · etiquetas finales definitivas | 14 días |

### Estado general de la receta (paralelo a la fase)

- **En progreso** (default) · **Aprobada** (tras Publicar oficial) · **Archivada** (manual en cualquier momento)
- Filtro superior con las 3 opciones. Default filtrado: En progreso.

### Comportamiento Esperado (Happy Path)

1. Jefe de cocina pulsa "Nueva receta" → se abre **modal de ficha técnica** (idéntica al formulario de `fichas-tecnicas`), rellena título + ingredientes con etiqueta principal/secundario + descripción. Guarda → card en fase 1. En BD: `fichas_tecnicas.borrador=true` + `nueva_receta` vinculada.
2. Arrastra card a fase 2 → gatekeeper valida que tiene título+ingredientes. Diálogo pide seleccionar usuario responsable de fase 2 y pulsa **"Comunicar"** → email + tarea para el usuario.
3. En fase 2, usuario responsable abre detalle → tab "Compra" → selecciona proveedor (dropdown de Logística, con `+` que abre alta) · añade productos · precios · fecha recepción prevista.
4. Arrastra a fase 3 (Primera cata) → Director recibe notificación. Abre detalle → tab "Cata 1". Ve escandallo + PVP provisional calculados. Genera **QR** para subir foto desde móvil en vivo. Rellena Aciertos / Mejoras + valoración.
5. Si valoración = `Rehacer entera` → card vuelve a fase 1, con histórico visible. Si = `Rehacer media` → se queda en fase 3 esperando nueva cata. Si = `Semi-aprobada` / `Aprobada` → puede moverse a fase 4.
6. Fase 4 (Segunda cata): mismo flujo + tab muestra **histórico de cata 1** arriba. Aquí se definen **etiquetas finales** de la receta.
7. Fase 5 (Marketing): checklist de fotos / contenido RRSS. Dos botones:
   - **Publicar oficial** → quita `borrador=true` de `fichas_tecnicas`, crea productos de compra que falten en `productos`, estado general = Aprobada.
   - **Añadir a Carta Digital** → crea registro en `carta_digital_items`.
   - **Comunicado final** → abre Gerencia → Comunicados con plantilla pre-rellena.
8. Receta Aprobada sigue editable (con diálogo de confirmación "esto modifica la ficha técnica oficial").

---

## Contexto técnico

### Referencias (patrones existentes a reutilizar)

| Pieza | Ubicación | Uso |
|-------|-----------|-----|
| Kanban con fases + sub-columnas | `src/features/rrhh/components/reclutamiento/KanbanPipeline.tsx` | Copiar estructura `FaseGroup → EstadoColumn → Card` adaptada. |
| Ficha técnica (form completo) | `src/features/cocina/components/fichas-tecnicas/FichasTecnicasView.tsx` + `actions/fichas-tecnicas-actions.ts` | Se extrae el form a componente reutilizable `FichaTecnicaForm`, reusado por Nuevas Recetas en modal. |
| Proveedores / productos de compra | módulo Logística (tablas `proveedores`, `productos`) | Selectores en fase 2 + botón `+` redirige a `/logistica/proveedores/nuevo`. |
| Carta Digital | `src/features/marketing/carta-digital/` + tabla `carta_digital_items` | Botón "Añadir a Carta Digital" en fase 5. |
| Comunicados | `src/features/gerencia/components/ComunicadosView.tsx` + `actions/comunicados-actions.ts` | Plantilla nueva "Nueva receta en carta" con fórmulas `{{titulo}}`, `{{dia_entrada_carta}}`, `{{link_ficha_tecnica}}`. |
| TareasDrawer (buzón superior) | `src/features/layout/components/app-layout.tsx` línea 68 (`TareasDrawer`) | Insertar tareas tipo `nueva_receta_fase` al mover fase. |
| Get context Supabase | `src/lib/supabase/get-context.ts` | Patrón `getAppContext()`. |

### Arquitectura de código

```
src/features/cocina/nuevas-recetas/
├── types/index.ts                     # Fase, SubEstado, Receta, Cata, Gatekeeper, Historial
├── actions/
│   ├── fases-actions.ts               # CRUD fases + sub-estados + gatekeepers + responsables default
│   ├── recetas-actions.ts             # create/list/update + moverReceta(id, faseId, comunicar:bool)
│   ├── catas-actions.ts               # CRUD catas con foto
│   ├── qr-foto-actions.ts             # genera URL firmada temporal (Storage)
│   └── publicar-oficial-actions.ts    # quita borrador de ficha_tecnica + crea productos + actualiza estado
├── services/
│   ├── seed-fases.ts                  # ensureFasesDefaultForEmpresa(empresaId)
│   ├── validar-gatekeepers.ts
│   ├── calcular-escandallo.ts         # ya existe fichas-tecnicas, se reutiliza
│   └── comunicado-template.ts         # crea plantilla si no existe + abre editor pre-rellenado
├── hooks/
│   ├── useRecetasKanban.ts
│   ├── useFasesEmpresa.ts
│   └── useQrFoto.ts                   # escucha Storage de fotos subidas por QR
├── components/
│   ├── NuevasRecetasView.tsx          # entry; tabs Kanban/Tabla/Config
│   ├── RecetaKanban.tsx
│   ├── RecetaCard.tsx                 # nombre · responsable fase · días (semáforo) · progreso
│   ├── RecetaDetailDialog.tsx         # tabs FichaTecnica·Compra·Cata1·Cata2·Marketing·Historial
│   ├── ConfirmarMovimientoDialog.tsx  # gatekeepers + botón Comunicar
│   ├── FichaTecnicaModal.tsx          # envuelve FichaTecnicaForm existente
│   ├── CompraTab.tsx                  # selector proveedores + productos + fecha recepción
│   ├── CataTab.tsx                    # foto QR + aciertos/mejoras + valoración + escandallo
│   ├── QrFotoDialog.tsx               # muestra QR con URL firmada 15 min
│   ├── MarketingTab.tsx               # checklist + botones Publicar oficial / Carta Digital / Comunicado
│   ├── HistorialTab.tsx
│   ├── RecetaTabla.tsx
│   └── config/
│       ├── FasesConfigView.tsx
│       ├── FaseConfigDialog.tsx
│       └── FaseConfigQuickMenu.tsx
```

### Modelo de datos (migración `042_nuevas_recetas_pipeline.sql`)

```sql
-- 1. Config de fases por empresa
create table nueva_receta_fase (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references empresas(id) on delete cascade,
  nombre text not null,
  color text not null default 'gris',
  orden int not null,
  responsable_departamento_id uuid,
  responsable_user_id uuid,
  plazo_dias int,
  es_sistema boolean not null default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- 2. Sub-estados por fase (opcionales, vacío por defecto)
create table nueva_receta_sub_estado (
  id uuid primary key default gen_random_uuid(),
  fase_id uuid not null references nueva_receta_fase(id) on delete cascade,
  nombre text not null,
  orden int not null
);

-- 3. Gatekeepers configurables
create table nueva_receta_gatekeeper (
  id uuid primary key default gen_random_uuid(),
  fase_id uuid not null references nueva_receta_fase(id) on delete cascade,
  campo text not null,
  label text not null,
  tipo text not null check (tipo in ('texto','numero','adjunto','booleano','select','ref')),
  opciones jsonb,
  obligatorio boolean not null default true,
  orden int not null default 0
);

-- 4. Extensión de nuevas_recetas (el borrador de ficha técnica vive AQUÍ, NO en fichas_tecnicas)
alter table nuevas_recetas add column fase_id uuid references nueva_receta_fase(id);
alter table nuevas_recetas add column sub_estado_id uuid references nueva_receta_sub_estado(id);
alter table nuevas_recetas add column ficha_tecnica_id uuid references fichas_tecnicas(id);  -- solo se rellena al Publicar oficial
alter table nuevas_recetas add column estado_general text default 'en_progreso' check (estado_general in ('en_progreso','aprobada','archivada'));
alter table nuevas_recetas add column fecha_fase_inicio timestamptz;
alter table nuevas_recetas add column datos_gatekeeper jsonb default '{}'::jsonb;
alter table nuevas_recetas add column favorita boolean default false;
-- Campos del borrador de ficha técnica (mismos que fichas_tecnicas pero aquí)
alter table nuevas_recetas add column ft_descripcion text;
alter table nuevas_recetas add column ft_elaboracion text;
alter table nuevas_recetas add column ft_alergenos text[];
alter table nuevas_recetas add column ft_partida_id uuid;
alter table nuevas_recetas add column ft_tiempo_preparacion int;
alter table nuevas_recetas add column ft_racion_pax numeric(10,2);
alter table nuevas_recetas add column ft_pvp_propuesto numeric(10,2);
alter table nuevas_recetas add column ft_etiquetas_finales text[];

-- 5. Ingredientes borrador con prioridad (principal/secundario)
create table nueva_receta_ingrediente (
  id uuid primary key default gen_random_uuid(),
  receta_id uuid not null references nuevas_recetas(id) on delete cascade,
  producto_id uuid references productos(id),      -- null si es ingrediente nuevo sin alta
  nombre_libre text,                                -- usado si producto_id null
  cantidad numeric(10,3),
  unidad text,
  prioridad text check (prioridad in ('principal','secundario')) default 'secundario',
  orden int default 0
);
create index on nueva_receta_ingrediente (receta_id);

-- 6. Compra por receta
create table nueva_receta_compra (
  id uuid primary key default gen_random_uuid(),
  receta_id uuid not null references nuevas_recetas(id) on delete cascade,
  proveedor_id uuid references proveedores(id),
  producto_id uuid references productos(id),      -- null si aún no creado
  producto_nombre_propuesto text,                  -- si producto_id null, nombre libre
  precio_propuesto numeric(10,2),
  fecha_recepcion_prevista date,
  created_at timestamptz default now()
);

-- 7. Catas estructuradas
create table nueva_receta_cata (
  id uuid primary key default gen_random_uuid(),
  receta_id uuid not null references nuevas_recetas(id) on delete cascade,
  numero int not null,                             -- 1 o 2 (o más si empresa añade fases)
  fecha date not null,
  valoracion text check (valoracion in ('rehacer_entera','rehacer_media','semi_aprobada','aprobada','pendiente')),
  aciertos text,
  mejoras text,
  coste_real numeric(10,2),
  pvp_sugerido numeric(10,2),
  foto_url text,
  escandallo_snapshot jsonb,                       -- copia del escandallo al momento de la cata
  director_user_id uuid,
  director_nombre text,
  created_at timestamptz default now()
);

-- 8. Historial
create table nueva_receta_historial (
  id uuid primary key default gen_random_uuid(),
  receta_id uuid not null references nuevas_recetas(id) on delete cascade,
  fase_anterior_id uuid references nueva_receta_fase(id) on delete set null,
  fase_nueva_id uuid references nueva_receta_fase(id) on delete set null,
  usuario_id uuid,
  usuario_nombre text,
  nota text,
  tarea_creada_id uuid,                            -- link a tareas
  created_at timestamptz default now()
);

-- 9. Storage bucket `nuevas-recetas-fotos-cata` con policy empresa_id
-- 10. Comunicado template idempotente: al primer acceso se crea "Nueva receta en carta" en comunicados_plantillas
-- 11. Seed idempotente de 5 fases por empresa
-- 12. Migración de datos: mapear recetas existentes al nuevo modelo, crear fichas_tecnicas borrador si no existen, conservar 5 booleans legacy.
-- 13. RLS en todas las nuevas tablas filtrando por empresa_id (directa o vía join con nuevas_recetas).
```

---

## Fases de Implementación

### Fase 1 — BD y seed (⛔ requiere aprobación explícita)
- Migración `042_nuevas_recetas_pipeline.sql` con todo lo anterior.
- Bucket Storage `nuevas-recetas-fotos-cata` + policies.
- Función `ensure_nueva_receta_seed(empresa_id)` idempotente con las 5 fases + plantilla comunicado.
- Migración de datos existentes (los 5 booleans se conservan como lectura legacy).

### Fase 2 — Actions y lógica de negocio
- `fases-actions.ts`, `recetas-actions.ts` con `moverReceta`, `catas-actions.ts`, `qr-foto-actions.ts`, `publicar-oficial-actions.ts`.
- Servicio `comunicado-template.ts` que abre `/gerencia/comunicados/nuevo?template=...`.
- Integración con `TareasDrawer`: al mover fase con "Comunicar" → `supabase.from('tareas').insert(...)`.

### Fase 3 — Kanban base + modal ficha técnica
- `RecetaKanban.tsx`, `RecetaCard.tsx`, drag-and-drop.
- `FichaTecnicaModal.tsx` reutilizando form existente.
- `ConfirmarMovimientoDialog.tsx` con gatekeepers + botón Comunicar.

### Fase 4 — Detalle con tabs
- `CompraTab.tsx` con proveedores de Logística + `+` que redirige.
- `CataTab.tsx` con escandallo visible + 4 valoraciones + Aciertos/Mejoras.
- `QrFotoDialog.tsx` con URL firmada Storage + polling en detalle.
- `MarketingTab.tsx` con los 3 botones (Publicar oficial / Carta Digital / Comunicado).
- `HistorialTab.tsx`.

### Fase 5 — Configuración de fases
- `FasesConfigView.tsx` pantalla completa + `FaseConfigDialog.tsx` + `FaseConfigQuickMenu.tsx` (icono ⚙️).
- Drag-and-drop para reordenar, paleta de 10 colores, selector responsable, plazo por fase.
- Validaciones de borrado (popup bloqueante si hay recetas).

### Fase 6 — Integración y pulido
- Plantilla comunicado "Nueva receta en carta" con fórmulas.
- Botón "Añadir a Carta Digital".
- Tabla alternativa (toggle).
- Pulido visual + tests Playwright.

---

## Defaults tomados (sin preguntar más)

| Punto | Decisión |
|-------|----------|
| Ficha técnica | Modal encima del kanban (no redirect). Reusa form existente. |
| Borrador | Almacenado en columnas `ft_*` de `nuevas_recetas` + tabla `nueva_receta_ingrediente`. Solo se copia a `fichas_tecnicas` al Publicar oficial. |
| Post-publicar | Editable con diálogo de confirmación. |
| Rehacer entera | Vuelve a fase 1 con histórico preservado. |
| Rehacer media | Se queda en fase de cata esperando nueva convocatoria. |
| Feedback cata | Aciertos + Mejoras (libres) + Valoración (4 opciones) + Coste real + PVP sugerido. |
| Vista default | Kanban (como Reclutamiento). |
| Filtros permanentes | Estado (En progreso/Aprobada/Archivada) · Fecha creación · Título. |
| Card kanban | Nombre · responsable fase · días (semáforo verde/rojo) · progreso %. |
| Motivos archivado | Dropdown sugerencias + texto libre. |
| Acceso | Sistema de roles existente, sin lógica propia. |

---

## Riesgos

| Riesgo | Mitigación |
|--------|------------|
| Borrador de ficha técnica confunde con ficha oficial. | El borrador vive en columnas `ft_*` de `nuevas_recetas`; solo al "Publicar oficial" se crea fila en `fichas_tecnicas`. El submódulo Fichas Técnicas no ve borradores. |
| QR móvil requiere URL firmada con TTL → si el cocinero tarda, expira. | TTL 15 min, botón "Regenerar QR" en el diálogo. |
| Crear productos de compra al "Publicar oficial" puede duplicar productos existentes. | Check por nombre + proveedor antes de insertar; si existe, se linkea. |
| Plantilla de comunicados depende de `comunicados_plantillas` — ¿existe? | Verificar antes de fase 2; si no existe, la añadimos como parte de la migración. |
| Muchas recetas → kanban infinito horizontal. | Archivadas no aparecen por defecto. Paginación virtual si +100 por fase (iteración futura). |

---

*Al recibir luz verde, arranco por Fase 1 (BD + seed + migración idempotente).*
