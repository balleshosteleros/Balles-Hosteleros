# Logística · Compras — Respuestas de Iván a las decisiones (§6)

> **Fecha:** 2026-06-25 · **Para:** Fernando · **De:** Iván (vía Claude lado Iván).
> **Responde a:** `docs/LOGISTICA_COMPRAS_ESTADO_Y_PLAN.md` §6 (las 6 decisiones que bloqueaban la implementación).
> Sin código todavía: esto fija el QUÉ. El CÓMO/fases lo aterriza Fernando.

---

## 1. Reposición por ventas — ventana de días

El modelo de **cobertura por días está bien**. Lo que cambia es la UX: presets de "línea de tiempo" + uno personalizado.

- Presets seleccionables:
  - **Últimos 3 días**
  - **Últimos 7 días**
  - **Últimos 14 días**
  - **Personalizado**: el usuario elige **dos fechas**; el sistema detecta cuánto se ha vendido **entre esas dos fechas** y **esa** es la propuesta de compra.
- **Regla de la ventana:** NO se cuenta el día de hoy. La ventana **empieza a contar desde ayer** hacia atrás (p.ej. "últimos 7 días" = ayer y los 6 anteriores).

## 2. Stock máximo — por TEMPORADAS (con cálculo automático o manual por producto)

El stock máximo se calcula **primero por temporadas**.

**Temporadas:**
- Se pueden **crear temporadas** (de fecha a fecha).
- **Dos temporadas por defecto para todos los negocios: verano e invierno**, configuradas de modo que **cuando empieza una, termina la otra**.
- **Cobertura total obligatoria:** cada día del año debe tener una temporada; **nunca un día sin temporada**. Si no se modifica, por defecto coge una de las dos.

**Cálculo automático del stock máximo (por producto × temporada):**
- Cada producto de compra tiene un **stock máximo por cada temporada**.
- El sistema mira las **ventas de esa MISMA temporada del AÑO ANTERIOR** y detecta **la semana que más se vendió**.
- El stock máximo es **siempre por 7 días** (por defecto).
- Al **reponer almacén por stock**, avisar al usuario: *"la reposición cubre un máximo de 7 días; pasada esa fecha hay que volver a hacer otra reposición por stock"*.

**Modo por producto (automático vs manual):**
- Cada producto de compra se puede configurar como **Automático** (lo de arriba) o **Manual**.
- Si es **Manual**: el usuario fija el stock que desee y **ese** es el que se usa de referencia para calcular el pedido de compra.
- **Siempre uno u otro** (nunca ninguno / nunca los dos).
- **Cambio en caliente:** al cambiarlo, el pedido debe cogerlo **al momento** como referencia.

> ⚠️ **Dependencia que marco (Iván, leer):** el cálculo automático necesita **ventas del año anterior** en `pos_tickets`. El volcado de Ágora empezó hace poco, así que **puede que aún no haya histórico de 1 año**. Mientras no lo haya, el modo Automático no tendrá de dónde calcular → habría que **arrancar en Manual** (o sembrar provisional) y dejar el Automático activándose a medida que se acumule histórico. Fernando: confirmar cuánto histórico real hay antes de Fase 1.

## 3. `ingredientes_proveedor` — automático, manda el proveedor PRINCIPAL

- **Automático.** Cada producto de compra tiene su **proveedor principal**.
- Puede tener **varios proveedores**, pero **siempre 1 obligatorio como principal**; el resto secundario / terciario. Norma automática.
- Para hacer pedidos **prevalece siempre el principal**.
- **Precio de referencia = el grabado en la ficha del producto para ese proveedor**, NO el del último albarán.
- El **precio del último albarán** solo cuenta para los **datos de los albaranes**, nada más (no pisa la ficha).

## 4. Envío al proveedor — WhatsApp + Email, ambos con PDF

Dos vías:
- **WhatsApp:** botón que **abre WhatsApp automáticamente** y **adjunta un PDF** con el pedido al proveedor.
- **Email:** **desde dentro del software** (vincular con el apartado de emails ya integrado; **NO** sacarlo a otra plataforma). Se envía al **`email_pedidos`** del proveedor, con **texto + PDF adjunto**.

## 5. Recepción con foto — PRIORIDAD MÓVIL ABSOLUTA + crear "Mis Departamentos"

- **Prioridad absoluta: móvil.** Las fotos se hacen con el móvil y la recepción es **siempre** en móvil.
- En la app móvil **aún solo existe "MIS PANELES"**. Toca **crear "MIS DEPARTAMENTOS"** y meter ahí **LOGÍSTICA** (diseño a criterio de Fernando).
- Dentro de Logística, **botón "ALBARANES"** que despliega los albaranes **pendientes de confirmar** (los que falta que el proveedor traiga).
- Al abrir un albarán: trae los **mismos datos del pedido** que lo generó.
- Flujo de recepción: el gerente **chequea la mercancía** contra el albarán y, para recepcionar, **hace una foto al albarán del proveedor**.
- El sistema hace el **chequeo automático**: marca **errores donde no coincida** y **tick verde** donde coincida.
- La **foto queda siempre adjunta a nuestro albarán** (que "vivan juntas").

## 6. Stock "actual" → LIVE (confirmado), con barrido inicial

- El stock se mueve **solo al CONFIRMAR**: **descuenta todas las ventas** y **suma todos los albaranes** una vez confirmados.
- **Pendientes NO cuentan** en el stock; el **pedido** menos todavía (es el paso previo al albarán).
- Se **elimina el provisional** en cuanto esto entre en uso → todo pasa a actualizarse en vivo.
- **Primer barrido MANUAL** para dejar el stock actualizado; **desde ese momento** entran todos los albaranes. **Se puede hacer la semana que viene.**
- Si todo funciona OK → **migrar toda la logística** y **dejar de usar Ágora solo a nivel de COMPRAS**, pasando a usar Balles Hosteleros. (Solo compras; el resto de Ágora sigue.)

---

## Nuevo modelo de datos que implican estas respuestas (para Fernando)

- **Temporadas** (§2): tabla nueva de temporadas por empresa (rango de fechas, sin huecos en el año, 2 por defecto verano/invierno). Stock máximo **por producto × temporada**, + flag **automático/manual** y **valor manual** por producto.
- **Proveedores por producto** (§3): `ingredientes_proveedor` con **rol** (principal/secundario/terciario, exactamente 1 principal obligatorio) y **precio de referencia** en la ficha (independiente del precio del último albarán).
- **Albaranes en móvil** (§5): superficie móvil "Mis Departamentos → Logística → Albaranes", foto adjunta persistida junto al albarán, chequeo automático con marca verde/errores.
- **Stock live** (§6): el descuento por ventas + suma por albarán solo dispara al **confirmar**; necesita el barrido manual inicial.

## Orden sugerido (no bloqueante, lo confirma Fernando)

Mantiene tus fases pero con el matiz de que **§2 automático depende de histórico** y **§6 puede arrancar la semana que viene** con el barrido manual.
