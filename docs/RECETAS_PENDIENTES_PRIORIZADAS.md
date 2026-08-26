# Recetas pendientes, ordenadas por lo que de verdad se vende

> **Generado:** 2026-08-26 · **Datos:** ventas reales de Ágora de los últimos 60 días
> (hay histórico completo desde el 17-jun) · **Fuente:** `pos_tickets` + `pos_ticket_lineas`
> cruzado con `producto_composicion`.
>
> **Para qué sirve:** hoy, cuando se vende un cóctel o un plato, el almacén **no se entera**.
> Para que se entere hace falta que alguien escriba qué lleva cada cosa. Este documento dice
> **por dónde empezar** para que el esfuerzo cunda.

---

## Lo primero: son 80 productos, no 200

Mirando producto por producto, la mayoría de lo que se vende **ya descuenta bien**:

| Situación | Bacanal | Habana | ¿Hay que hacer algo? |
|---|---|---|---|
| ✅ Ya tiene receta escrita | 21 | 0 | No |
| ✅ **Bebida enlazada a su botella** (el TPV ya manda la medida) | 53 | 68 | **No** |
| 🔴 **No descuenta nada** (cócteles, platos, cafés) | **36** | **44** | Sí: escribir la receta |

**Solo 80 productos necesitan receta.** Los otros 121 ya están resueltos.

### Por qué los destilados NO necesitan que nadie mida la copa

Ágora manda en cada línea de venta **qué formato se ha servido y qué fracción de botella es**:
un `Comb Brugal` viene marcado como **0,1 botellas**, un `Chupito Brugal` como 0,05, y una
`Copa. Alma Blanco` como 0,2. El sistema ya lo aplica solo. Comprobado con los datos reales:
Brugal sale a **0,70 botellas/día**, que es justo lo que corresponde a los combinados servidos.
Así que ron, whisky, ginebra y vino por copas **ya descuentan correctamente** — no hay que tocar
nada ahí.

---

## 🔴 Los 80 que sí necesitan receta

Ordenados por unidades vendidas en 60 días, que es el orden en el que conviene atacarlos.

### HABANA — top 15 (cubren el 83 % de lo que se sirve sin receta)

| # | Producto | Categoría | Uds. 60 d | € 60 d |
|---|---|---|---|---|
| 1 | Shisha 1 Sabor | Shishas | 345 | 5.348 |
| 2 | Mojito Habanero | Cócteles | 326 | 2.853 |
| 3 | Coco Colado | Cócteles | 270 | 2.363 |
| 4 | Sex On Habana | Cócteles | 223 | 1.951 |
| 5 | Shisha 2 Sabores | Shishas | 176 | 2.728 |
| 6 | Papagayo | Cócteles | 157 | 1.374 |
| 7 | Mojito Habanero Sin | Cócteles sin | 119 | 916 |
| 8 | Spicy Margarit | Cócteles | 116 | 1.015 |
| 9 | Coco Colado Sin | Cócteles sin | 86 | 662 |
| 10 | Tinto de Verano | Vinos | 82 | 336 |
| 11 | Sex On Habana Sin | Cócteles sin | 77 | 593 |
| 12 | Blue Watermelon | Cócteles | 67 | 586 |
| 13 | Habanito | Cócteles | 64 | 560 |
| 14 | Orange Oasis | Cócteles | 59 | 516 |
| 15 | Caipi-Brasileña | Cócteles | 45 | 394 |

> **Dos atajos que reducen el trabajo casi a la mitad:**
> - Las versiones **"Sin"** (Mojito Habanero Sin, Coco Colado Sin, Sex On Habana Sin, Papagayo
>   Sin, Banana Daiquiri Sin, The One Sin…) son la misma receta quitando el alcohol: salen
>   copiadas de la normal. Son 7 productos prácticamente gratis.
> - Las **shishas** (1 y 2 sabores, 521 uds y 8.000 € en dos meses — lo que más pesa) no son
>   cocina: son tabaco y carbón. Una receta de dos líneas resuelve las dos.

### BACANAL — top 15 (cubren el 89 %)

| # | Producto | Categoría | Uds. 60 d | € 60 d |
|---|---|---|---|---|
| 1 | Servicio Pan | Para empezar | 321 | 362 |
| 2 | Tinto de Verano | Vinos tintos | 178 | 730 |
| 3 | Tortilla trufada con huevo | Para empezar | 151 | 2.094 |
| 4 | Entrecot lomo bajo frisona | De la tierra | 131 | 3.406 |
| 5 | San Miguel | Cervezas | 104 | 380 |
| 6 | Torreznos con guacamole | Para empezar | 94 | 1.401 |
| 7 | Torrijas con helado | Postres | 92 | 616 |
| 8 | Café con Leche | Cafés | 90 | 122 |
| 9 | Coulant de Chocolate | Postres | 76 | 502 |
| 10 | Café con Hielo | Cafés | 71 | 159 |
| 11 | Falso risotto con setas | Arroces | 70 | 652 |
| 12 | Alcachofas con huevo de codorniz | Para empezar | 65 | 742 |
| 13 | Ensaladilla Rusa | Para empezar | 58 | 622 |
| 14 | Café Solo | Cafés | 55 | 113 |
| 15 | Tiramisú | Postres | 51 | 337 |

> **Tres casos que no son receta de cocina:**
> - **San Miguel** (104 uds) es un botellín que no está enlazado a su ficha de compra. Es un
>   arreglo mecánico, no una receta.
> - **Servicio Pan** (321 uds) y, en Habana, **Vaso de Agua** y **Cambio de Carbón** (ambos a
>   0 €) son conceptos de servicio: decidid si interesa descontar algo o se dejan fuera.
> - Los **cafés** (216 uds entre los tres) son café + leche: una receta sirve para los tres.

---

## ⚠️ Antes de armar el descuento de stock hay que arreglar las unidades

Al construir el cálculo de consumo ha salido un problema que conviene saber:

**Las 21 recetas que ya existen están escritas en gramos, pero el sistema no lo sabe.** La receta
del Cachopo dice "350 de Filete de vaca", que son 350 gramos — pero el producto está medido en
**kilogramos** y nadie ha rellenado la equivalencia (`unidad_uso` y `factor_conversion` están sin
configurar en los **693** productos). Sin esa equivalencia, el sistema entiende **350 kg de filete
por cachopo**.

Consecuencias:

1. El cálculo de consumo diario **se salta a propósito** los ingredientes con la equivalencia sin
   declarar, y los deja a 0 en vez de escribir un disparate. Por eso hoy la reposición por ventas
   funciona bien para bebidas y no propone nada para los platos.
2. **Esto también afecta al descuento de stock** (que hoy está desactivado). El día que se active
   sin arreglar las unidades, un cachopo vendido restaría 350 kg de filete del almacén.

**Hace falta una decisión de negocio antes de seguir:** en qué unidad se escriben las recetas
(gramos y centilitros es lo natural en cocina) y rellenar la equivalencia en los productos que se
compran por kilo o por litro. Es una pasada de configuración, no un desarrollo.

---

## Propuesta de orden de trabajo

1. **Media hora de barra** → las 2 shishas de Habana. Son lo que más se vende y más factura.
2. **Una tarde de barra** → los 8 cócteles más vendidos de Habana. Las versiones "Sin" salen
   copiadas detrás.
3. **Una tarde de cocina** → los 10 platos y postres más vendidos de Bacanal.
4. **Aparte, y antes de activar el descuento de stock:** decidir la unidad de las recetas y
   rellenar las equivalencias (ver el aviso de arriba).

Cada receta que se escriba entra sola en el sistema: el cálculo de reposición la recoge en cuanto
existe, sin tocar nada más.

---

## Cómo se ha calculado

- Ventana: 60 días naturales hasta hoy, tickets de Ágora con producto identificado.
- **"Ya tiene receta"** = tiene alguna línea en `producto_composicion` que no sea el espejo 1:1
  automático que creó la migración de junio.
- **"Bebida enlazada"** = solo tiene el espejo 1:1 con su ficha de compra. Es correcto: el
  `sale_format_ratio` que manda Ágora en cada línea aporta la fracción de botella servida.
- **"No descuenta nada"** = no tiene ninguna línea de composición.
