---
name: Protocolo de Guardado — Escrituras en Supabase
description: Toda operación de escritura en Supabase debe tener try/catch, logs y verificación RLS. localStorage prohibido para datos críticos.
type: feedback
---

Toda operación de escritura en Supabase (insert, update, delete, upsert) debe seguir este patrón:

```ts
try {
  const { data, error } = await supabase
    .from('tabla')
    .insert(payload);

  if (error) {
    console.error('[tabla:insert] Error Supabase:', error.message, error.code);
    throw new Error(error.message);
  }

  return data;
} catch (err) {
  console.error('[tabla:insert] Error inesperado:', err);
  throw err;
}
```

**Prohibido:**
- `localStorage` para datos críticos (pedidos, facturas, usuarios, inventario). Solo Supabase.
- Ignorar el objeto `error` que devuelve Supabase (siempre checarlo).
- Omitir RLS en tablas con datos de usuario.

**Why:** El usuario ha sufrido pérdidas de datos por operaciones silenciosas que no reportaron errores. localStorage se borra y no es fuente de verdad.

**How to apply:** En cualquier `service` o `action` que escriba en Supabase, aplicar este patrón completo. El código no pasa revisión si falta el try/catch o el check de `error`.
