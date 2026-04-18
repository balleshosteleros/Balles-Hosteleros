---
name: Página Web — CMS multi-tenant
description: Submódulo Marketing → Página Web. Editor de bloques con preview live, dominios Vercel, leads. PRP-029 implementado 2026-04-18.
type: project
---

Submódulo Marketing > Página Web operativo desde 2026-04-18 (PRP-029).

**Arquitectura clave:**
- Feature dir: `src/features/marketing/pagina-web/`
- Ruta admin: `/marketing/pagina-web` (listado) + `/marketing/pagina-web/[id]` (editor) + `/[id]/dominios` + `/[id]/preview`
- Rutas públicas: `src/app/__site/[[...slug]]/page.tsx` (catch-all aislado del panel)
- Resolución por hostname: `src/lib/supabase/proxy.ts` rewritea a `/__site/...` cuando el host NO está en `APP_PRIMARY_HOSTS`
- BD: migración `040_marketing_pagina_web.sql` — tablas `paginas_web`, `paginas_web_dominios`, `paginas_web_versiones`, `leads_web` + bucket `paginas-web-assets`
- Storage anon-readable / auth-writable con RLS por `empresa_id`

**Env vars server-only que deben configurarse en Vercel:**
- `VERCEL_TOKEN` — PAT con scope Projects + Domains
- `VERCEL_PROJECT_ID` — ID del proyecto destino
- `VERCEL_TEAM_ID` — opcional si el proyecto vive en team scope
- `APP_PRIMARY_HOSTS` — hosts del SaaS separados por coma (ej. `app.balleshosteleros.com,balleshosteleros.com`)
- `PAGINA_WEB_IP_SALT` — salt para hash sha256 de IPs (RGPD)

**Bloques soportados (11):** hero, galeria, menu, reservas, testimonios, cta, formulario, mapa, footer, texto_libre, video. Validación Zod por tipo en cada escritura. `texto_libre` se sanitiza server-side con DOMPurify.

**Integración con otros módulos:**
- Bloque `menu` con `fuente: "carta_items"` lee de `carta_items` (sincroniza con carta digital).
- `leads_web` se capturan con ip_hash + UTM + referrer; disponibles para el feature de captación.

**Migración Bacanal:** se reconstruye 1:1 vía endpoint `/api/pagina-web/importar-url` → crea bloques BORRADOR desde HTML público. El admin revisa, añade el dominio `bacanalmadrid.com` desde `/dominios`, configura DNS en SiteGround (A record apex `76.76.21.21` o CNAME subdominio a `cname.vercel-dns.com`), y al pasar a VERIFICADO puede publicar.
