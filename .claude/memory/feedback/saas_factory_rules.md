---
name: Reglas SaaS Factory
description: Seguir siempre las convenciones del Factory OS
type: feedback
---

Seguir las convenciones del Factory OS de SaaS Factory V4.

**Why:** El proyecto se construyó con SaaS Factory; romper la convención genera deuda técnica y rompe los skills.
**How to apply:**
- Agent-first: el usuario habla, el agente ejecuta — nunca pedirle al usuario que corra comandos o edite archivos.
- Golden Path: Next.js 16 + React 19 + Tailwind 3.4 + Supabase + Vercel AI SDK v5 + Zustand + Zod.
- Features complejas → `/prp` antes de `/bucle-agentico`.
- Feature-first: `src/features/[feature]/{components,hooks,services,types,store}`.
- RLS siempre habilitada en tablas Supabase.
