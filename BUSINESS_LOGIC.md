# BUSINESS_LOGIC — Balles-Hosteleros

> SaaS de gestión integral para grupos de hostelería.
> **Este archivo es la fuente de verdad de reglas de negocio.**
> Se mantiene actualizado a mano. Última revisión: 2026-04-14.

---

## 1. Problema que resuelve

Los grupos de hostelería gestionan hoy con **Excel + WhatsApp + papel**: escandallos en hojas sueltas, pedidos por mensaje, cronogramas impresos, contabilidad en carpetas. La información vive fragmentada — no hay trazabilidad entre receta → compra → coste → venta → margen.

**Balles-Hosteleros unifica** toda la gestión de un grupo hostelero en una sola app: permisos por rol, multi-empresa, datos en tiempo real.

---

## 2. Roles y Permisos

| Rol | Accesos completos | Acceso lectura |
|-----|-------------------|----------------|
| Dirección | Todo | — |
| Gerencia | Todo menos Jurídico, Gestoría | — |
| Jefe de Cocina | Cocina, Logística, Calidad | — |
| Jefe de Sala | Sala, Agenda, Comunicación | — |
| Logística | Logística | Contabilidad |
| RRHH | RRHH, Formación, Agenda | — |
| Marketing | Marketing, Comunicación | — |
| Contabilidad | Contabilidad, Gestoría | — |
| Empleado | Agenda propia, Formación | — |

**Invariante:** Cada registro en BD lleva `empresa_id`. RLS en Supabase garantiza que un usuario solo ve datos de su empresa.

---

## 3. Multi-empresa

- Un usuario puede pertenecer a **una o más empresas**.
- La empresa activa se selecciona en el sidebar (selector de empresa).
- Todas las queries deben filtrar por `empresa_id` (via RLS o explícito).
- Los logos de empresa se almacenan en Supabase Storage (`logos/`).

---

## 4. Módulos y Estado

| Módulo | Feature | Estado |
|--------|---------|--------|
| Autenticación | auth | ✅ Completo |
| Multi-empresa | empresa | ✅ Completo |
| Panel administración | admin | ✅ Completo |
| Ajustes | ajustes | ✅ Completo |
| Dashboard central | dashboard | ✅ Parcial (mock) |
| Logística completa | logistica | ✅ CRUD + Ágora activo; dead ends D1-D4 pendientes |
| Cocina | cocina | ✅ CRUD |
| RRHH | rrhh | ✅ CRUD |
| Sala | sala | ✅ CRUD |
| Dirección | direccion | ✅ CRUD |
| Gerencia | gerencia | ✅ CRUD |
| Contabilidad | contabilidad | ✅ CRUD |
| Marketing | marketing | ✅ CRUD |
| Calidad | calidad | 🟡 Mock (sin BD) |
| Mantenimiento | mantenimiento | 🟡 Mock |
| Formación | formacion | 🟡 Mock |
| Agenda | agenda | 🟡 Parcial |
| Comunicación | comunicacion | ✅ CRUD |
| Reuniones | reuniones | 🟡 Parcial |
| Google Workspace | google-workspace | 🟡 Integración parcial |
| Gestoría | gestoria | 🟡 Mock |
| Jurídico | juridico | 🟡 Mock |
| Soporte | soporte | ✅ Chat IA activo |
| Layout | layout | ✅ Completo |

---

## 5. Flujos Críticos

### 5.1 Ciclo de compra completo (Logística)

```
Proveedor (alta en BD)
  → Producto tipo='compra' (ingrediente con precio/unidad/IVA)
  → Pedido (borrador → pendiente → enviado → confirmado)
  → Albarán generado automáticamente al confirmar pedido
  → [D1 PENDIENTE] Confirmar albarán → suma cantidades a stock.cantidad_actual
  → Inventario físico periódico → sobreescribe stock.cantidad_actual con conteo real
```

**Regla:** El stock tiene DOS fuentes de verdad:
1. `confirmar albarán` → SUMA incrementalmente
2. `confirmar inventario` → SOBREESCRIBE con conteo físico

### 5.2 Receta → Coste → Venta (Food Cost)

```
Ingrediente (tipo='compra', con precio_unitario y unidad)
  → Escandallo (composición del producto de venta)
     = producto_venta_id + ingrediente_id + cantidad + unidad + merma_pct
  → coste_escandallo(producto_venta_id) [función SQL]
     = Σ (cantidad × precio_unitario × (1 + merma_pct/100))
  → [D4 PENDIENTE] Mostrar coste + precio venta + margen% en pantalla
```

**Regla:** El escandallo es la **composición interna** del producto de venta. No es una lista separada. `tipo='compra'` son ingredientes; `tipo='venta'` son platos finales.

### 5.3 Sincronización Ágora POS → Stock

```
Ágora POS (servidor Windows del partner)
  → API: GET /api/export/tickets?businessDay=YYYYMMDD
  → agora-ventas-sync.ts → parse tickets → líneas vendidas
  → match por agora_id en tabla productos
  → Si tiene escandallo: restar ingredientes proporcionales × merma
  → Si tipo='compra' sin escandallo: restar directamente de stock
  → stock.cantidad_actual -= consumo
```

**Cron automático:** todos los días a las 08:00 vía `/api/cron/agora-sync`
**Manual:** botón en panel logística → `syncVentasYDescontarStockAction()`

**Regla de seguridad Ágora:** ante error de conexión o fallo → detener, mostrar error exacto, pedir aprobación antes de actuar.

### 5.4 Ciclo de personal (RRHH)

```
Alta empleado → Contrato → Turno/horario asignado → Fichaje diario
  → Ausencia/vacaciones (calcula días pendientes)
  → Nómina mensual
  → Formación asignada → progreso
  → Offboarding
```

### 5.5 Proceso de nuevo plato (Cocina ↔ Logística)

```
Nuevo plato propuesto
  → Ficha técnica (ingredientes, gramajes, elaboración)
  → Cata interna (aprobación Jefe Cocina)
  → Escandallo creado (ingredientes → coste)
  → Precio venta definido (coste + margen objetivo)
  → Alta en carta → producto tipo='venta' en BD
  → Notificación a sala + marketing
```

---

## 6. Invariantes de Datos (reglas que nunca deben romperse)

| # | Regla | Dónde aplica |
|---|-------|-------------|
| I1 | Todo registro lleva `empresa_id` + RLS activo | Todas las tablas |
| I2 | `stock.cantidad_actual` solo cambia por albarán confirmado o inventario confirmado | stock-actions.ts |
| I3 | El IVA de una línea de pedido viene de la ficha del producto, no se edita en el modal | PedidoModal |
| I4 | Proveedor es obligatorio en todo pedido | PedidoModal validación |
| I5 | El campo `notas` en pedidos es NOT NULL (string vacío, nunca null) | lineas_pedido |
| I6 | Los productos se buscan por Combobox (lista cerrada), nunca por input libre | PedidoModal |
| I7 | `tipo='compra'` = ingrediente/materia prima; `tipo='venta'` = producto final | tabla productos |
| I8 | El escandallo no se puede borrar si hay pedidos activos que usan ese ingrediente | — |
| I9 | Un usuario pertenece al menos a una empresa activa | empresa-context |
| I10 | `stock.producto_id` (UUID FK) es la clave — nunca buscar por nombre | stock-actions.ts |

---

## 7. Integraciones Externas

### Ágora POS
- URL base: `http://habanabacanaliictpv.ddns.me:8984`
- Auth: `api-token: 09654955`
- Endpoint: `GET /api/export/tickets?businessDay=YYYYMMDD`
- Versión: 8.5.5 (servidor Windows del partner)
- Estado: ✅ Conectado y activo desde 2026-04-14

### Google Workspace
- APIs: Calendar, Gmail (read/send), Meet
- OAuth via `/api/google/connect`
- Tokens almacenados por usuario en Supabase

### OpenRouter (IA)
- Usado en: soporte/chat (base de conocimiento)
- Configurado en: `src/lib/ia/openrouter.ts`
- Vercel AI SDK v5: pendiente de instalar

### Supabase
- Auth (magic link + Google OAuth)
- DB + RLS (todas las tablas con `empresa_id`)
- Storage (logos de empresa, archivos)
- Edge Functions (`analizar-albaran` para OCR)

---

## 8. Modelo de Datos Clave

### Tablas principales

```
empresas                    — multi-tenant raíz
usuarios / auth.users       — autenticación Supabase
empresa_usuarios            — pivot: usuario ↔ empresa + rol

proveedores                 — empresa_id + nombre + contacto
productos                   — empresa_id + nombre + tipo + agora_id + iva_pct
escandallos                 — producto_venta_id + ingrediente_id + cantidad + merma_pct
pedidos                     — empresa_id + proveedor_id + estado + numero
lineas_pedido               — pedido_id + producto_id (uuid) + cantidad + precio + notas
albaranes                   — pedido_id + estado + lineas (JSONB)
stock                       — empresa_id + producto_id (uuid) + cantidad_actual + minima + maxima
stock_temporada             — empresa_id + nombre + activa (tabla existe, pendiente conectar)

empleados                   — empresa_id + nombre + puesto + estado
contratos                   — empleado_id + tipo + fecha_inicio + fecha_fin
horarios / turnos           — empleado_id + dia + hora_entrada + hora_salida
fichajes                    — empleado_id + timestamp_entrada + timestamp_salida
```

### Funciones SQL activas

```sql
coste_escandallo(p_producto_venta_id UUID)
  → DECIMAL — coste total del escandallo con mermas

calcular_necesidad_compra(p_empresa_id UUID)
  → TABLE (producto_id, nombre, cantidad_actual, stock_minimo, necesidad)
  — genera lista de reposición basada en stock mínimo
```

---

## 9. Dead Ends Activos (pendientes de implementar)

| ID | Severidad | Descripción | Archivo afectado |
|----|-----------|-------------|-----------------|
| D1 | 🔴 Crítico | `handleConfirmarAlbaran` no llama `sumarStockDesdeAlbaran()` | PedidosView.tsx |
| D2 | 🟡 Alto | Temporadas de stock leen mock hardcodeado; tabla `stock_temporada` existe | StockView.tsx, TemporadasConfig.tsx |
| D3 | 🟡 Alto | `calcular_necesidad_compra()` SQL existe pero nadie la llama | pedidos-actions.ts |
| D4 | 🟢 Medio | `coste_escandallo()` SQL existe pero no se muestra en UI | ProductosView.tsx |

---

## 10. Stack Técnico

| Capa | Tecnología |
|------|-----------|
| Framework | Next.js 16 + React 19 + TypeScript |
| Estilos | Tailwind CSS 3.4 + shadcn/ui |
| Backend | Supabase (Auth + DB + RLS + Storage + Edge Functions) |
| Validación | Zod |
| Estado global | Context API (Zustand pendiente de instalar) |
| AI / LLM | OpenRouter (soporte chat); Vercel AI SDK v5 pendiente |
| Testing | Playwright CLI |
| Deploy | Vercel + cron jobs |
| Emails | Resend (pendiente activar) |

---

## 11. Pendientes Estructurales

| Tarea | Prioridad |
|-------|-----------|
| Resolver D1 — albarán actualiza stock | 🔴 Crítico |
| Resolver D2 — temporadas desde BD | 🟡 Alto |
| Resolver D3 — sugerencias de pedido | 🟡 Alto |
| Resolver D4 — food cost visible | 🟢 Medio |
| Instalar Zustand + migrar Contexts innecesarios | 🟢 Medio |
| Instalar Vercel AI SDK v5 | 🟢 Bajo |
| READMEs por feature (2/24 documentadas) | 🟢 Bajo |
| Landing pública con /website-3d | 🟢 Bajo |
