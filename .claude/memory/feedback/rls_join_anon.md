---
name: RLS — evitar exists() join a tablas con RLS bloqueada para el rol consumidor
description: Patrón a evitar al diseñar Row Level Security cuando el subquery referencia una tabla que el rol no puede leer
type: feedback
---

Al escribir policies RLS tipo `using (... and exists (select 1 from otra_tabla where ...))`, el subquery se ejecuta con los **permisos del rol que hace la query**, no con permisos elevados. Si ese rol no tiene SELECT en `otra_tabla`, el `exists` devuelve siempre `false` y la policy nunca permite ningún registro — pero **no lanza error**: las queries devuelven arrays vacíos silenciosamente.

**Why:** Pasó en Carta Digital (PRP-028): la policy de `carta_items` exigía `exists (... from empresas where carta_publicada = true)`. El cliente anon no podía leer `empresas` (sin policy `to anon`), así que `carta_items` devolvía `[]` sin error. La página renderizaba "carta vacía" sin pista del problema.

**How to apply:**
- Si necesitas filtrar por estado de la tabla padre, **o** das al rol acceso explícito a esa tabla, **o** usas una RPC `security definer` que haga el join, **o** denormalizas el flag a la tabla hija (`carta_items.publicado boolean`).
- Para flujos públicos donde la fuente de verdad está en server, usar **service-role en el server component** evita el problema sin migración.
- Al debuggear "RLS devuelve []" sin error, sospecha de un subquery a tabla sin acceso para ese rol.
