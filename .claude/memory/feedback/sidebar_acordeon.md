---
name: Sidebar acordeón — un módulo abierto a la vez
description: En el sidebar de departamentos, abrir un módulo cierra cualquier otro que estuviera desplegado
type: feedback
---

Regla: En `AppSidebar` (navegación de DEPARTAMENTOS), solo puede haber UN módulo desplegado a la vez. Al abrir uno nuevo, el anterior se cierra automáticamente.

**Why:** El usuario lo pidió explícitamente el 2026-04-18. Tener varios módulos abiertos satura la vista y obliga a hacer scroll innecesario.

**How to apply:** El estado `openKey` vive en `AppSidebar` (un único `useState<string | null>`). Cada `CollapsibleSection` recibe `open` y `onOpenChange` controlados; al abrir se setea `openKey = section.key`, al cerrar se setea `null`. Al montar, se inicializa con la sección cuyo prefix coincide con el `pathname` activo. No usar `defaultOpen` por sección — eso rompe el acordeón. Si se añaden nuevos módulos al sidebar, incluirlos en el array `sections` con una `key` única.
