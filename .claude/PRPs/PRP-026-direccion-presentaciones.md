# PRP-026: Presentaciones — submódulo de Dirección (motor Google Gemini)

> **Estado**: APROBADO
> **Fecha**: 2026-04-17
> **Proyecto**: Balles-Hosteleros
> **Ruta propuesta**: `/direccion/presentaciones`
> **Feature dir**: `src/features/direccion/presentaciones/`
> **Motor IA**: Google Gemini API (gratis vía Google AI Studio)
> **Futura integración**: Google Workspace / Slides (fuera de alcance V1)

---

## Objetivo

Construir un **submódulo Presentaciones** dentro de Dirección que permita al usuario describir en lenguaje natural la presentación que necesita (tema, audiencia, nº slides, tono) y que **Google Gemini** genere el contenido estructurado. El sistema renderiza las slides con **Reveal.js** aplicando el **branding de la empresa** (logo, colores, tipografías) para mantener identidad visual constante en todas las presentaciones. Exportable a PDF/PPTX y guardado en biblioteca por empresa.

## Por Qué

| Problema | Solución |
|----------|----------|
| El director pierde horas haciendo presentaciones desde cero. | Generador IA con un prompt → slides listos en ~30 s. |
| Cada presentación acaba con identidad visual distinta. | `empresa_branding` aplicado vía CSS variables a cada deck. |
| Herramientas externas (Gamma Pro, Canva Pro) requieren suscripción extra que el cliente no tiene. | **Google Gemini API es gratis** en tier generoso (15 RPM, 1M tokens/día en 2.0 Flash). |
| No hay trazabilidad ni biblioteca histórica. | Tabla `presentaciones` con autor, fecha, estado, prompt. |
| Queremos alinear todo el stack con Google (cliente ya tiene cuenta). | Gemini nativo abre camino a Google Slides/Drive/Workspace en V2. |

**Valor de negocio**:
- Ahorro: de 1-2 h por presentación a ~2 min.
- Consistencia de marca: 100 % de decks con branding correcto.
- Coste cero de IA (tier free de Google AI Studio).
- Ecosistema Google: base para V2 (Slides API, Drive, Calendar).

## Qué

### Criterios de Éxito

- [ ] Usuario autenticado entra a `/direccion/presentaciones` y ve biblioteca de su empresa.
- [ ] Botón **"Nueva presentación"** abre modal con: prompt, audiencia, nº slides (5-30), tono, idioma.
- [ ] Al enviar, `POST /api/presentaciones/generar` llama a **Gemini 2.0 Flash** con `responseSchema` (structured output nativo), valida con Zod, guarda en BD.
- [ ] Respuesta en **≤ 30 s** con JSON estructurado (`{titulo, slides[{layout, titulo, bullets, notas}]}`).
- [ ] Renderizado con **Reveal.js** aplicando automáticamente **branding** vía CSS variables (logo, colores, tipografías).
- [ ] **Configuración de marca** en `/direccion/presentaciones/branding` persiste: logo (Supabase Storage), colores, tipografías. Aplicación automática a nuevas presentaciones.
- [ ] Editor permite editar texto, reordenar slides (drag), regenerar slide individual.
- [ ] Modo **Presentar** fullscreen con notas de ponente.
- [ ] **Exportar PDF** (Reveal print-to-PDF) y **PPTX** (`pptxgenjs` server-side con branding).
- [ ] Biblioteca con filtros y acciones: abrir, duplicar, renombrar, archivar, eliminar.
- [ ] RLS por `empresa_id`; try/catch + logs en escrituras ([MEMORY.md](../memory/MEMORY.md)).
- [ ] Si falta `GEMINI_API_KEY` → error 412 con instrucción de configurar.

### Comportamiento Esperado (Happy Path)

1. Director entra a **Dirección → Presentaciones**. Banner "Configura tu marca" si no hay branding.
2. Configura logo + colores primario/secundario + tipografías. Guarda.
3. Pulsa **"Nueva presentación"**. Modal:
   - Tema: "Resultados Q1 2026 — plan de acción"
   - Audiencia: "Equipo de sala y cocina"
   - Slides: 10 · Tono: Motivacional · Idioma: Español
4. Sistema envía prompt a Gemini con `responseMimeType: 'application/json'` + `responseSchema`.
5. Zod valida. Si falla parse → 1 reintento con mensaje correctivo.
6. Crea fila en `presentaciones` + slides en `presentacion_slides` + `branding_snapshot`.
7. Navega a `/direccion/presentaciones/[id]` → editor con preview Reveal.js a la izquierda, lista slides a la derecha. CSS vars inyectadas desde branding.
8. Edita texto, arrastra para reordenar, "Regenerar esta slide" (llama Gemini con contexto del deck).
9. Botón **Presentar** → fullscreen con notas + navegación teclado.
10. **Exportar PDF** / **Exportar PPTX** descarga con branding aplicado.
11. Biblioteca: duplicar usa prompt original como plantilla.

---

## Contexto

### Referencias (patrones existentes)

- **Feature-first**: `src/features/direccion/` ya tiene `actions/`, `components/`, `hooks/`, `services/`, `types/`. El submódulo vive en `src/features/direccion/presentaciones/`.
- **Cliente IA actual**: `src/lib/ia/openrouter.ts` — patrón para crear `src/lib/ia/gemini.ts` con `@google/generative-ai` SDK o REST directo.
- **Rutas IA existentes**: `src/app/api/soporte/chat/route.ts` — patrón para `src/app/api/presentaciones/generar/route.ts` y `regenerar-slide/route.ts`.
- **Actions pattern**: `src/features/direccion/actions/documentacion-actions.ts` → `getContext()` con `supabase.auth.getUser() + profiles.empresa_id`.
- **Ruta del módulo**: `src/app/(main)/direccion/` ya tiene `aperturas`, `cronogramas`, `documentacion`, `estructura`. Añadir `presentaciones/`.
- **Sidebar**: `src/features/layout/components/app-sidebar.tsx` — añadir entry "Presentaciones" bajo Dirección.
- **Storage**: bucket `empresa-logos` ya operativo.
- **Estándar UI**: `@/shared/components/ui/*` + `<Button variant="primary" size="lg">` con icono, posición `top-4 right-4`.
- **Protocolo guardado**: try/catch + `console.error` + `{ok, error}` ([MEMORY.md](../memory/MEMORY.md)).

### Referencias externas

- **Google AI Studio**: https://aistudio.google.com/ — crear API key gratis (tier free: 15 RPM, 1M tokens/día en Gemini 2.0 Flash).
- **Gemini API — structured output**: https://ai.google.dev/gemini-api/docs/structured-output — `responseMimeType: 'application/json'` + `responseSchema`.
- **SDK**: `@google/generative-ai` (npm) — `new GoogleGenerativeAI(key).getGenerativeModel({model: 'gemini-2.0-flash'})`.
- **Reveal.js**: https://revealjs.com/ — HTML slides con navegación, notas, overview, PDF export.
- **pptxgenjs**: https://gitbrent.github.io/PptxGenJS/ — generación PPTX server-side.

### Arquitectura Propuesta (Feature-First)

```
src/lib/ia/
└── gemini.ts                        # cliente Gemini (helper chatJSON con schema)

src/features/direccion/presentaciones/
├── actions/
│   ├── presentaciones-actions.ts    # CRUD biblioteca
│   └── branding-actions.ts          # get/save branding empresa
├── components/
│   ├── BibliotecaView.tsx
│   ├── NuevaPresentacionModal.tsx
│   ├── EditorView.tsx
│   ├── SlideEditor.tsx
│   ├── DeckPreview.tsx              # iframe Reveal con branding
│   ├── PresentarView.tsx            # fullscreen
│   ├── BrandingForm.tsx
│   └── ExportButtons.tsx
├── hooks/
│   ├── useBiblioteca.ts
│   ├── usePresentacion.ts
│   └── useBranding.ts
├── services/
│   ├── reveal-renderer.ts           # HTML Reveal desde slides + branding
│   ├── pptx-exporter.ts             # pptxgenjs con branding
│   ├── pdf-exporter.ts              # print-to-PDF Reveal
│   └── ia-presentacion.ts           # prompts + schema Zod + wrapper Gemini
├── types/
│   └── presentaciones.ts            # Slide, Presentacion, Branding, Layout
└── data/
    └── layouts.ts                   # catálogo layouts

src/app/(main)/direccion/presentaciones/
├── page.tsx                         # BibliotecaView
├── branding/page.tsx                # BrandingForm
├── [id]/page.tsx                    # EditorView
└── [id]/present/page.tsx            # PresentarView fullscreen

src/app/api/presentaciones/
├── generar/route.ts                 # POST { prompt, opts } → JSON slides
├── regenerar-slide/route.ts         # POST { presentacionId, slideId } → slide
├── exportar-pdf/route.ts            # POST { id } → PDF
└── exportar-pptx/route.ts           # POST { id } → PPTX
```

### Modelo de Datos

```sql
-- Migración 036_direccion_presentaciones.sql

-- 1. Branding por empresa
create table if not exists public.empresa_branding (
  empresa_id        uuid primary key references public.empresas(id) on delete cascade,
  logo_url          text,
  color_primario    text not null default '#0F172A',
  color_secundario  text not null default '#3B82F6',
  color_fondo       text not null default '#FFFFFF',
  color_texto       text not null default '#0F172A',
  tipografia_titulo text not null default 'Inter',
  tipografia_cuerpo text not null default 'Inter',
  fondo_url         text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

-- 2. Presentaciones
create table if not exists public.presentaciones (
  id                uuid primary key default gen_random_uuid(),
  empresa_id        uuid not null references public.empresas(id) on delete cascade,
  titulo            text not null,
  prompt_original   text not null,
  audiencia         text,
  tono              text not null default 'formal'
                      check (tono in ('formal','cercano','motivacional','tecnico')),
  idioma            text not null default 'es',
  num_slides        integer not null default 10,
  estado            text not null default 'borrador'
                      check (estado in ('borrador','listo','archivada')),
  branding_snapshot jsonb not null default '{}',
  modelo_ia         text default 'gemini-2.0-flash',
  tokens_input      integer,
  tokens_output     integer,
  created_by        uuid references auth.users(id) on delete set null,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index if not exists idx_pres_empresa on public.presentaciones(empresa_id, created_at desc);

-- 3. Slides
create table if not exists public.presentacion_slides (
  id              uuid primary key default gen_random_uuid(),
  presentacion_id uuid not null references public.presentaciones(id) on delete cascade,
  orden           integer not null,
  layout          text not null default 'bullets'
                    check (layout in ('portada','bullets','cita','comparacion','imagen','cierre')),
  titulo          text,
  contenido       jsonb not null default '{}',
  notas           text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (presentacion_id, orden)
);

create index if not exists idx_slides_pres on public.presentacion_slides(presentacion_id, orden);

-- Triggers updated_at
create or replace function public.set_updated_at() returns trigger as $$
begin new.updated_at = now(); return new; end;
$$ language plpgsql;

drop trigger if exists trg_brand_upd on public.empresa_branding;
create trigger trg_brand_upd before update on public.empresa_branding
  for each row execute function public.set_updated_at();

drop trigger if exists trg_pres_upd on public.presentaciones;
create trigger trg_pres_upd before update on public.presentaciones
  for each row execute function public.set_updated_at();

drop trigger if exists trg_slide_upd on public.presentacion_slides;
create trigger trg_slide_upd before update on public.presentacion_slides
  for each row execute function public.set_updated_at();

-- RLS
alter table public.empresa_branding     enable row level security;
alter table public.presentaciones       enable row level security;
alter table public.presentacion_slides  enable row level security;

create policy "brand_read" on public.empresa_branding for select to authenticated
  using (empresa_id in (select p.empresa_id from profiles p where p.user_id = auth.uid()));
create policy "brand_manage" on public.empresa_branding for all to authenticated
  using (empresa_id in (select p.empresa_id from profiles p where p.user_id = auth.uid()))
  with check (empresa_id in (select p.empresa_id from profiles p where p.user_id = auth.uid()));

create policy "pres_read" on public.presentaciones for select to authenticated
  using (empresa_id in (select p.empresa_id from profiles p where p.user_id = auth.uid()));
create policy "pres_manage" on public.presentaciones for all to authenticated
  using (empresa_id in (select p.empresa_id from profiles p where p.user_id = auth.uid()))
  with check (empresa_id in (select p.empresa_id from profiles p where p.user_id = auth.uid()));

create policy "slides_read" on public.presentacion_slides for select to authenticated
  using (presentacion_id in (
    select id from public.presentaciones pr
    where pr.empresa_id in (select p.empresa_id from profiles p where p.user_id = auth.uid())
  ));
create policy "slides_manage" on public.presentacion_slides for all to authenticated
  using (presentacion_id in (
    select id from public.presentaciones pr
    where pr.empresa_id in (select p.empresa_id from profiles p where p.user_id = auth.uid())
  ))
  with check (presentacion_id in (
    select id from public.presentaciones pr
    where pr.empresa_id in (select p.empresa_id from profiles p where p.user_id = auth.uid())
  ));
```

### Schema Zod de salida IA (contrato)

```ts
// src/features/direccion/presentaciones/services/ia-presentacion.ts
export const SlideSchema = z.object({
  layout: z.enum(['portada','bullets','cita','comparacion','imagen','cierre']),
  titulo: z.string().min(1).max(120),
  bullets: z.array(z.string().max(200)).max(6).optional(),
  cuerpo: z.string().max(600).optional(),
  cita: z.string().max(300).optional(),
  notas: z.string().max(500).optional(),
});

export const PresentacionGeneradaSchema = z.object({
  titulo: z.string().min(1).max(150),
  slides: z.array(SlideSchema).min(3).max(30),
});
```

### Cliente Gemini

```ts
// src/lib/ia/gemini.ts
import { GoogleGenerativeAI } from '@google/generative-ai';

export async function geminiJSON<T>(
  prompt: string,
  systemInstruction: string,
  responseSchema: unknown,
): Promise<unknown> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error('GEMINI_API_KEY no configurada');
  const genAI = new GoogleGenerativeAI(key);
  const model = genAI.getGenerativeModel({
    model: 'gemini-2.0-flash',
    systemInstruction,
    generationConfig: {
      responseMimeType: 'application/json',
      responseSchema,
    },
  });
  const res = await model.generateContent(prompt);
  return JSON.parse(res.response.text());
}
```

---

## Blueprint (Assembly Line)

### Fase 1: Modelo de datos + branding BD
**Objetivo**: Migración `036` con 3 tablas, RLS, triggers, seed branding por empresa existente.
**Validación**: migración aplicada sin error; `select * from empresa_branding` 1 fila por empresa; RLS bloquea acceso cruzado.

### Fase 2: Configuración de marca (UI + actions)
**Objetivo**: `/direccion/presentaciones/branding` con upload logo (Storage), color pickers, selector tipografías. `branding-actions.ts` con `getBranding()`/`saveBranding()`.
**Validación**: guardar persiste; recargar muestra valores; redirige a login sin sesión.

### Fase 3: Cliente Gemini + API generar
**Objetivo**: Instalar `@google/generative-ai`, crear `src/lib/ia/gemini.ts`, endpoint `POST /api/presentaciones/generar` con structured output + Zod + 1 reintento. Persiste presentación + slides + branding_snapshot.
**Validación**: curl endpoint devuelve JSON válido ≤ 30 s; registro creado; si falta key → 412.

### Fase 4: Biblioteca + Nueva presentación
**Objetivo**: `/direccion/presentaciones` con listado + filtros + modal. `useBiblioteca` + `usePresentacion`. Al generar navega a `[id]`.
**Validación**: flujo end-to-end (prompt → generar → biblioteca → abrir); acciones duplicar/renombrar/archivar con confirmación.

### Fase 5: Editor + renderizado Reveal.js
**Objetivo**: `EditorView` con preview Reveal.js en iframe, edición slide, drag reorder, regenerar slide individual. Branding via CSS variables.
**Validación**: cambiar color en branding cambia look sin regenerar; edición persiste; reorden respeta `orden`.

### Fase 6: Modo Presentar + exportaciones
**Objetivo**: `/direccion/presentaciones/[id]/present` fullscreen + notas. Exportar PDF (Reveal) y PPTX (pptxgenjs con branding).
**Validación**: PDF con logo+colores correctos; PPTX abre en PowerPoint/Keynote fiel al deck.

### Fase 7: Sidebar + QA final
**Objetivo**: Entry "Presentaciones" en sidebar bajo Dirección. Typecheck + build + Playwright.
**Validación**:
- [ ] `npm run typecheck` limpio
- [ ] `npm run build` exitoso
- [ ] Playwright screenshot biblioteca + branding + editor + presentar
- [ ] RLS auditada
- [ ] Logs try/catch en todas las escrituras

---

## Aprendizajes (Self-Annealing)

*Vacío — por rellenar durante `/bucle-agentico`.*

---

## Gotchas

- [ ] **Gemini API key**: guardar SOLO en server (`process.env.GEMINI_API_KEY`). Crear en https://aistudio.google.com/apikey.
- [ ] **Rate limits free tier**: 15 RPM en Gemini 2.0 Flash. Si 429, backoff exponencial (2s, 5s, 10s) y mensaje claro en UI.
- [ ] **Structured output**: Gemini soporta `responseSchema` nativo (mejor que prompt engineering). Usar JSONSchema con tipos claros.
- [ ] **Zod parse + reintento**: si Gemini devuelve JSON inválido (raro con schema nativo), 1 reintento con mensaje correctivo.
- [ ] **Reveal.js y SSR**: `dynamic(..., { ssr: false })`; Reveal toca `window` al montar.
- [ ] **PPTX branding fidelity**: `pptxgenjs` no soporta CSS; mapear `color_primario` → `fill`, tipografía → `fontFace` explícitamente.
- [ ] **Logo PPTX**: cargar como base64 en server (no URL remota).
- [ ] **Branding snapshot**: copiar branding al generar; editar branding no rompe presentaciones pasadas.
- [ ] **Notas ponente**: NO incluir en PDF público salvo toggle explícito.
- [ ] **Tipografías**: Google Fonts CDN en preview; embed en PPTX. No TTF propios en V1.
- [ ] **Tamaño deck**: máx 30 slides, 6 bullets por slide (control de tokens y calidad).
- [ ] **Timeout serverless**: Vercel Hobby 60s por función. Si Gemini tarda más, subir plan o fragmentar. En free tier Gemini responde ~10-20s para 10 slides.

## Anti-Patrones

- NO llamar a Gemini desde el cliente con key expuesta.
- NO guardar el HTML del deck en BD (regenerar desde `presentacion_slides`).
- NO hardcodear colores: CSS variables desde `branding_snapshot`.
- NO omitir Zod en respuesta IA.
- NO bloquear UI esperando generación: spinner + estado `generando`.
- NO borrar presentaciones físicamente: `estado='archivada'`.
- NO tocar `empresa_logos` (migración 023): crear tabla nueva `empresa_branding`.

---

*PRP aprobado 2026-04-17. Motor único: Google Gemini 2.0 Flash (free tier). Prepara camino a integración Google Workspace en V2.*
