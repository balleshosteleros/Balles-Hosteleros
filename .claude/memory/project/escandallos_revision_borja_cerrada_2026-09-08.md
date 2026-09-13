---
name: Revisión de escandallos con Borja (Bacanal) — cerrada 08/09/2026
description: Nota para Fernando — las fichas técnicas de Bacanal quedaron confirmadas/corregidas con el cocinero; no hace falta seguir tocando cantidades ni alérgenos de estos platos.
type: project
---

> ### ⚠️ ALCANCE REAL DE ESTA NOTA (comprobado en producción el 2026-09-12)
>
> Lo de abajo es cierto **para los platos que Borja revisó**, pero la frase «no hace falta
> volver a preguntar por cantidades» se ha quedado corta y frena preguntas que sí hay que
> hacerle. Dos matices:
>
> **1. La mitad de sus correcciones no están llegando a los números**, y no es culpa suya:
> dictó bien, pero el producto está dado de alta en la unidad equivocada.
> · Cola de rape: dijo 120 g → el sistema entiende **120 colas de rape**.
> · Vieira media: dijo 2 ud → el producto está en kilos, entiende **2 kg**.
> · Salsa de curry rojo: 200 g → **200 unidades**. La torrija entera, igual.
> Se arregla cambiando la unidad de esos productos a kilos, no volviendo a preguntarle.
> Es el asunto de los 27 productos «por unidades» de `docs/LOGISTICA_LO_QUE_QUEDA_PENDIENTE.md`.
>
> **2. Quedan 49 cantidades en blanco que esta revisión NO tocó**, en dos grupos:
> · **9 platos de venta** con la receta sin tocar desde el 10-07-2026 — Tartar de Salmón
>   (los 6 ingredientes en blanco), las dos hamburguesas, vieiras con kimchi, entraña,
>   croquetas, ceviche thai, arroz negro, jamón ibérico. Nunca entraron en la revisión.
> · **8 elaboraciones creadas el 08-09-2026**, el mismo día de esta nota, con los
>   ingredientes puestos y sin cantidades: ensaladilla, pico de gallo, ragout de setas,
>   barbacoa asiática, guacamole, salsa de curry mango, espuma de tiramisú, emulsión de
>   ají amarillo. Bloquean el módulo de elaboraciones.
>
> **Conclusión: sí hay que volver a Borja, pero por cosas DISTINTAS a las que ya cerró.**
> No es repetirle trabajo.

**Para Fernando:** la revisión de escandallos y alérgenos de Bacanal con Borja (cocinero) terminó hoy 08/09/2026. No hace falta retomarla ni volver a preguntar por cantidades o alérgenos de las fichas de cocina — está cerrada del todo.

**Qué se aplicó (todo vía migraciones sobre `producto_composicion`/`productos`, no solo en un documento aparte):**
- Cantidades corregidas: Arroz de señoret (sepia 120g, cola de rape 120g, gamba pelada 80g, vieira media 2ud), Curry Rojo con Verduras (salsa de curry rojo 200g), Torrija con helado de vainilla (escandallo montado de cero: pan brioche 60g, sirope de caramelo 15g, helado de vainilla 50g).
- Alérgenos corregidos en su origen real (para que la cascada los reparta sola): aliño asiático (+Crustáceos, Moluscos), furikake (+Gluten), salsa de curry rojo (+Apio, Mostaza), patatas fritas (+Gluten, por la freidora compartida), pan de hamburguesa High Potato (–Sésamo).
- Datos de catálogo corregidos: Lubina (fantasma sin precio/stock) fusionada con Corvina; "Patata frita"/"Patatas fritas" duplicadas unificadas; Tomahawk llevaba puré de patatas por error, corregido a patatas fritas; creadas elaboraciones dedicadas "Corvina frita" y "Pimientos fritos" para que el gluten de la freidora no contamine el pescado crudo del ceviche ni los pimientos de una ensalada.
- **Tortilla trufada huevo** (08/09/2026, cierre final): su escandallo estaba vacío porque 3 de sus 4 ingredientes no existían en el catálogo. Creadas las elaboraciones "Patata pochada", "Huevo a baja temperatura" y "Espuma de yema" (sin composición propia, mismo criterio que "Patatas fritas"), y montado el escandallo completo: Patata pochada 150g, Salsa tartufata 15g, Huevo a baja temperatura 1ud, Espuma de yema 60g.
- Borrado "Tortilla trufada huevo Concurso" (duplicado de un concurso puntual, sin receta ni uso real).

**Why:** dejar constancia para que nadie repita la ronda de preguntas a Borja ni asuma que las fichas siguen desactualizadas.

Relacionado: [[escandallos]], [[project_alergenos_cascada]], [[project_alergenos_seed_sin_alergenos_falso]].
