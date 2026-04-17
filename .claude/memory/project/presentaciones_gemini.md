---
name: Presentaciones — Submódulo Dirección con Google Gemini
description: Submódulo "Presentaciones" bajo Dirección, integrado con Google Gemini (tier free) y sistema de branding por empresa. PRP-026. Operativo desde 2026-04-18 tras migración 036.
type: project
---

# Presentaciones — Submódulo de Dirección

**Estado:** OPERATIVO desde 2026-04-18 (migración 036 aplicada en Supabase)
**PRP:** [PRP-026-direccion-presentaciones.md](../../PRPs/PRP-026-direccion-presentaciones.md)
**Motor IA:** Google Gemini 2.0 Flash (tier free de Google AI Studio)
**Decisión clave:** se descartó Gamma API porque requiere plan Pro de pago; Gemini es gratuito y abre camino a integración Google Workspace futura.

## Why

El director perdía 1–2 h por presentación haciéndolas desde cero con identidad visual inconsistente. Ahora: un prompt en lenguaje natural → slides con la imagen de marca de la empresa aplicada automáticamente, exportables a PPTX y a PDF (vía imprimir).

## How to apply

- Todas las llamadas a Gemini son **server-side** (`src/app/api/presentaciones/*`). Nunca llamar desde cliente; la key `GEMINI_API_KEY` vive solo en `.env.local` y Vercel.
- El contrato IA está validado con Zod (`PresentacionGeneradaSchemaZ`) + `responseSchema` nativo de Gemini: si cambian los campos, actualizar **ambos** en `src/features/direccion/presentaciones/services/ia-presentacion.ts`.
- **Branding snapshot**: cada presentación guarda copia del branding al crear en `presentaciones.branding_snapshot`. Editar `empresa_branding` NO retoca presentaciones antiguas — así evitamos regresiones visuales.
- Para añadir un nuevo layout: actualizar enum en migración, `Layout` en `types/presentaciones.ts`, schema Zod, schema Gemini JSONSchema, y `SlideRenderer.tsx` + `exportar-pptx/route.ts`.
- **PDF**: no hay API dedicada — se usa `/direccion/presentaciones/[id]/print` con `window.print()` + CSS `@page landscape`. Esto evita dependencias pesadas de PDF server-side.
- Entry en sidebar: `src/features/layout/components/app-sidebar.tsx` → `direccionSubs` con icono `Presentation` (lucide).

## Arquitectura

```
src/lib/ia/gemini.ts                                        # Cliente Gemini genérico
src/features/direccion/presentaciones/
├── actions/{branding,presentaciones}-actions.ts            # Server actions
├── components/{BrandingForm,BibliotecaView,NuevaPresentacionModal,
│              EditorView,PresentarView,PrintView,SlideRenderer}.tsx
├── services/ia-presentacion.ts                             # Prompts + Zod + Gemini schema
├── types/presentaciones.ts
└── data/layouts.ts

src/app/api/presentaciones/
├── generar/route.ts                                        # POST crea presentación + slides
├── regenerar-slide/route.ts                                # POST regenera 1 slide
└── exportar-pptx/route.ts                                  # POST devuelve PPTX (pptxgenjs)

src/app/(main)/direccion/presentaciones/
├── page.tsx                                                # biblioteca
├── branding/page.tsx                                       # configuración marca
├── [id]/page.tsx                                           # editor
├── [id]/present/page.tsx                                   # modo presentar fullscreen
└── [id]/print/page.tsx                                     # vista imprimible (Ctrl+P → PDF)
```

## Modelo de datos (migración 036)

- `empresa_branding` (1 por empresa): logo_url, color_primario/secundario/fondo/texto, tipografia_titulo/cuerpo, fondo_url.
- `presentaciones`: metadatos, estado, modelo_ia, tokens, branding_snapshot JSONB.
- `presentacion_slides`: orden, layout, titulo, contenido JSONB, notas. `unique(presentacion_id, orden)`.
- RLS por `empresa_id` vía `profiles`. Slides heredan vía join a presentación.

## Dependencias añadidas (2026-04-17)

- `@google/generative-ai` — cliente oficial Gemini
- `pptxgenjs` — export PPTX server-side
- `reveal.js` — instalado pero NO usado en V1 (se eligió SlideRenderer custom con CSS vars para simplicidad SSR). Candidato a futuro si se necesita animación avanzada.

## Layouts soportados

`portada` · `bullets` · `cita` · `comparacion` · `imagen` · `cierre`

## Gotchas aprendidos

- Gemini `SchemaType.STRING` con `enum` requiere `format: "enum"` (TypeScript error en caso contrario).
- `pptxgenjs.addShape` espera un string tipado; usar `"rect" as never` para evitar el type error sin regresar a `any`.
- El parámetro `params` de Next.js 16 App Router es `Promise<{id: string}>` en Server Components.
- PDF vía `window.print()` necesita `@page { size: landscape }` y `page-break-after: always` por slide.

## Pendientes V2 (no bloquean)

- Integración Google Workspace: export directo a Google Slides con la misma branding.
- Generación de imágenes para layout `imagen` (ahora es placeholder). Candidato: Gemini image API o Vertex Imagen.
- Branding opcional: fuentes custom (TTF upload). Hoy solo Google Fonts curadas.
- Reveal.js para animaciones cinematográficas.
- API dedicada para PDF si el cliente pide export desatendido (sin Ctrl+P).
