---
name: Cocina — NUEVAS RECETAS pipeline kanban (PRP-031)
description: Submódulo reescrito como pipeline kanban con fases editables por empresa — arquitectura clave post 2026-04-18
type: project
---

El submódulo **NUEVAS RECETAS** (Cocina) se reescribió completo el 2026-04-18 como pipeline kanban (PRP-031), reemplazando el flujo simple con 5 checkboxes.

**Ruta**: `/cocina/nuevas-recetas`
**Feature dir**: `src/features/cocina/nuevas-recetas/` (promovido desde `components/nuevas-recetas/`)
**Migraciones aplicadas**:
- `042_nuevas_recetas_pipeline.sql` — fases config + ingredientes/compra/cata/historial + tabla `tareas` (reemplazo localStorage del TareasDrawer)
- `043_fichas_tecnicas_repair.sql` — crea `fichas_tecnicas` + `ingredientes_ficha` (migración 010 nunca se había aplicado en prod)

**Decisiones arquitectónicas clave**:

1. **Receta = ficha técnica borrador**: datos `ft_*` viven en `nuevas_recetas`. Solo al "Publicar oficial" (fase 5) se crea fila en `fichas_tecnicas` + productos en `productos` (Logística).

2. **Fases editables por empresa**: `nueva_receta_fase` con seed de 5 fases al primer acceso vía función `ensure_nueva_receta_seed(empresa_id)`. Cada empresa edita nombre, color (paleta 10), plazo, responsable (user + depto), sub-estados (máx 6), gatekeepers. Límites: máx 10 fases, mín 2.

3. **Ingredientes tipados** (`IngredientesEditor` compartido):
   - Dropdown de productos tipo Compra (Logística) + botón "Propuesto nuevo" (badge amarillo) para ingredientes que aún no existen
   - Unidad es Select cerrado — opciones según producto seleccionado (`unidad_uso` + `unidad`) o lista fija `g/kg/ml/L/ud/caja/docena` para propuestos
   - Al Publicar oficial: propuestos sin `producto_id` se convierten automáticamente en productos reales (se linkean si ya existe por nombre)

4. **Destino**: solo `cocina` / `sala` (UI etiqueta `sala` como "BARRA"). "ambos" eliminado de UI.

5. **Porciones eliminado** de toda la UI.

6. **Tabla `tareas`** reemplaza localStorage del `TareasDrawer`. Al mover receta de fase con "Comunicar" → tarea automática al responsable de la fase destino con `tipo='nueva_receta_fase'` + `link_url`.

7. **Módulo de tareas compartido**: `src/features/tareas/actions/tareas-actions.ts` — canónico, usado por layout drawer y nuevas-recetas.

**Why**: el flujo de 5 checkboxes perdía pasos y no forzaba orden. El kanban tipo Reclutamiento con gatekeepers + historial + tareas automáticas al responsable + integración bidireccional con Logística/Fichas Técnicas/Carta Digital resuelve el problema.

**How to apply**: si encuentras referencias a `nuevas_recetas.estado` (enum legacy `propuesto/en_cata/aprobado/rechazado/en_carta`) o los 5 booleans (`fotos_marketing`, `cata_1`...), son legacy — el flujo nuevo usa `fase_id` + `sub_estado_id` + `estado_general` (en_progreso/aprobada/archivada). El PRP-031 documenta el flujo completo. El PRP-001 es obsoleto.
