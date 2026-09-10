# Pendientes abiertos (traspaso 10/09/2026)

Los 5 puntos que quedaron en el aire, con el estado REAL comprobado en código y BD.

## 1. Nóminas brutas y complementos de la tabla que pasó Iván — BLOQUEADO
La tabla no está en esta ventana. Hay que volver a pasarla para cargarla.
Hoy `rrhh_pagos` tiene 1 sola línea por empleado y mes (verificado con Alejandro:
8 meses × 2 empresas, sin duplicados) y el reparto nómina/complemento ya existe:
p. ej. HABANA 2026-08 → nómina 731,14 € + complemento 218,86 €.
Ver [[pagos_una_linea_por_empleado_mes]].

## 2. Puesto principal de Alejandro Mojica — NO SE REPRODUCE
En BD está bien: HABANA → GERENTE `es_principal = true`, LOGÍSTICA y RECURSOS
HUMANOS a false; BACANAL → GERENTE principal.
`src/features/gerencia/actions/ratios-actions.ts:222` coge el principal
(`asignaciones.find(p => p.es_principal)`) y el mapa de costes va indexado por
`user_id`, una sola entrada por persona: no hay triplicado en Ratios.
`rrhh_pagos` tampoco lo duplica.
⚠️ Falta que Iván diga EN QUÉ PANTALLA vio el coste × 3 para poder cerrarlo.
Dato suelto: NO tiene fila en `empleado_condiciones` (ninguna de las dos fichas),
así que su coste sale del salario del PUESTO. Ver [[condiciones_empleado_fuentes]].

## 3. Consultas pendientes — PÁGINA MUERTA, DUPLICADO DEL SISTEMA REAL
`/consultas-pendientes` existe, no tiene enlace en el menú (solo label+icono en
`nav-routes.tsx:256`) y no guarda nada: `ConsultasPendientesView` cuelga de
`features/ajustes/contexts/ayuda-context.tsx`, que es `useState` en memoria con
artículos de `features/ajustes/data/ayuda` inventados. Al recargar, se pierde todo.
El sistema BUENO ya existe en otro sitio: `features/soporte` + `/ayuda` +
el botón flotante de soporte, sobre `soporte_conocimiento` (6 filas reales).
→ Lo de `ajustes` es deuda: sobra entero. Falta permiso para borrar.
⚠️ La tabla `soporte_consultas` EXISTE en BD pero **ningún código la usa** (0 filas):
si se quieren registrar las dudas de verdad, ahí es donde van.

## 4. FAQs — la tabla NO existe, la pantalla miente
`src/features/soporte/actions/faq-actions.ts` consulta `faqs` en 6 sitios y esa
tabla **no está en la base**. La migración `supabase/migrations/003_faqs.sql`
nunca se aplicó (numeración vieja, pre-timestamp).
Los errores se comen con `try/catch` → la pestaña de FAQs de `/ayuda` sale VACÍA
sin avisar, tanto al usuario como al admin (`faq-admin-panel.tsx`).
Decisión pendiente de Iván: crear la tabla (migración idempotente nueva con
`003_faqs.sql` dentro) o quitar las FAQs y quedarse solo con `soporte_conocimiento`.

## 5. Horas extras y bonus en Ratios — SIN IMPLEMENTAR
Detalle en [[ratios_coste_personal]] (sección Pendiente): `fichajes.tipo` distingue
NOR/EXT pero solo hay 3 fichajes marcados EXT en toda la base, y el bonus va como
complemento mensual por persona, no repartido por día.
