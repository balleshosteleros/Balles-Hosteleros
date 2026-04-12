---
name: Estado Logística
description: Estado actual del módulo de logística — datos cargados y pendientes
type: project
---

BD poblada: 31 proveedores, 74 productos de venta, 74 ingredientes, 98 escandallos.

**Pendiente:**
- Reasignar proveedores reales (el usuario enviará Excel).
- 16 platos sin escandallo.
- Categorizar ingredientes.

**Why:** El módulo de logística es la feature activa del SaaS; el resto del código ya está conectado a Supabase.
**How to apply:** Antes de tocar algo de logística, verificar si el ingrediente/producto afectado forma parte de los pendientes. Los escandallos son composición interna, no listado aparte.
