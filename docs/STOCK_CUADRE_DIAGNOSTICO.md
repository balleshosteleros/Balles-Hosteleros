# Por qué el stock no cuadra, y cómo cuadrarlo

> **Generado:** 2026-08-26 · **Datos:** producción, tablas `stock` y `stock_movimientos`.
>
> Iván pidió "cuadrar el stock inflado de los lotes". Esto es el diagnóstico con números, y
> las dos herramientas que hay ahora para arreglarlo.

---

## El diagnóstico: el stock actual casi no tiene respaldo

El sistema guarda las existencias en dos sitios que deberían decir lo mismo:

- **el listado de stock**, que es el número que se ve en pantalla;
- **los movimientos de almacén** (el kardex), que es el histórico de todo lo que ha entrado y
  salido, con su documento y su fecha.

El listado debería ser exactamente la suma de los movimientos. Hoy no lo es:

| | Bacanal | Habana |
|---|---|---|
| Productos con existencias | 159 | 160 |
| **Sin ningún movimiento que las justifique** | **131** | **126** |
| Unidades sin justificar | **3.343** | **2.957** |

Y el kardex entero tiene **63 movimientos**, todos de albarán y todos entre el 26-jun y el
31-jul. No hay ni un inventario ni una merma registrados: **esas dos funciones nunca se han
usado**.

### De dónde viene

Los números del listado se escribieron directamente, sin pasar por el histórico: la migración
del catálogo de junio los volcó desde un Excel, y la recepción de albaranes por lotes sumaba
al listado sin dejar movimiento. No es que alguien hiciera nada mal: es que hasta hace poco no
había kardex.

Ejemplos de lo que hay hoy en el listado sin ningún respaldo:

| Producto | Empresa | Existencias | Justificadas |
|---|---|---|---|
| Pan gua bao | Bacanal | 950 | 0 |
| Bengalas Boom-boom | Habana | 863 | 0 |
| Croquetas de jamón con panko | Bacanal | 456 | 0 |
| Copa de balón personalizada | Habana | 300 | 0 |
| Pan brioche | Bacanal | 211,6 | 0 |
| Tarta de queso | Bacanal | 174 | 0 |

### Y hay 12 productos con existencias NEGATIVAS

Físicamente imposible, y señal clara de que el punto de partida estaba mal: se ha descontado
de un stock que nunca llegó a darse de alta.

| Producto | Empresa | Existencias |
|---|---|---|
| Boquillas | Habana | **−150** |
| Carne picada de vaca | Bacanal | −18,96 |
| Hamburguesa artesana angus (200 g) | Bacanal | −11,2 |
| Base de arroz de carne | Bacanal | −7,2 |
| Base de arroz de pescado | Bacanal | −3,6 |
| Filete de vaca para cachopo | Bacanal | −3,29 |
| Aguja de cerdo fresca | Bacanal | −1,88 |
| …y 5 más con menos de 1,5 | | |

---

## Las dos herramientas para arreglarlo

### 1. Inventario — para recontar en bloque

Ya existía y no se había usado nunca. Se va a **Logística → Inventarios**, se crea uno, se
cuenta lo que hay de verdad y se confirma. Al confirmarlo, el sistema calcula la diferencia
producto a producto y **deja un movimiento de ajuste por cada una**, así que a partir de ese
momento el listado y el histórico cuadran.

Es reversible: si se cuenta mal, se revierte y los movimientos desaparecen.

**Es el camino recomendado para cuadrar de verdad**, porque además deja constancia de qué se
contó y cuándo.

### 2. Corregir existencias — para el fallo puntual (nuevo, 26-ago)

En **Logística → Stock**, cada producto tiene ahora un botón de balanza junto al de editar. Se
pone lo que hay de verdad, se explica por qué, y el sistema apunta el movimiento de ajuste.

**El motivo es obligatorio.** Un ajuste sin explicación es justo lo que hace que dentro de seis
meses nadie pueda auditar el almacén.

Es para "me equivoqué al recibir el albarán" o "esto se rompió y no lo apunté". Para recontar
una categoría entera, mejor un inventario.

### Y lo que ya no se puede hacer

Antes existía la posibilidad técnica de editar la cantidad a mano, sin dejar rastro. **Se ha
cerrado**: la edición de la ficha ahora solo cambia el mínimo y el máximo, que es para lo que
sirve. La cantidad solo se mueve por compra, venta, inventario, merma o ajuste — y todas dejan
su movimiento.

### Deshacer una merma (nuevo, 26-ago)

Las mermas ya descontaban stock, pero no había forma de deshacerlas: una merma mal apuntada
—producto equivocado, cantidad de más, apuntada dos veces— se quedaba, y la única salida era
apuntar una entrada falsa que ensucia el histórico. Ahora cada merma tiene su botón de
**Deshacer**, que devuelve al almacén exactamente lo que descontó y borra el movimiento.

---

## Propuesta de cómo cuadrarlo

1. **Empezar por los negativos** (12 productos). Son los más urgentes porque falsean cualquier
   cálculo de reposición: mientras haya un stock negativo, el sistema cree que hace falta
   comprar más de lo que hace falta. Con "corregir existencias" se resuelven en un rato.
2. **Un inventario por categoría, no uno gigante.** Empezar por bebidas, que es lo que más
   rota y lo más fácil de contar. Cada categoría que se cierre queda cuadrada para siempre.
3. **A partir de ahí se mantiene solo**: las compras entran por albarán, las ventas salen por
   el TPV, y lo que se rompa se apunta como merma. El listado y el histórico ya no se separan.

> ⚠️ Ojo con una cosa antes de activar el descuento automático por ventas: las recetas están
> escritas en gramos pero las equivalencias no están configuradas (ver
> `docs/RECETAS_PENDIENTES_PRIORIZADAS.md`). Cuadrar el almacén y activar ese descuento son
> dos cosas distintas; la primera se puede hacer ya, la segunda todavía no.
