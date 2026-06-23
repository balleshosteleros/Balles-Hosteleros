---
name: Las recetas son triviales 1:1 — no armar el descuento de stock de platos todavía
description: producto_composicion tiene 203 recetas, TODAS de 1 ingrediente (las reales multi-ingrediente se perdieron en la migración del Excel del 10-jun). El descuento por ventas va bien para bebidas pero NO para platos elaborados hasta recuperar las recetas reales
type: project
---

**Verificado 2026-06-23 (Claude, lado Fernando). Para el equipo / agente de Iván.**

Estado de las recetas en BD: `producto_composicion` tiene **203 filas**, y **TODAS son de 1 solo ingrediente con cantidad 1** (distribución `{"1": 203}`, **0 recetas multi-ingrediente**). Son las gemelas venta→compra 1:1 que creó la migración del Excel del 10-jun (`scripts/agora/migrar-catalogo.mjs`); **las ~208 recetas reales multi-ingrediente que había antes se perdieron en esa migración** y no se han recuperado. El "top por nº de ingredientes" son todas bebidas (Absolut, Dyc, Jose Cuervo…); no hay ni un plato con sus ingredientes desglosados.

**Cobertura** (productos `tipo=venta` con alguna receta, aunque sea 1:1): Habana 106/192, Bacanal 97/205. El resto (86 + 108) sin receta.

**Implicación para el descuento de stock por ventas** (`descontarStockPorTicket`, kardex PRP-057, lee `producto_composicion` y usa `factor_conversion` + `sale_format_ratio`):
- **Bebidas / tragos directos**: el 1:1 funciona bien (vendes un Absolut → resta un Absolut de stock vía `agora_id`). ✅
- **Platos elaborados**: NO se descuentan bien. O no tienen receta (el motor los **omite**) o tienen una 1:1 que no refleja sus ingredientes (no baja carne/queso/pan…). ❌

**⚠️ RECOMENDACIÓN: no poner `empresas.stock_descuento_desde` (fecha de corte) para activar el descuento de platos hasta tener las recetas reales.** Si se arma ahora, el almacén de cocina quedará mal descontado. Para bebidas solas sí sería válido si se asume cobertura parcial.

**Vías para recuperar las recetas reales** (decisión del equipo):
1. El **backup** que menciona `migrar-catalogo.mjs` ("backup Bacanal en `backup_agora`") **NO existe en la BD** (verificado en todos los schemas). Si está en el Excel original, se podría recargar a `producto_composicion`.
2. Crear las fichas técnicas en el **módulo de Cocina** de Balles (PRP-031, "Nuevas Recetas").
3. Ágora **no** exporta recetas por su API estándar (verificado en la "Guía del Integrador").

Relacionado: [[regla_oro_balles_fuente_verdad]] (el descuento por receta es parte del diseño), `crons_vercel_no_se_disparan.md`, `docs/AGORA_INTEGRACION_ESTADO_Y_PLAN.md`.
