---
name: Revisión de escandallos con Borja (Bacanal) — cerrada 08/09/2026
description: Nota para Fernando — las fichas técnicas de Bacanal quedaron confirmadas/corregidas con el cocinero; no hace falta seguir tocando cantidades ni alérgenos de estos platos.
type: project
---

**Para Fernando:** la revisión de escandallos y alérgenos de Bacanal con Borja (cocinero) terminó hoy 08/09/2026. No hace falta retomarla ni volver a preguntar por cantidades o alérgenos de las fichas de cocina — está cerrada del todo.

**Qué se aplicó (todo vía migraciones sobre `producto_composicion`/`productos`, no solo en un documento aparte):**
- Cantidades corregidas: Arroz de señoret (sepia 120g, cola de rape 120g, gamba pelada 80g, vieira media 2ud), Curry Rojo con Verduras (salsa de curry rojo 200g), Torrija con helado de vainilla (escandallo montado de cero: pan brioche 60g, sirope de caramelo 15g, helado de vainilla 50g).
- Alérgenos corregidos en su origen real (para que la cascada los reparta sola): aliño asiático (+Crustáceos, Moluscos), furikake (+Gluten), salsa de curry rojo (+Apio, Mostaza), patatas fritas (+Gluten, por la freidora compartida), pan de hamburguesa High Potato (–Sésamo).
- Datos de catálogo corregidos: Lubina (fantasma sin precio/stock) fusionada con Corvina; "Patata frita"/"Patatas fritas" duplicadas unificadas; Tomahawk llevaba puré de patatas por error, corregido a patatas fritas; creadas elaboraciones dedicadas "Corvina frita" y "Pimientos fritos" para que el gluten de la freidora no contamine el pescado crudo del ceviche ni los pimientos de una ensalada.
- **Tortilla trufada huevo** (08/09/2026, cierre final): su escandallo estaba vacío porque 3 de sus 4 ingredientes no existían en el catálogo. Creadas las elaboraciones "Patata pochada", "Huevo a baja temperatura" y "Espuma de yema" (sin composición propia, mismo criterio que "Patatas fritas"), y montado el escandallo completo: Patata pochada 150g, Salsa tartufata 15g, Huevo a baja temperatura 1ud, Espuma de yema 60g.
- Borrado "Tortilla trufada huevo Concurso" (duplicado de un concurso puntual, sin receta ni uso real).

**Why:** dejar constancia para que nadie repita la ronda de preguntas a Borja ni asuma que las fichas siguen desactualizadas.

Relacionado: [[escandallos]], [[project_alergenos_cascada]], [[project_alergenos_seed_sin_alergenos_falso]].
