---
name: Estándar UI — Botones de acción
description: Convención obligatoria para botones de acción primarios en toda la interfaz
type: feedback
---

Todos los botones de acción principal deben usar `<Button variant="primary" size="lg">` con icono a la izquierda y etiqueta descriptiva. Deben posicionarse en `top-4 right-4` del contenedor padre (absolute o sticky).

```tsx
<Button variant="primary" size="lg">
  <PlusIcon className="mr-2 h-4 w-4" />
  Nuevo
</Button>
```

**Why:** Consistencia visual en todo el SaaS. El usuario aprobó este estándar como convención de fábrica.

**How to apply:** Cada vez que se cree o modifique un botón de acción (crear, añadir, guardar), aplicar esta convención. No usar `variant="default"` ni `size="sm"` para acciones principales.
