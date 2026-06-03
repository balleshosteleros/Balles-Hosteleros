# PRP-051: Tipo de reserva TICKET con productos vendibles y enlaces de venta

> **Estado**: PENDIENTE
> **Fecha**: 2026-06-02
> **Proyecto**: Balles-Hosteleros (módulo Sala / Reservas)

---

## Objetivo

Añadir un cuarto valor `ticket` al campo `tipo_categoria` de reservas y un CRUD de "productos-ticket" por empresa que pueda venderse desde Configuración de Reservas y enlazarse a enlaces públicos de reserva (incluido modo embed para iframe en webs externas), con control de stock atómico no reversible y bloqueo automático de clientes que hagan no-show.

## Por Qué

| Problema | Solución |
|----------|----------|
| Solo existen 3 modos de reserva (gratis / política / cupón) y ninguno permite vender un producto/experiencia atado a la reserva (cena especial, evento con cubierto fijo, brunch con cupo). | Nuevo modo `ticket` con catálogo de productos por empresa, precio + IVA + modo (por persona / por reserva), stock opcional y bloqueo anti no-show. |
| Las campañas de marketing y enlaces externos no permiten vender un "ticket" desde el flujo de reserva pública. | Extender `reserva_links` con productos-ticket seleccionables y endpoint embed para iframe en webs y newsletters. |
| Los no-shows en reservas con compromiso económico no tienen consecuencia automática. | Tabla `cliente_ticket_bloqueos`: el no-show bloquea futuras reservas-ticket de ese cliente hasta desbloqueo manual del restaurante. |

**Valor de negocio**: monetización directa de reservas (cenas evento, cubiertos especiales, ferias), aforo cerrado garantizado por stock, menos cancelaciones de última hora gracias al bloqueo por no-show, distribución multicanal vía iframe sin que el cliente final salga de la web del restaurante.

## Qué

### Criterios de Éxito

- [ ] `tipo_categoria` acepta los 4 valores: `gratis`, `politica`, `cupon`, `ticket` (CHECK ampliado, tipo TS sincronizado).
- [ ] CRUD `reserva_ticket_productos` operativo en Configuración → Reservas → nueva pestaña "Tickets" (alta, edición, archivado, orden manual, numero_secuencial inmutable por empresa).
- [ ] Stock atómico: una RPC `consumir_stock_ticket(producto_id, unidades)` resta y rechaza con error si supera `stock_total`. Stock NUNCA se devuelve (ni en cancelación ni en no-show ni en eliminación de reserva).
- [ ] Productos con `stock_modo='limitado'` y `ocultar_al_agotar=true` desaparecen del listado público en cuanto `stock_consumido >= stock_total`.
- [ ] Flujo público `/reservar/[slug]` y `/reservar/[slug]/[keyword]` muestra los productos-ticket disponibles del enlace (o de la empresa si el enlace no filtra), permite elegir uno, y al confirmar guarda `ticket_producto_id`, `ticket_unidades`, `ticket_importe`, `ticket_iva`, `pago_pendiente=true`, `tipo_categoria='ticket'`.
- [ ] Si stock se agota entre carga y submit, el server action devuelve error y el form muestra "Producto agotado".
- [ ] Si el cliente tiene un registro activo en `cliente_ticket_bloqueos`, el flujo público bloquea la reserva con mensaje claro (mismo mensaje para email O teléfono ya conocidos).
- [ ] Marcar una reserva-ticket como `NO_SHOW` (desde gestión o desde cron de auto-marcado) inserta automáticamente un registro en `cliente_ticket_bloqueos`. Restaurante puede desbloquear desde la ficha del cliente.
- [ ] Enlaces de venta (`reserva_links`) admiten toggle "Incluir venta de ticket" + multi-select de productos. Tabla pivote `reserva_link_ticket_productos`.
- [ ] Endpoint `/reservar/[slug]/embed` (y `/reservar/[slug]/[keyword]/embed`) sirve el mismo formulario sin chrome del portal, con cabeceras CSP `frame-ancestors` permisivas y sin `X-Frame-Options: DENY`.
- [ ] Toda política RLS nueva usa `empresas_del_usuario()` / `empresas_del_usuario_text()`. Migraciones afectan a TODAS las empresas (sin tocar empresa concreta).
- [ ] Reglas UI activas aplicadas: BARRA HORIZONTAL 1 (toolbar minimalista) en la pestaña Tickets, sentence case en labels/títulos, header sin duplicar título de la vista.

### Comportamiento Esperado

**Configuración (admin restaurante)**
1. Admin entra a Sala → Configuración → Reservas → pestaña "Tickets" (al lado de "Cupones").
2. Pulsa `+ Nuevo` → modal con: nombre, precio, IVA, modo de precio (por persona / por reserva), comentarios, toggle stock (ilimitado / limitado + total), toggle "Ocultar al agotar", activo.
3. Guarda → trigger asigna `numero_secuencial` inmutable por empresa, `stock_consumido=0`.
4. Lista muestra productos ordenables (drag o flechas) con badge de stock restante cuando aplica.
5. Admin va a Marketing → Campañas / Enlaces de venta → crea o edita un enlace → toggle "Incluir venta de ticket" + multi-select de productos del catálogo de la empresa.

**Flujo público (cliente final)**
1. Cliente abre `https://demo.balleshosteleros.com/reservar/<slug>?o=instagram` o `/reservar/<slug>/<keyword>` o iframe embed.
2. Si el enlace tiene productos-ticket asociados, ve un paso "Elige tu ticket" con lista de productos visibles (precio, descripción, badge "Agotado pronto" si quedan ≤5).
3. Productos con `stock_consumido >= stock_total` y `ocultar_al_agotar=true` no aparecen. Si `ocultar_al_agotar=false`, aparecen con badge "Agotado" deshabilitado.
4. Cliente selecciona un producto (1 producto por reserva en v1), rellena fecha/hora/personas/datos.
5. Al confirmar:
   - `find_or_link_cliente_sala` resuelve cliente por email o teléfono.
   - Si `cliente_ticket_bloqueos` activo → error "Tu cuenta tiene un bloqueo por inasistencia previa. Contacta con el restaurante."
   - RPC `consumir_stock_ticket` resta atómicamente (pax si `por_persona`, 1 si `por_reserva`).
   - `try_reservar_slot` reserva mesa.
   - Se inserta `reservas` con `tipo_categoria='ticket'`, `ticket_producto_id`, `ticket_unidades`, `ticket_importe = precio * unidades`, `ticket_iva`, `pago_pendiente=true`, `importe_pagado=null` (pendiente pasarela).
6. Pantalla de éxito: "Reserva confirmada. El pago se procesará próximamente." (cuando se cablee pasarela, esto cambia).

**Gestión de no-show**
1. Restaurante (o cron) marca reserva-ticket como `NO_SHOW`.
2. Trigger AFTER UPDATE en `reservas` detecta `tipo_categoria='ticket' AND estado='NO_SHOW'` y hace `INSERT ... ON CONFLICT DO NOTHING` en `cliente_ticket_bloqueos` (cliente_id + empresa_id, `motivo='no_show'`, `reserva_origen_id`).
3. Stock NO se devuelve (regla del dueño).
4. Restaurante puede ir a ficha del cliente → ve banner "Cliente bloqueado para tickets" → botón "Desbloquear" que rellena `desbloqueado_at` y `desbloqueado_por`.

**Cancelación / cambio de fecha**
- Cliente puede cambiar fecha de su reserva (NO devuelve stock).
- Cliente puede cancelar (NO devuelve stock).
- En ambos casos `importe_pagado` queda como estaba (no se devuelve dinero hasta integrar pasarela + política de reembolsos).

---

## Contexto

### Referencias (código existente — usar como patrón)
- `src/features/sala/data/reservas.ts:30-38` — `TipoReservaCategoria` y labels; ampliar a 4 valores.
- `src/features/sala/actions/reservas-actions.ts:241,388,545` — escritura de `tipo_categoria` y rama `esPolitica`; añadir rama `esTicket`.
- `src/features/sala/components/reservas/config/ConfigTabReservas.tsx` — añadir nueva tab "Tickets".
- `src/features/sala/components/reservas/config/CodigosTab.tsx` + `CodigoForm.tsx` — patrón CRUD para imitar.
- `src/features/sala/actions/reserva-codigos-actions.ts` — patrón de actions con `empresas_del_usuario()` y `numero_secuencial`.
- `src/features/sala/actions/reserva-links-actions.ts` — extender con productos-ticket.
- `src/features/reservar-publica/components/ReservaPublicaForm.tsx` — añadir paso "Elige tu ticket" y prop `productosTicket`.
- `src/features/reservar-publica/actions/crear-reserva-publica.ts` — orquestar `consumir_stock_ticket` + bloqueo + `try_reservar_slot`.
- `src/features/sala/data/clientes.ts` + ficha cliente — añadir banner de bloqueo y acción "Desbloquear".
- `supabase/migrations/094_security_hardening_views_funcs.sql` — referencia para `assign_numero_secuencial` y hardening.
- Memoria `project_reservas_dedup_cliente.md` — `find_or_link_cliente_sala` para vincular cliente.
- Memoria `project_rls_helper_empresas_del_usuario.md` — RLS obligatorio multi-tenant.
- Memoria `project_id_secuencial_inmutable.md` — patrón `numero_counters` + triggers (huecos no reusan).
- Memoria `feedback_barra_horizontal_1.md` — toolbar minimalista por defecto.
- Memoria `feedback_capitalizacion_textos_ui.md` — sentence case en toda UI.
- Memoria `feedback_titulo_pagina.md` — no duplicar título de la vista.
- Memoria `feedback_cambios_multi_tenant.md` — cambios al software, no a una empresa.

### Estado actual de BD (consultado en Supabase)
- `reservas` ya tiene `tipo_categoria text NULL` con CHECK `IN ('gratis','politica','cupon')` (constraint `reservas_tipo_categoria_check`).
- `reservas` ya tiene `importe_pagado numeric NULL` (reutilizable).
- Tablas existentes en módulo: `reservas`, `reserva_links`, `reserva_codigos`, `clientes_sala`, `reserva_slots_lock`, `reserva_email_plantillas`.
- RPCs existentes: `empresas_del_usuario`, `empresas_del_usuario_text`, `find_or_link_cliente_sala`, `try_reservar_slot`.
- `reserva_links` solo tiene `palabra_clave, url_generada, activo` → falta el toggle de tickets y el join a productos.

### Arquitectura Propuesta (Feature-First)

Reutilizar las features existentes (no crear feature nueva):

```
src/features/sala/
├── data/
│   ├── reservas.ts                       # +'ticket' en TipoReservaCategoria
│   └── ticket-productos.ts               # NUEVO: tipos + zod
├── actions/
│   ├── reservas-actions.ts               # +rama esTicket en create/update
│   ├── reserva-links-actions.ts          # +set/get productosTicket
│   └── ticket-productos-actions.ts       # NUEVO: CRUD + toggleOcultar
└── components/reservas/config/
    ├── ConfigTabReservas.tsx             # +nueva tab "Tickets"
    ├── TicketsTab.tsx                    # NUEVO (patrón CodigosTab)
    └── TicketProductoForm.tsx            # NUEVO (patrón CodigoForm)

src/features/reservar-publica/
├── components/
│   ├── ReservaPublicaForm.tsx            # +paso selector de ticket
│   └── TicketSelector.tsx                # NUEVO
└── actions/
    └── crear-reserva-publica.ts          # +flujo ticket + bloqueo + stock

src/features/sala/clientes/ (o data/clientes)
└── components/
    └── ClienteBloqueoTicketBanner.tsx    # NUEVO (banner + desbloquear)

src/app/reservar/[slug]/
├── page.tsx                              # ya existe
├── embed/
│   └── page.tsx                          # NUEVO: variante embed
└── [keyword]/
    ├── page.tsx                          # ya existe
    └── embed/
        └── page.tsx                      # NUEVO

src/app/api/embed/                        # cabeceras CSP frame-ancestors *
└── (config en next.config / middleware)
```

### Modelo de Datos (DDL final propuesto)

```sql
-- ============================================================
-- Migración 1: ampliar CHECK de tipo_categoria
-- ============================================================
ALTER TABLE public.reservas
  DROP CONSTRAINT reservas_tipo_categoria_check;

ALTER TABLE public.reservas
  ADD CONSTRAINT reservas_tipo_categoria_check
  CHECK (tipo_categoria = ANY (ARRAY['gratis','politica','cupon','ticket']));

-- ============================================================
-- Migración 2: tabla reserva_ticket_productos
-- ============================================================
CREATE TABLE public.reserva_ticket_productos (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id      UUID NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  numero_secuencial INT NOT NULL,                          -- inmutable, asignado por trigger
  nombre          TEXT NOT NULL,
  descripcion     TEXT,
  precio          NUMERIC(10,2) NOT NULL CHECK (precio >= 0),
  iva             NUMERIC(5,2)  NOT NULL DEFAULT 10 CHECK (iva >= 0 AND iva <= 100),
  modo_precio     TEXT NOT NULL DEFAULT 'por_persona'
                    CHECK (modo_precio IN ('por_persona','por_reserva')),
  comentarios     TEXT,
  stock_modo      TEXT NOT NULL DEFAULT 'ilimitado'
                    CHECK (stock_modo IN ('ilimitado','limitado')),
  stock_total     INT CHECK (stock_total IS NULL OR stock_total >= 0),
  stock_consumido INT NOT NULL DEFAULT 0 CHECK (stock_consumido >= 0),
  ocultar_al_agotar BOOLEAN NOT NULL DEFAULT TRUE,
  activo          BOOLEAN NOT NULL DEFAULT TRUE,
  orden           INT NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT ticket_stock_coherente CHECK (
    (stock_modo='ilimitado' AND stock_total IS NULL)
    OR (stock_modo='limitado' AND stock_total IS NOT NULL)
  ),
  CONSTRAINT ticket_no_sobreconsumido CHECK (
    stock_total IS NULL OR stock_consumido <= stock_total
  ),
  UNIQUE (empresa_id, numero_secuencial)
);

CREATE INDEX ON public.reserva_ticket_productos (empresa_id, activo, orden);

ALTER TABLE public.reserva_ticket_productos ENABLE ROW LEVEL SECURITY;

CREATE POLICY ticket_productos_select ON public.reserva_ticket_productos
  FOR SELECT USING (empresa_id = ANY (empresas_del_usuario()));
CREATE POLICY ticket_productos_modify ON public.reserva_ticket_productos
  FOR ALL USING (empresa_id = ANY (empresas_del_usuario()))
        WITH CHECK (empresa_id = ANY (empresas_del_usuario()));

-- Lectura pública para el flujo /reservar/[slug] (solo activos visibles)
-- Se hace vía RPC con SECURITY DEFINER, NO con policy anon (más seguro).

-- numero_secuencial inmutable por empresa
CREATE TRIGGER trg_ticket_productos_numseq
  BEFORE INSERT ON public.reserva_ticket_productos
  FOR EACH ROW EXECUTE FUNCTION public.assign_numero_secuencial();

CREATE TRIGGER trg_ticket_productos_lock_numseq
  BEFORE UPDATE OF numero_secuencial ON public.reserva_ticket_productos
  FOR EACH ROW EXECUTE FUNCTION public.lock_numero_secuencial();

CREATE TRIGGER trg_ticket_productos_updated_at
  BEFORE UPDATE ON public.reserva_ticket_productos
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- ============================================================
-- Migración 3: columnas en reservas para ticket
-- ============================================================
ALTER TABLE public.reservas
  ADD COLUMN ticket_producto_id UUID REFERENCES public.reserva_ticket_productos(id) ON DELETE SET NULL,
  ADD COLUMN ticket_unidades    INT,
  ADD COLUMN ticket_importe     NUMERIC(10,2),
  ADD COLUMN ticket_iva         NUMERIC(5,2),
  ADD COLUMN pago_pendiente     BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE public.reservas
  ADD CONSTRAINT reservas_ticket_coherente CHECK (
    (tipo_categoria <> 'ticket' AND ticket_producto_id IS NULL)
    OR (tipo_categoria = 'ticket' AND ticket_producto_id IS NOT NULL
        AND ticket_unidades IS NOT NULL AND ticket_unidades > 0)
  );

CREATE INDEX ON public.reservas (ticket_producto_id) WHERE ticket_producto_id IS NOT NULL;

-- ============================================================
-- Migración 4: RPC consumo atómico de stock
-- ============================================================
CREATE OR REPLACE FUNCTION public.consumir_stock_ticket(
  p_producto_id UUID,
  p_unidades    INT
) RETURNS public.reserva_ticket_productos
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
AS $$
DECLARE
  v_row public.reserva_ticket_productos;
BEGIN
  IF p_unidades <= 0 THEN
    RAISE EXCEPTION 'unidades inválidas';
  END IF;

  UPDATE public.reserva_ticket_productos
    SET stock_consumido = stock_consumido + p_unidades,
        updated_at      = NOW()
    WHERE id = p_producto_id
      AND activo = TRUE
      AND (stock_modo = 'ilimitado'
           OR (stock_total IS NOT NULL AND stock_consumido + p_unidades <= stock_total))
    RETURNING * INTO v_row;

  IF v_row.id IS NULL THEN
    RAISE EXCEPTION 'AGOTADO' USING ERRCODE = 'P0001';
  END IF;

  RETURN v_row;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.consumir_stock_ticket(UUID, INT) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.consumir_stock_ticket(UUID, INT) TO service_role;
-- Se llama desde Server Action con admin client; NUNCA expuesta a anon.

-- ============================================================
-- Migración 5: bloqueos de cliente por no-show
-- ============================================================
CREATE TABLE public.cliente_ticket_bloqueos (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id        UUID NOT NULL REFERENCES public.empresas(id)         ON DELETE CASCADE,
  cliente_id        UUID NOT NULL REFERENCES public.clientes_sala(id)    ON DELETE CASCADE,
  motivo            TEXT NOT NULL DEFAULT 'no_show'
                      CHECK (motivo IN ('no_show','manual','otro')),
  reserva_origen_id UUID REFERENCES public.reservas(id) ON DELETE SET NULL,
  notas             TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  desbloqueado_at   TIMESTAMPTZ,
  desbloqueado_por  UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  UNIQUE (empresa_id, cliente_id, reserva_origen_id)
);

CREATE INDEX ON public.cliente_ticket_bloqueos (empresa_id, cliente_id)
  WHERE desbloqueado_at IS NULL;

ALTER TABLE public.cliente_ticket_bloqueos ENABLE ROW LEVEL SECURITY;
CREATE POLICY ctb_select ON public.cliente_ticket_bloqueos
  FOR SELECT USING (empresa_id = ANY (empresas_del_usuario()));
CREATE POLICY ctb_modify ON public.cliente_ticket_bloqueos
  FOR ALL USING (empresa_id = ANY (empresas_del_usuario()))
        WITH CHECK (empresa_id = ANY (empresas_del_usuario()));

-- Trigger: NO_SHOW en reserva-ticket → INSERT bloqueo
CREATE OR REPLACE FUNCTION public.tg_reservas_no_show_bloquea_ticket()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
AS $$
BEGIN
  IF NEW.tipo_categoria = 'ticket'
     AND NEW.estado = 'NO_SHOW'
     AND (OLD.estado IS DISTINCT FROM NEW.estado)
     AND NEW.cliente_id IS NOT NULL
  THEN
    INSERT INTO public.cliente_ticket_bloqueos
      (empresa_id, cliente_id, motivo, reserva_origen_id)
    VALUES (NEW.empresa_id, NEW.cliente_id, 'no_show', NEW.id)
    ON CONFLICT (empresa_id, cliente_id, reserva_origen_id) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_reservas_no_show_bloquea_ticket
  AFTER UPDATE OF estado ON public.reservas
  FOR EACH ROW EXECUTE FUNCTION public.tg_reservas_no_show_bloquea_ticket();

-- ============================================================
-- Migración 6: relación enlace ↔ productos-ticket
-- ============================================================
ALTER TABLE public.reserva_links
  ADD COLUMN vende_tickets BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN nombre        TEXT;          -- nombre legible del enlace (reutilizar si ya existe)

CREATE TABLE public.reserva_link_ticket_productos (
  link_id     UUID NOT NULL REFERENCES public.reserva_links(id)             ON DELETE CASCADE,
  producto_id UUID NOT NULL REFERENCES public.reserva_ticket_productos(id)  ON DELETE CASCADE,
  orden       INT NOT NULL DEFAULT 0,
  PRIMARY KEY (link_id, producto_id)
);

ALTER TABLE public.reserva_link_ticket_productos ENABLE ROW LEVEL SECURITY;
CREATE POLICY rltp_select ON public.reserva_link_ticket_productos
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.reserva_links rl
            WHERE rl.id = link_id AND rl.empresa_id = ANY (empresas_del_usuario()))
  );
CREATE POLICY rltp_modify ON public.reserva_link_ticket_productos
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.reserva_links rl
            WHERE rl.id = link_id AND rl.empresa_id = ANY (empresas_del_usuario()))
  );

-- ============================================================
-- Migración 7: RPC pública (SECURITY DEFINER) para listar productos visibles por slug/keyword
-- ============================================================
CREATE OR REPLACE FUNCTION public.list_ticket_productos_publicos(
  p_empresa_slug TEXT,
  p_keyword      TEXT DEFAULT NULL
) RETURNS SETOF public.reserva_ticket_productos
LANGUAGE sql SECURITY DEFINER SET search_path = public, pg_temp
AS $$
  WITH emp AS (SELECT id FROM public.empresas WHERE slug = p_empresa_slug),
       link AS (
         SELECT rl.id, rl.vende_tickets
         FROM public.reserva_links rl, emp
         WHERE rl.empresa_id = emp.id AND rl.activo = TRUE
           AND (p_keyword IS NULL OR rl.palabra_clave = p_keyword)
       )
  SELECT tp.*
  FROM public.reserva_ticket_productos tp, emp
  WHERE tp.empresa_id = emp.id
    AND tp.activo = TRUE
    AND (
      tp.stock_modo = 'ilimitado'
      OR NOT tp.ocultar_al_agotar
      OR tp.stock_consumido < tp.stock_total
    )
    AND (
      p_keyword IS NULL
      OR EXISTS (
        SELECT 1 FROM public.reserva_link_ticket_productos pivot, link
        WHERE pivot.link_id = link.id AND pivot.producto_id = tp.id
      )
    )
  ORDER BY tp.orden, tp.numero_secuencial;
$$;

GRANT EXECUTE ON FUNCTION public.list_ticket_productos_publicos(TEXT, TEXT) TO anon, authenticated;
```

### Endpoints / Server Actions a crear o editar

| Archivo | Cambio |
|---|---|
| `src/features/sala/actions/ticket-productos-actions.ts` | NUEVO: `listTicketProductos`, `createTicketProducto`, `updateTicketProducto`, `archiveTicketProducto`, `reorderTicketProductos`. |
| `src/features/sala/actions/reserva-links-actions.ts` | +`setLinkVendeTickets(linkId, on)`, `setLinkTicketProductos(linkId, productoIds[])`, `listLinkTicketProductos(linkId)`. |
| `src/features/sala/actions/reservas-actions.ts` | +rama `esTicket`: validar bloqueo cliente, llamar `consumir_stock_ticket`, escribir columnas ticket_*. |
| `src/features/reservar-publica/actions/crear-reserva-publica.ts` | Orquestar mismo flujo del lado público, sin auth. |
| `src/features/sala/actions/clientes-actions.ts` | +`desbloquearClienteTicket(bloqueoId)`. |
| `src/features/sala/data/ticket-productos.ts` | NUEVO: tipos TS + zod. |

### Componentes UI

| Archivo | Cambio |
|---|---|
| `src/features/sala/components/reservas/config/ConfigTabReservas.tsx` | +entrada de tab "Tickets". |
| `src/features/sala/components/reservas/config/TicketsTab.tsx` | NUEVO (BARRA HORIZONTAL 1, tabla, drag reorder). |
| `src/features/sala/components/reservas/config/TicketProductoForm.tsx` | NUEVO (modal alta/edición). |
| `src/features/sala/components/ReservasView.tsx` | Mostrar badge "Ticket: <nombre>" + importe en filas con `tipo_categoria='ticket'`. |
| `src/features/sala/components/ClientesView.tsx` | Banner de bloqueo activo + acción "Desbloquear". |
| Form de creación de enlaces (Marketing) | Toggle "Incluir venta de ticket" + multi-select. |
| `src/features/reservar-publica/components/ReservaPublicaForm.tsx` | Nuevo paso "Elige tu ticket". |
| `src/features/reservar-publica/components/TicketSelector.tsx` | NUEVO. |
| `src/app/reservar/[slug]/embed/page.tsx` | NUEVO: render sin layout del portal. |
| `src/app/reservar/[slug]/[keyword]/embed/page.tsx` | NUEVO. |
| Middleware / `next.config` | Variante embed: response headers sin `X-Frame-Options`, `Content-Security-Policy: frame-ancestors *;`. |

---

## Blueprint (Assembly Line)

> IMPORTANTE: Solo se definen FASES. Las subtareas las genera `/bucle-agentico` mapeando contexto justo antes de cada fase. Validar (typecheck + build + Playwright) al final de cada fase antes de pasar a la siguiente.

### Fase 1: Migración BD — schema base
**Objetivo**: ampliar `tipo_categoria` a 4 valores, crear `reserva_ticket_productos` con stock, columnas ticket en `reservas`, RLS con `empresas_del_usuario()`.
**Validación**: `\d reserva_ticket_productos` muestra columnas y constraints; INSERT manual con stock_modo=limitado y stock_total=2 funciona; CHECK rechaza `stock_consumido > stock_total`; `tipo_categoria='ticket'` aceptado en `reservas` solo si hay `ticket_producto_id`.

### Fase 2: Migración BD — stock atómico + bloqueos + RPC pública
**Objetivo**: `consumir_stock_ticket` (SECURITY DEFINER, no expuesta a anon), `cliente_ticket_bloqueos` con trigger NO_SHOW, `list_ticket_productos_publicos` (SECURITY DEFINER expuesta a anon).
**Validación**: dos llamadas concurrentes a `consumir_stock_ticket` no superan `stock_total`; marcar reserva-ticket NO_SHOW inserta bloqueo; RPC pública oculta productos agotados con `ocultar_al_agotar=true`.

### Fase 3: Migración BD — enlaces con tickets
**Objetivo**: columnas `vende_tickets`, `nombre` en `reserva_links` + tabla pivote `reserva_link_ticket_productos` con RLS.
**Validación**: vincular 2 productos a un link y leerlos vía join; intento de leer pivote de otra empresa devuelve 0 filas (RLS).

### Fase 4: Tipos TS + Server Actions de admin (CRUD productos-ticket)
**Objetivo**: `data/ticket-productos.ts`, `actions/ticket-productos-actions.ts` con zod y `getAppContext()`; extender `reserva-links-actions.ts` con set/get productos.
**Validación**: `npm run typecheck` pasa; crear/editar/archivar/reordenar producto desde una llamada de test devuelve filas correctas.

### Fase 5: UI Configuración — pestaña "Tickets" en ConfigTabReservas
**Objetivo**: nueva tab al lado de Cupones, lista + modal alta/edición + toggles stock y ocultar al agotar. Aplicar BARRA HORIZONTAL 1, sentence case, sin duplicar título.
**Validación**: Playwright entra a Configuración → Reservas → Tickets → crea producto "Cena nochevieja", stock 50 limitado, por_persona, 80€ + 10% IVA; aparece en la lista con badge "50 disponibles".

### Fase 6: Integración admin — reservas internas con ticket + ReservasView
**Objetivo**: extender `createReserva`/`updateReserva` con rama `esTicket` (validar bloqueo, llamar `consumir_stock_ticket`, persistir columnas ticket); mostrar badge en `ReservasView`.
**Validación**: crear reserva interna con `tipo_categoria='ticket'` y producto válido descuenta stock; intentar superar stock devuelve error claro; ReservasView muestra "Ticket: Cena nochevieja · 160€".

### Fase 7: Flujo público — TicketSelector + crear-reserva-publica
**Objetivo**: paso "Elige tu ticket" en `ReservaPublicaForm`; `crear-reserva-publica.ts` orquesta find_or_link cliente → check bloqueo → consumir stock → try_reservar_slot → INSERT reserva.
**Validación**: Playwright completa flujo `/reservar/<slug>?o=test`, elige ticket, confirma; reserva queda con `tipo_categoria='ticket'`, `pago_pendiente=true`. Segundo intento con stock agotado muestra "Producto agotado".

### Fase 8: Enlaces de venta con tickets + form en hub de campañas
**Objetivo**: form de creación/edición de enlace con toggle "Incluir venta de ticket" + multi-select; `/reservar/<slug>/<keyword>` filtra productos por el pivote.
**Validación**: crear enlace `nochevieja` con 1 producto; `/reservar/<slug>/nochevieja` solo lista ese producto; sin keyword se listan todos los activos.

### Fase 9: Modo embed (iframe)
**Objetivo**: rutas `/reservar/[slug]/embed` y `/reservar/[slug]/[keyword]/embed` sin chrome del portal; headers `frame-ancestors *` y sin `X-Frame-Options: DENY` (configurar en middleware o `headers()` por ruta).
**Validación**: cargar la ruta embed dentro de un `<iframe>` en página estática local no se bloquea; lighthouse muestra layout limpio sin nav.

### Fase 10: No-show + bloqueo + desbloqueo manual
**Objetivo**: trigger ya creado en Fase 2; UI en ficha de cliente (`ClientesView`) muestra banner si hay bloqueo activo y botón "Desbloquear" → llama `desbloquearClienteTicket`.
**Validación**: Playwright marca reserva-ticket como NO_SHOW → ficha del cliente muestra banner; pulsar Desbloquear lo retira; intentar reservar otro ticket con ese cliente bloqueado falla con mensaje claro y, tras desbloquear, funciona.

### Fase 11: Pulido + accesibilidad + i18n strings + multi-tenant
**Objetivo**: verificar sentence case en todos los textos, labels accesibles, mensajes de error consistentes, que toda RLS use `empresas_del_usuario()` y que los cambios no toquen ninguna empresa concreta.
**Validación**: revisión visual; `grep -r "uppercase" src/features/sala/components/reservas/config/Tickets*` vacío; advisors de Supabase sin warnings nuevos.

### Fase 12: Validación Final (QA end-to-end Playwright)
**Objetivo**: sistema funcionando end-to-end.
**Validación**:
- [ ] `npm run typecheck` pasa.
- [ ] `npm run build` exitoso.
- [ ] Checklist Playwright:
  - [ ] Admin crea producto-ticket "Brunch" con stock limitado 10.
  - [ ] Admin crea enlace `brunch-promo` con ese producto y `vende_tickets=true`.
  - [ ] Cliente A reserva 4 plazas vía `/reservar/<slug>/brunch-promo` (stock baja a 6).
  - [ ] Cliente A NO se presenta, admin marca NO_SHOW → banner de bloqueo aparece en ficha.
  - [ ] Cliente A intenta reservar de nuevo otro producto-ticket → bloqueado con mensaje.
  - [ ] Admin desbloquea desde ficha → Cliente A puede volver a reservar.
  - [ ] Cliente B intenta reservar 7 plazas → "Producto agotado" (solo quedan 6).
  - [ ] Cliente B reserva 6 → stock llega a 0; producto desaparece del listado público con `ocultar_al_agotar=true`.
  - [ ] Cargar `/reservar/<slug>/embed` dentro de un iframe local funciona.
- [ ] mcp__supabase__get_advisors sin warnings nuevos de seguridad.

---

## Aprendizajes (Self-Annealing)

> Se rellena durante implementación con cada bug y fix encontrados.

---

## Gotchas

- [ ] El CHECK `reservas_tipo_categoria_check` se sustituye, NO se añade — Postgres no admite dos CHECK con el mismo nombre. Drop + add en transacción.
- [ ] `consumir_stock_ticket` debe llamarse desde Server Action con admin client (NUNCA expuesta a anon ni authenticated). Esto evita que un cliente directo en el browser fabrique reservas sin pasar por la lógica de bloqueo/precio.
- [ ] La RPC pública `list_ticket_productos_publicos` SÍ es expuesta a anon — verificar que solo devuelve productos activos visibles, nunca lee columnas sensibles.
- [ ] El trigger AFTER UPDATE en `reservas` debe ser idempotente (`ON CONFLICT DO NOTHING`) porque si la reserva se marca NO_SHOW dos veces (o pasa por A_REVISAR → NO_SHOW) no se debe duplicar el bloqueo.
- [ ] Stock NO se devuelve nunca — verificar que cancelaciones, ediciones que cambien de producto, y borrados de reserva NO disparen incremento de `stock_consumido` hacia abajo. Si se cambia de producto, se consume del nuevo y se mantiene el viejo (decisión del dueño: "no se devuelve nunca").
- [ ] `pago_pendiente=true` es la marca para enganchar pasarela después — NO eliminar columna ni asumir que siempre será true.
- [ ] Multi-tenant: las migraciones no deben referenciar UUIDs de empresas concretas. La regla `empresas_del_usuario()` aplica a presentes y futuras.
- [ ] BARRA HORIZONTAL 1 obligatoria en TicketsTab: `+ Nuevo` izquierda, buscar + 3 iconos derecha. Filtros/toggles en fila aparte.
- [ ] Sentence case en TODOS los strings de UI ("Ocultar al agotar", "Cena nochevieja", no "OCULTAR AL AGOTAR").
- [ ] Embed: configurar `frame-ancestors *` solo en las rutas `/embed/*`; el resto del portal mantiene `DENY`. Considerar limitar por dominios si el cliente lo pide más adelante.
- [ ] Cliente con email O teléfono ya conocidos → el bloqueo debe matchear vía `find_or_link_cliente_sala` (memoria `project_reservas_dedup_cliente.md`), no por email plano.

## Anti-Patrones

- NO crear feature nueva para "tickets" — vive dentro de `features/sala` (reservas) y `features/reservar-publica`.
- NO duplicar la lógica de stock en cliente — siempre vía RPC `consumir_stock_ticket`.
- NO leer productos públicos con SELECT directo desde anon — usar SIEMPRE `list_ticket_productos_publicos`.
- NO devolver stock al cancelar / no-show / borrar reserva — regla explícita del dueño.
- NO permitir más de un producto-ticket por reserva en v1 (modelo simple con columnas en `reservas`). Si en el futuro se pide multi-producto → migrar a tabla `reserva_ticket_items`.
- NO tocar ninguna empresa concreta en seeds o migraciones (regla multi-tenant).
- NO usar `any` en zod ni en server actions.
- NO meter el botón "Indicadores" ni reintroducir `ReservasPorPersonas` en `/sala/reservas` (memorias activas).

---

*PRP pendiente aprobación. No se ha modificado código.*
