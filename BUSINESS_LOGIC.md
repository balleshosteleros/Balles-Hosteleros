# BUSINESS_LOGIC — Balles-Hosteleros

> SaaS de gestión integral para grupos de hostelería (restaurantes, bares, cadenas).
> Reverse-engineered desde `src/features/` el 2026-04-13.

## Problema que resuelve

Los grupos de hostelería gestionan hoy la operativa con **Excel + WhatsApp + papel**: escandallos en hojas, pedidos por mensaje, cronogramas sueltos, contabilidad externa. La información vive fragmentada y no hay trazabilidad entre receta → compra → coste → venta.

**Balles-Hosteleros unifica** toda la gestión de un grupo hostelero en una sola app, con permisos por rol y multi-empresa.

## Usuarios y Roles

| Rol | Responsabilidad principal | Accesos |
|-----|--------------------------|---------|
| Dirección | Visión global, decisiones estratégicas | Todo |
| Gerencia | Operativa diaria del grupo | Todo menos jurídico/gestoría |
| Jefe de Cocina | Escandallos, partidas, calidad | Cocina, logística, calidad |
| Jefe de Sala | Reservas, servicio, equipo de sala | Sala, agenda, comunicación |
| Logística | Compras, stock, inventarios, proveedores | Logística, contabilidad (lectura) |
| RRHH | Personal, cronogramas, formación | RRHH, formación, agenda |
| Marketing | Campañas, redes, imagen de marca | Marketing, comunicación |
| Contabilidad | Facturas, impuestos, tesorería | Contabilidad, gestoría |
| Empleado | Su ficha, su cronograma, formación | Agenda propia, formación |

## Módulos (features implementadas)

**Operativa:** logística, cocina, sala, calidad, mantenimiento
**Personas:** rrhh, formación, agenda, comunicación
**Negocio:** dirección, gerencia, marketing, contabilidad, gestoría, jurídico
**Sistema:** auth, empresa (multi-tenant), admin, ajustes, reuniones, google-workspace, soporte, dashboard

## Flujos críticos

### 1. Compra → Recepción → Stock
Proveedor → Pedido (borrador/pendiente/enviado) → Albarán (con análisis OCR vía Supabase Function `analizar-albaran`) → Stock ajustado → Inventario periódico.

### 2. Receta → Coste → Venta
Ingrediente (con proveedor y precio) → Escandallo (composición del producto de venta) → Precio objetivo vs margen real → Producto en carta.

### 3. Incidencias
Cualquier módulo puede abrir una incidencia (rotura, falta de stock, queja) → asignada a responsable → seguimiento.

## Stack

Next.js 16 · React 19 · TypeScript · Tailwind 3.4 · shadcn/ui · Supabase (Auth + DB + RLS + Storage + Edge Functions) · Zod · Sonner · Resend.

## Estado actual (2026-04-13)

- **Auth + multi-empresa + RLS:** listo
- **Logística:** BD poblada (31 proveedores, 74 productos venta, 74 ingredientes, 98 escandallos); pendiente reasignar proveedores reales y categorizar ingredientes
- **Escandallos:** 16 platos sin composición
- **AI:** Vercel AI SDK v5 aún no instalado; solo hay Edge Function de análisis de albaranes
- **Zustand:** no instalado (se usa Context API)

## Pendientes estructurales (SaaS Factory)

- Instalar Zustand (`npm install zustand`) y migrar los Context innecesarios
- Instalar Vercel AI SDK v5 si se amplía IA (chat operativo, sugerencias de pedido, etc.)
- READMEs por feature (2/25 documentadas)
- Landing pública con `/website-3d` si se abre comercialización
