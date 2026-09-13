# Logística: lo que queda pendiente

> **Para:** Iván · **De:** Fernando · **Fecha:** 2026-09-12
> **Para qué sirve este documento:** tener en un solo sitio, y en cristiano, todo lo que
> falta para que el almacén funcione solo. Las cifras están medidas hoy sobre los datos
> reales, no son estimaciones.

---

## Lo primero: el objetivo, para que se entienda el resto

Todo lo que hemos construido estos meses va a un sitio: **que al vender una hamburguesa,
el sistema descuente solo el pan, la carne y el queso del almacén**. Sin que nadie apunte
nada.

Eso **todavía está apagado**, a propósito. Encenderlo antes de tiempo llenaría el almacén
de números falsos, y un número falso es peor que no tener número: la gente deja de
fiarse y vuelve a contar a mano.

Lo que queda pendiente es, casi todo, lo que falta para poder encenderlo sin mentir.

---

## PARTE 1 — Lo que depende de vosotros

### 1.1 🍳 Las recetas a medio escribir

| | |
|---|---|
| Platos de venta | **403** |
| De ellos, con receta | **230** (57 %) |
| **Sin receta** | **173** |

Un plato sin receta **no descuenta nada** al venderse. No es que descuente mal: es que no
descuenta. Mientras falten 173, encender el descuento daría un almacén que se vacía a
medias.

**Y de las que hay, 49 líneas están en blanco**: el ingrediente está puesto pero no
cuánto lleva. Afecta a **17 productos**, y hay tres que se quedan a coste cero enteros:
las dos hamburguesas y el tartar de salmón. **Eso solo lo sabe Borja.**

### 1.2 🧪 Las elaboraciones

| | |
|---|---|
| Elaboraciones dadas de alta | **32** |
| Con su receta puesta | **12** |
| Con el rendimiento declarado | **0** |

El módulo de elaboraciones funciona desde el 4 de septiembre: el cocinero elige qué ha
hecho, teclea cuánto le ha salido y el sistema descuenta los ingredientes en proporción.

Pero falta **una decisión que cambia los números**, y la llevamos preguntando desde
entonces:

> Cuando escribís la receta de una elaboración, **¿las cantidades son para UNA unidad
> (1 kg, 1 litro) o para una tanda entera?**

Si son por tanda —*«con esto salen 5 litros»*— hay que declarar ese 5. Si no se declara,
el sistema entiende que la receta es para un litro y **descontará 5 veces de menos**.

### 1.3 ⚖️ 27 productos declarados «por unidades» con recetas en gramos

Son 38 líneas de receta. El caso más claro:

> El **cachopo cuesta 218,52 €** en el sistema, y se vende a 27,20 €. El jamón loncheado
> pone **30** queriendo decir 30 gramos, pero está dado de alta **por unidades** a 6,88 €
> cada una. El sistema entiende 30 lonchas: 206 € de jamón en un cachopo.

Pasa con rúcula, canónigos, lechuga, zanahoria, nata, helado, pan brioche, patatas
fritas… todo cosas que se compran al peso.

> **Nuestra recomendación:** cambiarles la unidad a **kilos** (o litros la nata) y las
> recetas cuadran solas. Pero eso toca stock, albaranes y precios, así que **lo decidís
> vosotros**. Decidnos «adelante» y lo hacemos producto por producto.

### 1.4 💶 Un precio que descuadra un plato entero

> El **Arroz de Secreto cuesta 36,05 €** y se vende a 29 €. No es la unidad: es el precio.
> La *base de arroz de carne* tiene **7,92 €/kg en su ficha** pero **87,00 €/kg en el
> proveedor preferido**, y manda el del proveedor. La *base de arroz de pescado*, que es lo
> mismo, está a 7,92 €.
>
> ¿Los 87 € son el precio de una caja entera?

### 1.5 📦 21 cosas que el TPV vende y Balles no conoce

Los cuatro cócteles de HABANA, el MENÚ BACANAL, los sabores de shisha y los «Ud. Extra…».

**Esto ya no hay que pedirlo por escrito: hay una pantalla.** Logística → **Altas de
Ágora**, con el botón puesto en cada línea. Las ventas no se han perdido: al resolver cada
una se recuperan todas de golpe.

Dos avisos concretos:
- **SEXY GREEN** es el cóctel que alguien picó como sabor de shisha. Hay que **enlazarlo**
  al cóctel, no crear nada.
- **Chao Bella** ya no tiene a qué enlazarse: borrasteis el producto el sábado y quedan 23
  consumos sueltos. O lo creáis de nuevo, o se quedan sin resolver.

### 1.6 🔒 Cinco decisiones sobre el cierre de almacén

El cierre funciona desde el 10 de septiembre, pero **nadie lo ha usado todavía** (0
cierres, 0 inventarios confirmados). Tomamos cinco decisiones por defecto para poder
terminarlo. Confirmadlas o cambiadlas:

1. **Solo se cierran días terminados** (como pronto, ayer), porque las ventas del TPV no
   llegan hasta la madrugada siguiente.
2. **Cierra y reabre quien tenga Logística con permiso de edición.** ¿Debería ser solo
   dirección?
3. **Reabrir exige motivo** y reabre solo el último cierre.
4. **El corte es por empresa, no por almacén.** Cocina y barra no se pueden cerrar por
   separado.
5. **El recuento se fecha a la hora en que se cuenta**, para que quede después de las
   ventas de ese día.

### 1.7 🚨 Dos avisos de seguridad

- **Confirmar un inventario, borrar una merma y corregir existencias no piden ningún
  permiso**: los puede hacer cualquier usuario de la empresa. La casilla de cerrar el
  almacén sí está protegida; lo de al lado no.
- La tabla de existencias tiene la **escritura abierta a cualquier usuario autenticado**
  desde el principio. Viene de antes, pero conviene saberlo.

### 1.8 📉 12 productos con existencias en negativo

Stock que dice «−3» cuando en la estantería no puede haber menos de cero. Son de arrastre,
de antes de que el almacén llevara historial. **Se arreglan contando**: el primer
inventario los pone en su sitio. No es trabajo de programación.

---

## PARTE 2 — Lo que depende de nosotros

Solo queda **una pieza**, y es grande.

### 2.1 🥃 La venta por formato

**Lo decidiste tú el 27 de agosto** y todavía no está construido.

Es esto: que un producto de venta pueda tener **hasta cinco formatos**, cada uno con su
**nombre, su precio y su receta propia**:

> **Mojito** → Normal (8 €, su receta) · Grande (12 €, su receta).
> **Brugal** → Combinado (`0,1 ud`) · Chupito (`0,05 ud`) · Botella entera (`1 ud`).

Y el sistema descuenta **el formato exacto que se ha vendido**, no una media.

**Por qué es lo siguiente y no otra cosa:** hoy, cuando se vende un combinado, Balles no
sabe cuánto ron lleva — se lo pregunta a Ágora. Son **2.508 ventas** tirando de un dato
que vive en el TPV. Mientras siga así, la configuración de verdad está en dos sitios, y
mantener lo mismo en dos sitios acaba siempre igual.

### 2.2 ✂️ Cortar el ratio de Ágora

Que de Ágora solo venga **qué se ha vendido y cuánto**, y que el resto lo ponga Balles.

**Va después de los formatos**, obligatoriamente: cortarlo antes dejaría 121 bebidas sin
forma de descontar. Y después de que estén escritas las recetas.

---

## El orden, de una vez

```
1. Formatos de venta          ← nosotros, sin empezar, sin bloqueos
2. Recetas escritas           ← vosotros y Borja (173 platos + 49 blancos)
3. Cortar el ratio de Ágora   ← nosotros, después de 1 y 2
4. ENCENDER EL DESCUENTO      ← el objetivo
```

Lo demás (las altas, las unidades, el precio del arroz, el rendimiento, las cinco
decisiones) **no bloquea ese orden**, pero cada cosa que quede sin resolver será un número
que no cuadre el día que se encienda.

---

## Lo que ya está hecho, para no perderlo de vista

Por si el listado de arriba da la impresión de que falta todo: en estas semanas han
quedado en producción y funcionando el stock unificado con su coste congelado, la unidad
heredada del producto, el cierre de almacén con el historial que se recalcula solo, las
elaboraciones, los complementos del TPV, el arreglo de las recetas que costaban mil veces
de más, y la pantalla de altas de Ágora.

Lo que queda es **la última pieza y los datos**.
