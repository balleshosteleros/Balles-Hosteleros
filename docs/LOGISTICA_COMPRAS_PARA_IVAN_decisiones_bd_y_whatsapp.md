# Logística · Compras §4 (Envío al proveedor) — 2 decisiones para Iván

> **Fecha:** 2026-06-25 · **De:** Claude (lado Fernando) · **Para:** Iván.
> §4 (envío del pedido al proveedor) está **implementado y desplegable**. Quedan **dos cosas que son tu decisión** porque dependen de la base de datos de producción y de la cuenta de Meta (acceso que tienes tú).

---

## Qué hace §4 ya (implementado)

Al abrir un pedido (Logística → Pedidos → detalle) hay dos botones reales:
- **"Enviar al proveedor" (email):** genera el **PDF del pedido** (server-side con `pdf-lib`) y lo manda por email a `proveedores.email_pedidos` (cae a `email_principal`), con la marca de la empresa. Marca el pedido como `estado='Enviado'` solo si el email sale OK (si falla, no marca y muestra el error — Regla de Seguridad).
- **"WhatsApp":** abre WhatsApp (`wa.me`) con el **resumen del pedido en texto** y el teléfono del proveedor.

Se ha quitado el mock anterior (`PROVEEDOR_EMAILS` estático + `mailto` + estado local). Ficheros: `src/features/logistica/actions/enviar-pedido-actions.ts`, `src/features/logistica/lib/pedido-pdf.ts`, `src/lib/email/send.ts` (ahora soporta adjuntos), `components/pedidos/DetallePedido.tsx`, `components/PedidosView.tsx`. Typecheck + lint verdes. **Falta una prueba en vivo supervisada** (manda primero a un email vuestro de prueba antes de a un proveedor real).

---

## DECISIÓN 1 — ¿Añadimos columnas a `pedidos` para registrar el envío? (tu llamada sobre el esquema)

Ahora mismo el envío se registra con `estado='Enviado'` (columna que ya existe) — **sin tocar el esquema**. Eso pierde el detalle de *cuándo*, *por qué canal* y *a qué email* se envió.

Si quieres ese registro fino, hay que añadir 3 columnas (aditivo, nullable, reversible). El clasificador de seguridad **bloqueó que lo aplicara yo** sobre la BD de producción compartida sin tu visto bueno — por eso lo dejo a tu decisión:

```sql
-- pedidos: registrar el envío al proveedor
alter table public.pedidos
  add column if not exists enviado_at    timestamptz,
  add column if not exists enviado_canal text,        -- 'email' | 'whatsapp'
  add column if not exists enviado_email text;        -- destino real
```

- Si lo quieres: aplícalo tú vía Management API / SQL editor (tienes acceso), o dime "OK aplícalo" y lo hago.
- Si no: nos quedamos con `estado='Enviado'` y listo.
- Cuando existan las columnas, ajusto la server action para rellenarlas (es trivial).

## DECISIÓN 2 — WhatsApp con PDF adjunto (necesita tu cuenta de Meta)

El v1 abre WhatsApp con **texto** (wa.me). **Adjuntar el PDF por WhatsApp NO es posible con wa.me** — exige la **API de WhatsApp Business Cloud (Meta)**, que tú controlas. Para activarlo:

1. Configurar las env (las mismas que ya usa el módulo de marketing): `WHATSAPP_ACCESS_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID` (no están en el entorno actual).
2. Crear y **aprobar en Meta una plantilla (HSM) con cabecera de tipo "documento"** (para poder mandar el PDF a un proveedor que no te ha escrito en las últimas 24 h).
3. Avisarme y cableo el envío del PDF por WhatsApp Business (reusando `marketing/services/whatsapp-service.ts`).

Hasta entonces, el botón de WhatsApp manda el texto y el PDF va por email.

---

Relacionado: `docs/LOGISTICA_COMPRAS_ESTADO_Y_PLAN.md` (plan por incrementos), `docs/LOGISTICA_COMPRAS_RESPUESTAS_IVAN.md` (tus decisiones).
