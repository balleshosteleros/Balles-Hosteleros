---
name: Permisos con caché stale-while-revalidate
description: La carga de permisos del auth-context no debe bloquear el sidebar ni gates de UI. Hidratar desde localStorage y refrescar en paralelo en background.
type: feedback
---

Regla: El filtrado de permisos en el sidebar y gates `puedeVer/puedeEditar` debe sentirse instantáneo en cualquier rol — no solo director. Para eso:

1. `auth-context` cachea `{ profile, roles, permisos }` en `localStorage` con clave `bh_auth_cache_${userId}` después de cada fetch exitoso.
2. Al montar (cuando hay sesión), hidrata el estado desde la caché si existe → `permisosLoaded = true` al primer render.
3. En paralelo (Promise.all) refresca `profile` (query directa a Supabase) y `getUserPermisos()` (server action que ya devuelve `appRoles` + `permisos` + `empresaId` en un solo round-trip).
4. Tras el refresh, sobrescribe estado y reescribe la caché.
5. En `signOut` borra la caché del usuario actual antes de cerrar sesión, para evitar fugas si otro usuario inicia sesión en el mismo navegador.

**Why:** El usuario reportó (2026-05-04) que tras commit `65e3bc1` el sidebar mostraba solo "DASHBOARD" durante varios segundos hasta que cargaban los permisos. Causa: 3 awaits secuenciales (profile → user_roles → getUserPermisos) más un gate `permisosLoaded ? ... : []`. Pidió que el filtro fuera "rápido de serie", no exclusivo de director.

**How to apply:** Si añades nuevas fuentes de permiso o cambias el shape de `AuthProfile`/`AppRole`/`PermisoModulo`, actualiza el `interface AuthCache` y borra la caché vieja (cambio de versión: añadir un sufijo `_v2` a la clave). NO uses `user_roles` desde el cliente — usa `appRoles` que viene de `getUserPermisos`. NO bloquees el render esperando a permisos cuando ya hay datos cacheados.
