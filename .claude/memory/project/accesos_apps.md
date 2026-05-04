---
name: Accesos a apps externas
description: Tabla accesos_apps en Supabase es la fuente de verdad; data/accesos-apps.ts solo deja constantes (CATEGORIAS_APP, DEPARTAMENTOS, types)
type: project
---

Persistencia de "Accesos a apps" (admin: Ajustes → Accesos; vista: RRHH → Accesos; dropdown header).

**Fuente de verdad:** tabla `public.accesos_apps` (migración 060_accesos_apps.sql, aplicada 2026-05-03).

**Why:** antes vivía solo como sample en `src/features/rrhh/data/accesos-apps.ts` (HABANA_APPS / BACANAL_APPS arrays). Cualquier alta/edición desde la UI vivía en `useState` y se perdía al recargar.

**How to apply:**
- Lecturas → `listAccesosApps(empresaSlug)` o `listAllAccesosApps()` desde `src/features/rrhh/actions/accesos-apps-actions.ts`.
- Escrituras → `createAccesoApp` / `updateAccesoApp` / `deleteAccesoApp` (mismo archivo).
- `data/accesos-apps.ts` aún exporta types + constantes (`CATEGORIAS_APP`, `DEPARTAMENTOS`); las arrays HABANA_APPS/BACANAL_APPS y las funciones `getAccesosAppsPorEmpresa/PorDepartamento/getAllAccesosApps` quedan como fallback histórico — no usar en código nuevo.
- Schema: `id text PK`, `empresa_slug text` (slug "habana"/"bacanal", NO uuid — alineado con selector local). RLS abierta a `authenticated`. Trigger `updated_at` automático.
- IDs legibles: convención `<empresa>-<categoria>N` (ej. `ha-sg6`, `ba-pd2`); altas desde UI usan `app-<timestamp>`.
