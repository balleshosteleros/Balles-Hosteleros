---
name: Cocina — NUEVAS RECETAS (antes NUEVOS PLATOS)
description: Renombrado del submódulo Cocina "NUEVOS PLATOS" → "NUEVAS RECETAS" el 2026-04-18, incluye BD, rutas y UI
type: project
---

El submódulo **NUEVOS PLATOS** de COCINA se renombró a **NUEVAS RECETAS** el 2026-04-18. La funcionalidad es idéntica; solo cambia la nomenclatura.

Estado actual (estable):
- Ruta: `/cocina/nuevas-recetas` (no `/cocina/nuevos-platos`)
- Feature: `src/features/cocina/components/nuevas-recetas/NuevasRecetasView.tsx`
- Actions: `src/features/cocina/actions/nuevas-recetas-actions.ts` (funciones `listNuevasRecetas`, `createNuevaReceta`, `updateRecetaPasos`, `updateRecetaEstado`, `deleteNuevaReceta`)
- Tabla BD: `public.nuevas_recetas` (antes `nuevos_platos`) — `empresa_id` es `uuid references empresas(id)`, `propuesto_por uuid` sin FK
- Enums: `nueva_receta_estado`, `nueva_receta_destino`
- Migración: `039_rename_nuevos_platos.sql` — idempotente (renombra si existe vieja, crea si no)
- Sidebar: `cocinaSubs` contiene "NUEVAS RECETAS" con icono `Sparkles`

**Why:** El usuario consideró que "recetas" describe mejor el flujo (propuesta + catas + fichas técnicas) que "platos", que sugiere solo producto terminado.

**How to apply:** Si aparecen referencias a `nuevos_platos`, `NuevosPlatosView`, `nuevos-platos-actions` o `/cocina/nuevos-platos`, son artefactos obsoletos. El PRP-001 puede tener referencias antiguas; ignorar y usar los paths actuales.
