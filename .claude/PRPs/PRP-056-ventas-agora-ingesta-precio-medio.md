# PRP-056: Ingesta de ventas Ágora POS → módulo Ventas (+ backfill 12 meses + precio de venta medio)

> **Estado**: IMPLEMENTADO (2026-06-10) · Reproceso de día = **reemplazar líneas** del ticket. Backfill 12m hecho: **18.304 facturas / 82.580 líneas / 364 días** (2025-06-10→2026-06-09); 286 productos con precio medio. Cron listo (envs `AGORA_API_*` en Vercel pendientes para producción).

### Aprendizajes (durante implementación)
- **business-day ≠ fecha natural**: Habana (club) vende de madrugada → esas ventas pertenecen a la jornada anterior. `cerrado_at = {BusinessDay}T12:00` (no `Date`) para que `/sala/ventas` agrupe por jornada de Ágora. `abierto_at` = `Date` real.
- **Total del ticket = `Invoice.Totals.GrossAmount`** (autoritativo, con IVA), NO la suma de líneas → evita el problema de MenuHeader (no apareció ningún MenuHeader en el muestreo, pero la regla queda a prueba de menús).
- **Idempotencia** vía índice único existente `(empresa_id, numero)` con `numero='AG-{serie}-{number}'` (no hizo falta un índice nuevo). Upsert + borrar/reinsertar líneas.
- **Líneas sin producto** (~4.088 / 82.580): ProductIds que no se migraron (excluidos por categoría vacía, etc.); se guardan con `producto_id=null` y su nombre — el importe del día/ticket sigue correcto.
- **precio_venta_medio rellena huecos**: vinos/destilados sin tarifa de catálogo obtienen su precio medio real de las ventas.
> **Fecha**: 2026-06-10
> **Proyecto**: Balles-Hosteleros

---

## Objetivo

Ingerir las ventas reales de Ágora POS hacia las tablas `pos_tickets` + `pos_ticket_lineas` (las que ya alimentan el dashboard de Ventas en `/sala/ventas`), de forma idempotente y marcada como `origen = 'agora'`, con backfill de los últimos 12 meses y cálculo del precio de venta medio ponderado por unidades por producto. Un cron diario ingiere "lo vendido ayer" y recalcula el precio medio. Además se conserva un **histórico por día** de cada extracción, desplegable, que lista **todas** las facturas de ese día (nº, importe y datos de Ágora), incluidas las de importe 0 o negativo (devoluciones/abonos que suman/restan mercancía).

## Por Qué

| Problema | Solución |
|----------|----------|
| El dashboard de Ventas está vacío: Ágora vende pero esos tickets nunca entran en Balles | Ingesta automática Ágora → `pos_tickets`/`pos_ticket_lineas`, visibles ya en `/sala/ventas` sin tocar la UI |
| No hay histórico para analizar Menu Engineering (estrella/caballo/enigma/perro) ni tendencias | Backfill de 12 meses de facturas reales |
| El "precio de venta medio" de cada producto es desconocido (el precio de catálogo no refleja descuentos/menús reales) | Cálculo Σ(precio×uds)/Σ(uds) sobre 12 meses, guardado en `productos.precio_venta_medio` |
| El cron heredado `/api/cron/agora-sync` apunta a endpoints inexistentes (`/api/export/tickets?businessDay=`) y solo descuenta stock, no graba ventas | Reescribir el servicio y el cron sobre el endpoint real `/api/export/?business-day=YYYY-MM-DD&filter=Invoices` |

**Valor de negocio**: el restaurante ve ventas, márgenes y popularidad reales por producto/categoría/día sin introducir nada a mano; el precio medio real desbloquea decisiones de escandallo y carta.

## Qué

### Criterios de Éxito
- [ ] Ejecutar la ingesta de un día crea `pos_tickets` (estado `COBRADO`, `origen='agora'`, `cerrado_at` = fecha del business-day) y sus `pos_ticket_lineas` con `producto_id` resuelto por `agora_id`+empresa.
- [ ] Reprocesar el mismo día NO duplica tickets (idempotencia por clave única de factura Ágora: serie+número por empresa).
- [ ] Workplace.Id 4 → BACANAL y Workplace.Id 1 → HABANA; las líneas se enrutan a la empresa correcta.
- [ ] `/sala/ventas` muestra los datos ingeridos (ingresos, tickets, comensales, por producto/categoría/día) sin cambios en `getVentasDashboard`.
- [ ] Backfill de los últimos 12 meses ejecutable desde local y dejando huella en `agora_sync_log`.
- [ ] `productos.precio_venta_medio` = Σ(precio_unitario×uds)/Σ(uds) de los últimos 12 meses (ponderado por unidades, NO media de precios), con `precio_venta_medio_actualizado` sellado; campo informativo/no editable.
- [ ] Cron diario (`vercel.json`) ingiere ayer + recalcula precio medio, fail-closed con `CRON_SECRET`, recorriendo BACANAL y HABANA.
- [ ] Líneas `Type='MenuHeader'` no se duplican con sus hijos (`ParentIndex`): se cuenta el importe una sola vez por la regla definida en Gotchas.
- [ ] Se ingieren **TODAS** las facturas del día, también las de **importe 0 o negativo** (devoluciones/abonos): no se filtran por importe (suman o restan mercancía/stock).
- [ ] Histórico por día de las extracciones: al desplegar un día se ven todos los **nº de factura** traídos, su **importe** y los datos de Ágora (incluidas 0/negativas/sin venta).

### Comportamiento Esperado

**Happy path (cron diario):**
1. Vercel Cron llama `GET /api/cron/agora-sync` con `Bearer CRON_SECRET`.
2. Por cada empresa con integración (BACANAL, HABANA): fetch `GET {AGORA_API_URL}/api/export/?business-day=AYER&filter=Invoices` con header `Api-Token`.
3. Filtrar `Invoices[]` por `Workplace.Id` de esa empresa; cada Invoice → un `pos_ticket`; cada `Lines[]` resoluble → una `pos_ticket_lineas`.
4. UPSERT idempotente por `(empresa_id, agora_serie, agora_numero)`; si el ticket ya existe se **reemplazan sus líneas** (refleja correcciones/anulaciones que Ágora haga ese día).
5. Recalcular `precio_venta_medio` de los productos afectados (ventana móvil 12 meses).
6. Registrar resultado en `agora_sync_log`.

**Backfill (local, one-shot):** mismo flujo iterando día a día sobre los últimos 365 días; al final, recálculo global de `precio_venta_medio` para todos los productos con ventas.

---

## Contexto

### Referencias
- `src/features/sala/actions/ventas-actions.ts` — `getVentasDashboard`: lee `pos_tickets` (estado=`COBRADO`, filtro por `cerrado_at`) + `pos_ticket_lineas` + `productos.coste`. **Contrato a respetar al insertar.**
- `src/features/logistica/services/agora-ventas-sync.ts` — servicio heredado (endpoint equivocado, solo descuenta stock). **Reescribir/reemplazar.**
- `src/app/api/cron/agora-sync/route.ts` — cron heredado fail-closed con `CRON_SECRET`. **Reutilizar shell, cambiar payload.**
- `scripts/agora/migrar-catalogo.mjs` — patrón de carga `.env.local`, cliente Ágora (`Api-Token`), constantes `EMP`/`WH` (BACANAL Workplace 4, HABANA Workplace 1). **Reusar para el backfill.**
- `scripts/agora/*.mjs` — utilidades de lectura Ágora existentes.
- `supabase/migrations/035_pos.sql` — DDL `pos_tickets`/`pos_ticket_lineas`, índice único `(empresa_id, numero)`, RLS por empresa.
- `supabase/migrations/011_logistica_compras.sql` — `productos.agora_id` + índice `(empresa_id, agora_id)`.
- API Ágora: `GET http://habanabacanaliictpv.ddns.me:8984/api/export/?business-day=YYYY-MM-DD&filter=Invoices`, header `Api-Token` = CIF Bacanal sin letra. Estructura: `Invoices[] → { Workplace:{Id}, InvoiceItems[]:{ Lines[]:{ ProductId, ProductName, Quantity, UnitPrice, TotalAmount, FamilyName, PreparationOrderName, Type, ParentIndex } } }`.

### Estado verificado de la BD (2026-06-10)
- `productos.precio_venta_medio` (text) y `precio_venta_medio_actualizado` (timestamptz) **YA EXISTEN**.
- `productos.agora_id` (text), `coste` (text), `precio_venta` (text) existen.
- `pos_tickets` **NO tiene** `origen`, `agora_serie`, `agora_numero` → **hay que añadirlas** (migración).
- `pos_ticket_lineas` `precio_unitario` es `numeric`; no tiene `familia`/`origen`.
- Único índice de unicidad actual en tickets: `(empresa_id, numero)` (lo genera el POS propio vía `pos_next_ticket_numero`). El número Ágora debe convivir sin colisionar con esa secuencia.
- `agora_sync_log` existe: `empresa_id, sync_at, status, error_message, sales_data, error_detail, total_records, ok_records, error_records, retry_count, created_by`.
- Empresas: BACANAL `fe2ea3c4-aa28-41ce-a135-bf196ab5dc47` (Workplace 4), HABANA `00000000-0000-0000-0000-000000000001` (Workplace 1).

### Arquitectura Propuesta
```
src/features/logistica/services/
  agora-ventas-sync.ts        # REESCRIBIR: fetch Invoices → upsert pos_tickets/lineas + recálculo precio medio
src/app/api/cron/agora-sync/route.ts   # REUTILIZAR shell, llamar al nuevo servicio para ambas empresas
scripts/agora/
  backfill-ventas.mjs         # NUEVO: itera 365 días, reusa el servicio/lógica, --write
supabase/migrations/
  20260610xxxx_pos_ventas_agora.sql   # NUEVO: columnas origen/agora_serie/agora_numero + índice único
```

### Modelo de Datos (migración)
```sql
-- pos_tickets: origen + clave de factura Ágora para idempotencia
alter table public.pos_tickets
  add column if not exists origen        text not null default 'pos',   -- 'pos' | 'agora'
  add column if not exists agora_serie   text,
  add column if not exists agora_numero  text;

-- Idempotencia: una factura Ágora (serie+número) por empresa, solo cuando origen='agora'
create unique index if not exists idx_pos_tickets_agora_factura
  on public.pos_tickets(empresa_id, agora_serie, agora_numero)
  where origen = 'agora';

-- (decidir en Fase 1) marcar origen también en líneas si hace falta distinguir; por defecto se hereda del ticket.
```
> El `pos_tickets.numero` (NOT NULL, único por empresa) para tickets Ágora se compone de serie+número de la factura Ágora con prefijo (`AG-…`) para no colisionar con la secuencia del POS propio.

---

## Blueprint (Assembly Line)

> Solo FASES. Las subtareas se generan al entrar a cada fase (bucle agéntico).

### Fase 1: Esquema + contrato de datos
**Objetivo**: Migración que añade `origen`/`agora_serie`/`agora_numero` a `pos_tickets` + índice único parcial de idempotencia; decidir mapeo exacto Invoice→ticket (número, total, comensales, cerrado_at) y MenuHeader/ParentIndex.
**Validación**: migración aplica limpia; `getVentasDashboard` sigue compilando; índice único existe y rechaza duplicados de prueba.

### Fase 2: Servicio de ingesta idempotente
**Objetivo**: Reescribir `agora-ventas-sync.ts`: fetch real `?business-day=&filter=Invoices`, ruteo Workplace→empresa, resolución `ProductId→producto_id` por `agora_id`+empresa, upsert idempotente de tickets+líneas, marcado `origen='agora'`, log en `agora_sync_log`. Fail-closed ante errores Ágora (no swallow).
**Validación**: ingerir un día real en local crea tickets/líneas correctos; reejecutar el mismo día no duplica; líneas sin match se registran como omitidas, no rompen.

### Fase 3: Precio de venta medio ponderado (12 meses)
**Objetivo**: Función de recálculo `precio_venta_medio` = Σ(precio_unitario×cantidad)/Σ(cantidad) sobre `pos_ticket_lineas` de tickets `origen='agora'` de los últimos 12 meses, por producto; sella `precio_venta_medio_actualizado`. Invocada tras cada ingesta.
**Validación**: tras backfill, valores coherentes (entre min y max de precios vistos); productos sin ventas quedan null/sin sellar.

### Fase 4: Backfill 12 meses
**Objetivo**: `scripts/agora/backfill-ventas.mjs` que itera los últimos 365 días reutilizando la lógica del servicio (DRY-RUN por defecto, `--write`), con resumen por día y recálculo global de precio medio al final.
**Validación**: ejecución `--write` puebla `/sala/ventas` con histórico; `agora_sync_log` con una entrada por día; idempotente al reejecutar.

### Fase 5: Cron diario
**Objetivo**: Reescribir `/api/cron/agora-sync` para ingerir el business-day de ayer en BACANAL y HABANA y recalcular precio medio; mantener fail-closed con `CRON_SECRET`; ajustar `vercel.json` (horario tras cierre de caja). Documentar envs `AGORA_API_URL`/`AGORA_API_TOKEN` pendientes en Vercel.
**Validación**: llamada local con `Bearer CRON_SECRET` ejecuta ambas empresas; sin secret → 503/401.

### Fase 6: Histórico de extracciones por día (vista)
**Objetivo**: Vista de un **histórico por día** de cada extracción/sync. Al desplegar un día se ven **todas las facturas traídas de Ágora** de ese día — incluidas las de **importe 0 o negativo** (devoluciones/abonos que suman o restan mercancía/stock) y las que no tengan venta — con su **número de factura**, el **importe** de cada ticket y **todos los datos traídos de Ágora**. Se apoya en `agora_sync_log` (resumen por día) + `pos_tickets` `origen='agora'` (detalle).
**Validación**: desplegar un día lista todas las facturas (también 0/negativas); el nº de facturas cuadra con lo que devuelve Ágora ese día; se ve importe y datos por ticket.

### Fase 7: Validación Final
**Objetivo**: Sistema end-to-end.
**Validación**:
- [ ] `npm run typecheck` pasa
- [ ] `npm run build` exitoso
- [ ] `/sala/ventas` muestra ventas reales (backfill) — screenshot Playwright
- [ ] Reproceso del mismo día = 0 duplicados (consulta SQL)
- [ ] Criterios de éxito cumplidos

---

## 🧠 Aprendizajes (Self-Annealing)

> Crece con cada error durante la implementación.

---

## Gotchas

- [ ] **Endpoint heredado equivocado**: el código viejo usa `/api/export/tickets?businessDay=YYYYMMDD`. El real es `/api/export/?business-day=YYYY-MM-DD&filter=Invoices` (guiones, no compacto) y raíz `Invoices` (no `Tickets`).
- [ ] **Header**: `Api-Token` (PascalCase con guion), valor = CIF Bacanal sin letra; en `.env.local` como `AGORA_API_TOKEN`/`AGORA_API_URL`.
- [ ] **MenuHeader/ParentIndex**: hay `Lines` con `Type='MenuHeader'` que agrupan hijos. Definir la regla de importe para NO doble-contar (típico: el header lleva el `TotalAmount` del menú y los hijos van a 0, o al revés). Verificar contra un Invoice real antes de sumar.
- [ ] **`numero` NOT NULL y único por empresa** ya lo usa el POS propio (`pos_next_ticket_numero`). Para Ágora componer `numero` con prefijo (`AG-{serie}-{numero}`) para no colisionar con la secuencia diaria del POS.
- [ ] **Estado COBRADO + `cerrado_at`**: `getVentasDashboard` filtra `estado='COBRADO'` y por `cerrado_at`. Los tickets Ágora deben insertarse así, con `cerrado_at` = fecha del business-day, o no aparecerán.
- [ ] **Idempotencia real**: la clave única debe ser serie+número de factura Ágora (no el día), porque un día tiene N facturas. Índice único parcial `where origen='agora'` para no interferir con tickets del POS propio.
- [ ] **Multi-tenant**: un solo fetch por día devuelve facturas de varios Workplace; filtrar por `Workplace.Id` y enrutar a empresa antes de insertar. Nunca mezclar empresas.
- [ ] **NO filtrar facturas por importe**: ingerir TODAS, incluidas las de importe 0 o **negativo** (devoluciones/abonos) y las sin venta — suman o restan mercancía/stock. Si en el futuro se descuenta stock desde aquí, respetar el signo.
- [ ] **Producción**: faltan envs `AGORA_API_URL`/`AGORA_API_TOKEN` en Vercel (el cron fallará hasta cargarlas). Vercel SÍ alcanza el servidor del restaurante (verificado). El backfill se corre desde local.
- [ ] **Service role en cron/scripts**: la ingesta usa `SUPABASE_SERVICE_ROLE_KEY` (bypassa RLS); cuidar el `empresa_id` manualmente en cada insert.
- [ ] **Ágora = fuente de verdad del precio de venta** (ya bloqueado en la ficha). `precio_venta_medio` es informativo/no editable; coste y stock siguen viviendo en Balles (editables) — no tocarlos aquí.
- [ ] **Columnas text**: `coste`, `precio_venta`, `precio_venta_medio` son `text` en BD; castear con cuidado al calcular (usar el helper `toNum` ya existente como referencia).

## Anti-Patrones
- NO reescribir `getVentasDashboard`: los datos deben encajar en su contrato actual.
- NO usar la media aritmética de precios distintos: el precio medio es ponderado por unidades.
- NO swallow de errores Ágora: detener y devolver el error exacto (regla de seguridad Ágora).
- NO insertar sin clave de idempotencia: reprocesar un día jamás debe duplicar.
- NO hardcodear empresa: enrutar por `Workplace.Id`.
- NO crear una tabla nueva de ventas: reusar `pos_tickets`/`pos_ticket_lineas`.

---

*PRP pendiente aprobación. No se ha modificado código.*
