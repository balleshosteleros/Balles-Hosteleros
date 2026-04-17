---
name: Carta Digital — ubicación
description: La feature CARTA DIGITAL (PRP-028) vive en marketing/, NO en sala/, decisión del usuario tras crear el PRP
type: project
---

La feature **CARTA DIGITAL** (PRP-028) se implementó originalmente bajo `sala/` pero el usuario la movió a `marketing/` justo después.

Estado actual (estable):
- Feature: `src/features/marketing/carta-digital/` (no `sala/`)
- Ruta admin: `/marketing/carta-digital` (no `/sala/carta-digital`)
- Ruta pública: `/carta/[slug]` (sin cambios — sigue en root)
- Sidebar: entrada "CARTA DIGITAL" en `marketingSubs` con icono `QrCode`
- Migración BD: `038_carta_digital.sql` (aplicada 2026-04-18)
- Bucket Storage: `carta-fotos`

**Why:** Aunque la carta digital se consume en sala, conceptualmente es una herramienta de captación/marketing (foto, copy, likes para prueba social) más que de operación de servicio. El usuario lo categorizó como marketing.

**How to apply:** Si surgen referencias futuras a "/sala/carta-digital" o `@/features/sala/carta-digital`, son rutas obsoletas — usar siempre las de marketing/. El PRP-028 puede tener referencias antiguas a `sala/`; ignorar esa sección y usar el path real.

## Patrón de carga: service-role en server component

La carga inicial de la carta pública (`fetchCartaPorSlug` en `services/carta-fetch.ts`) se hace con **service-role client** en el server component, no con cliente anon.

**Por qué**: las RLS de `carta_categorias` y `carta_items` originalmente usaban `exists (select 1 from empresas where ... carta_publicada = true)`. Pero la tabla `empresas` tiene RLS que bloquea anon, así que el subquery devolvía false y las queries anon retornaban arrays vacíos sin error. El cliente anon nunca podía ver la carta.

**Solución**: como el server component se ejecuta server-side y nunca expone la `service_role_key` al navegador, usamos service-role para todas las queries (empresa + categorías + items). Ventaja: no requiere migración nueva. Desventaja: el realtime client-side (`useLikesRealtime`) sigue usando anon — funciona porque la suscripción a `carta_items` no necesita join con empresas para los UPDATEs de `likes_count`.

**Migración 040 (RPC) creada pero NO aplicada** — alternativa por si en el futuro se quiere evitar service-role en este flujo.
