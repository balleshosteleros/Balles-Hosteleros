# QA Report: Google Multi-Account Switcher

**Date**: 2026-05-01
**Status**: PASSED (smoke), PENDING_USER (visual)

## Test Steps

### 1. Typecheck del proyecto completo
- `tsc --noEmit` → 0 errores tras los cambios.

### 2. Smoke endpoints (sin sesión)
| Endpoint | Caso | Resultado | Esperado |
|---|---|---|---|
| `POST /api/google/sync` | sin cookies | `{ok:true, synced:false}` HTTP 200 | OK |
| `POST /api/google/switch` | sin email | `{error:"missing_email"}` HTTP 400 | OK |
| `POST /api/google/switch` | email inexistente | `{error:"unknown_account"}` HTTP 404 | OK |
| `POST /api/google/disconnect` | body vacío | `{ok:true}` HTTP 200 | OK |

### 3. Smoke endpoints (cookies inyectadas)
| Endpoint | Caso | Resultado | Esperado |
|---|---|---|---|
| `POST /api/google/sync` | activa fuera del roster | `synced:true` + roster con la cuenta | OK |
| `POST /api/google/sync` | activa ya en roster | `synced:false` (idempotente) | OK |
| `POST /api/google/switch` | refresh token inválido | `refresh_failed` HTTP 401, roster purgado | OK |
| `POST /api/google/disconnect` | con `email` activo | quita del roster, devuelve `removed` | OK |

### 4. Set-Cookie verificado en sync
- `g_accounts` → `HttpOnly; SameSite=lax; Path=/; Max-Age=5184000` ✅
- `g_accounts_meta` → mismo Max-Age, **sin** HttpOnly (legible por el switcher) ✅

## Findings
- Toda la lógica server (sync, switch, disconnect) responde con códigos correctos y deja las cookies que la UI espera.
- El roster httpOnly sólo guarda `refreshToken`; el cliente nunca puede leer ese campo.
- Cuando el refresh token caduca, switch borra esa cuenta del roster automáticamente — la UI puede caer al fallback que abre OAuth.
- Sync es idempotente: si llamas dos veces con la misma cuenta activa no duplica.

## Pendiente de validación visual

El componente `GoogleAccountButton` vive dentro de los drawers de Gmail/Calendar/Meet, accesibles sólo bajo sesión Supabase. No tengo credenciales para logear, así que el siguiente paso debes hacerlo tú:

1. Abre la app en `localhost:3000` y entra con tu usuario.
2. Abre el drawer de Gmail (icono superior derecho).
3. Click en el avatar.
4. Verifica:
   - [ ] Se ve tu cuenta arriba con el check verde.
   - [ ] El botón "Añadir otra cuenta de Google" abre el selector de Google.
   - [ ] Tras añadir una segunda cuenta, vuelves al app y aparece bajo "Otras cuentas".
   - [ ] Click en la otra cuenta → cambia el inbox sin recargar a Google.
   - [ ] La X al hover quita una cuenta del roster sin pedir login.

## Screenshots
- `screenshots/01-home.png` — login page (server vivo y compilando OK).

## Recommendations
- Avisar si tras un cambio de cuenta hay que invalidar caches de SWR/React Query del lado de Gmail/Calendar (ahora se confía en `router.refresh()`).
- Si tras pruebas reales el flujo de "Añadir cuenta" se siente lento por el redirect Google→callback→app, considerar abrirlo en popup en vez de mismo tab.
