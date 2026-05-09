# BUSINESS_LOGIC.md - ReelForge AI

> Generado por SaaS Factory V4 | Fecha: 2026-05-07
> Sintetizado de: Mistral, DeepSeek, ChatGPT, Gemini, Manus, Qwen, Kimi

---

## 1. Problema de Negocio

**Dolor:** Las empresas (restaurantes, hoteles, clínicas, SaaS) necesitan
contenido en video constante para redes sociales, onboarding de clientes y
demos de producto. Producirlo manualmente cuesta $100-300/mes con freelancers,
tarda 15-30 min por video, y no escala.

**Costo actual:**
- $100-300/mes en editores o herramientas como Loom/CapCut
- 15-30 min de edición humana por video
- Imposible personalizar a escala (nombre del cliente, sus colores, su logo)
- Sin automatización → sin consistencia → sin crecimiento en redes

---

## 2. Solución

**Propuesta de valor:** Una plataforma SaaS que convierte texto/datos en videos
MP4 profesionales automáticamente, usando IA para generar HTML animado y
HyperFrames como motor de renderizado. Sin edición manual, sin costos variables
por render.

**Flujo principal (Happy Path):**
1. Usuario entra al dashboard y crea un nuevo video
2. Elige un template (onboarding, reel social, demo de producto, promocional)
3. Completa un formulario corto: nombre de negocio, colores, texto clave, CTA
4. La IA (Claude vía Vercel AI SDK) genera el HTML animado con GSAP
5. El job de render se encola y HyperFrames procesa el HTML → MP4
6. El usuario recibe notificación y puede descargar/compartir el video

---

## 3. Usuario Objetivo

**Rol principal:** Dueño de negocio local (restaurante, hotel, clínica, SaaS
pequeño) que necesita contenido diario en redes sociales pero no tiene equipo
de diseño ni presupuesto para agencias.

**Rol secundario:** Agencia de marketing digital que genera videos personalizados
para múltiples clientes a escala, facturando como servicio premium.

**Perfil:** No técnico, busca resultados (más clientes, más ventas) no
herramientas. Valora velocidad y simplicidad sobre configuración.

---

## 4. Arquitectura de Datos

**Input:**
- Nombre del negocio y tipo (restaurante, hotel, clínica, etc.)
- Colores de marca (hex)
- Logo (URL o upload)
- Texto/copy del video
- Call-to-action
- Template seleccionado
- Prompt libre (opcional, para usuarios avanzados)

**Output:**
- Video MP4 (1080p horizontal o 9:16 vertical)
- URL pública con CDN para compartir
- Caption + hashtags generados por IA para redes sociales

**Tablas Neon PostgreSQL (Drizzle ORM):**
- `users`: id, name, email, password_hash, plan, renders_used, renders_limit
- `videos`: id, user_id, title, template_id, status, html_content, video_url, duration, metadata
- `templates`: id, name, category, description, preview_url, html_base, variables_schema

---

## 5. KPI de Éxito

**MVP (semana 1-2):**
- Usuario puede registrarse, crear un video desde template, y descargarlo
- Tiempo de generación < 60 segundos para video de 30s

**Negocio (mes 1-3):**
- 40 usuarios Starter ($49/mes) = $1,960
- 35 usuarios Pro ($99/mes) = $3,465
- 15 usuarios Agency ($299/mes) = $4,485
- **Total: ~$10K/mes**

---

## 6. Especificación Técnica

### Features a Implementar (Feature-First)

```
src/features/
├── auth/           → Login/Signup con NextAuth + bcryptjs
├── videos/         → CRUD de videos + render jobs
├── templates/      → Librería de 5 templates listos
└── ai-generate/    → Generación de HTML con Claude AI
```

### Stack Confirmado

| Capa | Tecnología |
|------|-----------|
| Framework | Next.js 15 + React 19 + TypeScript |
| Estilos | Tailwind CSS 4 + shadcn/ui |
| Auth | NextAuth.js v5 (CredentialsProvider) |
| DB ORM | Drizzle ORM |
| DB Host | Neon PostgreSQL (serverless) |
| AI Engine | Vercel AI SDK v5 + Claude (Anthropic) |
| Render | HyperFrames CLI (Node.js + FFmpeg) |
| Queue | BullMQ + Redis (o DB polling para MVP) |
| Validación | Zod |
| Estado | Zustand |

### Templates Incluidos (MVP)

1. **Onboarding Bienvenida** — "Hola {nombre}, bienvenido a {negocio}"
2. **Reel Promocional** — Oferta/descuento del día con animación GSAP
3. **Demo de Producto** — 30s mostrando features clave
4. **Presentación de Negocio** — Logo + servicios + CTA
5. **Datos y Métricas** — Números animados (ventas, crecimiento)

### Planes de Precios

| Plan | Precio | Videos/mes |
|------|--------|-----------|
| Free | $0 | 3 videos |
| Starter | $49 | 30 videos |
| Pro | $99 | 100 videos |
| Agency | $299 | 500 videos + API |

### Próximos Pasos

1. [x] BUSINESS_LOGIC.md
2. [ ] Setup proyecto Next.js + deps
3. [ ] Schema Drizzle + migración Neon
4. [ ] Auth (login/signup/session)
5. [ ] Dashboard + Videos feature
6. [ ] Templates feature + AI generation
7. [ ] API routes render
8. [ ] Landing page + Pricing
9. [ ] Build + typecheck
