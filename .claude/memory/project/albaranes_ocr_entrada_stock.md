---
name: Entrada de mercancía por OCR de albaranes (feature futura)
description: Las entradas de almacén se registrarán fotografiando el albarán del proveedor; Balles lo lee y digitaliza por OCR. Pendiente de PRP
type: project
---

**Decisión del dueño (2026-06-17).** Para que Balles lleve el almacén de verdad, las **entradas de mercancía** se registrarán así:

- Las dan de alta **empleados de cada empresa** (no admin central).
- El flujo es **OCR**: el empleado hace **una foto al albarán del proveedor** y Balles debe **leer y digitalizar** todo el documento (proveedor, productos, cantidades, precios…), creando la entrada de stock.

**Estado:** feature nueva grande (BD + UI + motor OCR/IA) → requiere su **PRP** propio antes de implementar. Arranque gradual: el dueño avisará cuándo empezar y se harán **pruebas poco a poco** antes de pasarlo a producción para todo.

**Relación con el espejo de stock:** mientras no haya entradas por albarán, el espejo matinal desde Ágora (`agora-stock-mirror`) mantiene el stock al día. En cuanto los albaranes empiecen a registrarse en Balles, el espejo debe **apagarse o reconciliarse** ese mismo día, porque el copiado matinal pisaría las entradas reales. Ver [[regla_oro_balles_fuente_verdad]].
