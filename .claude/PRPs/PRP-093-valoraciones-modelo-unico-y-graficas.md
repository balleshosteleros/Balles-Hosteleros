# PRP-093: Valoraciones — un solo modelo, parámetros claros y gráficas

> **Estado**: PROPUESTO
> **Fecha**: 2026-09-10
> **Proyecto**: Balles-Hosteleros

---

## Objetivo

Dejar la valoración con **cinco bloques de datos y ni uno más**, quitar de la tabla los ocho campos que no se usan o que dicen lo mismo dos veces, y montar sobre eso las gráficas que hoy no se pueden hacer: la nota por área, el motivo real de las malas y qué trae cada vía.

## Por Qué

`resenas` tiene **36 columnas** y 8.853 filas. Medido hoy, esto es lo que está relleno de verdad:

| Dato | Relleno | Lectura |
|------|--------:|---------|
| Nombre del comensal | 8.853 | Siempre |
| Nota (1-5) | 8.417 | Casi siempre |
| Ficha del cliente | 8.799 | Casi siempre |
| Fecha de la visita | 8.795 | Casi siempre |
| Comida / servicio / ambiente | 2.115 / 2.608 / 2.599 | Solo un tercio, y es lo que más dice |
| Comentario escrito | 1.346 | Uno de cada seis |
| Teléfono | 6.192 | Copia de la ficha |
| Correo | 60 | Copia de la ficha, y vacío |
| Reserva enlazada | 8 | No se usa |
| Coge el teléfono · estado de gestión · observaciones · responsable | **0** | El seguimiento de calidad nunca se rellenó |
| Avatar, URL del autor, respuesta, agente IA | 50 | Solo las de Google |
| `respondida` · `respuesta_publicada_at` | 0 · 0 | Dos campos para lo mismo |
| `creado_por` | 0 | Nunca se usó |
| `posicion` | 8.853 | Era el orden del kanban, que ya no existe |

El problema no es el número de columnas: es que **hay dos campos midiendo lo mismo y ninguno manda**. El `estado` (Excelente / Regular / Malo) y la `nota` cuentan la misma historia por separado, y por eso se veía un 4 en la columna Excelente y otro 4 en Regular. Comprobado: el estado se deduce de la nota en **8.412 de 8.417** casos.

Y falta lo contrario: las cuatro columnas de gestión están vacías porque ese trabajo vive en un Excel aparte ("BACANAL 2026 · AGENDAS"), con 104 gestiones, 100 con las observaciones de lo que contó el cliente por teléfono.

## Qué

### El modelo: cinco bloques

Una valoración responde a cinco preguntas y nada más.

**1 · QUIÉN opinó**
- `cliente_id` — la ficha. Es el enlace que hace que la valoración se vea en el cliente.
- `nombre_comensal` — como firmó. Se queda porque hay 54 sin ficha.

**2 · QUÉ dijo**
- `nota` (1-5) — **la que manda**. Media de las tres áreas cuando las puntuó; si no, la global.
- `comida`, `servicio`, `ambiente` (1-5) — el desglose. Lo más valioso y lo menos aprovechado.
- `comentario` — lo que escribió él.

**3 · POR DÓNDE**
- `origen` — WhatsApp · Reservas · Google · Web · App. Una sola palabra, la vía real.

**4 · CUÁNDO**
- `fecha_visita` — el día que vino.
- `fecha_valoracion` — el día que opinó.

**5 · QUÉ SE HIZO** (lo que llena el Excel de calidad)
- `coge_telefono` — sí / no / sin teléfono.
- `estado_gestion` — mandó WhatsApp · se revisa reseña · pendiente de llamada · no quiere llamada · vuelve cliente · no quiere volver.
- `observaciones` — lo que contó por teléfono. **El porqué de la mala nota.**
- `gestionada_por` — quién la llevó.

### Lo que se quita

| Campo | Por qué sobra |
|-------|---------------|
| `estado` | Se calcula de la nota (99,94 % de acierto). Tener los dos es lo que descuadraba la pantalla |
| `posicion` | Era para arrastrar tarjetas en el kanban, que ya no existe |
| `plataforma` | Decía de qué programa vino el registro: GHL o Cover. Los dos están cerrados; a partir de ahora todo nace aquí |
| `email` | 60 de 8.853, y el correo está en la ficha del cliente |
| `telefono` | Copia de la ficha. Se conserva solo en las 54 que no tienen ficha |
| `reserva_id` | 8 de 8.853 |
| `respondida` | Duplica a `respuesta_publicada_at` |
| `creado_por` | Nunca se ha escrito |
| `autor_avatar` | Decorativo, y solo en las 50 de Google |

De 36 columnas a **20**. Sin perder un dato que alguien esté usando.

### Las gráficas que salen

1. **Nota media por mes** — ya existe, pero ahora sin los silencios dentro.
2. **Comida vs servicio vs ambiente** — tres líneas. Responde "¿es la cocina o es la sala?", que hoy no se puede contestar aunque el dato lleve un año guardado.
3. **Qué trae cada vía** — volumen y nota media de WhatsApp, Reservas, Google y Web. Dice si la gente puntúa distinto según quién le pregunte.
4. **Motivo de las malas** — de las observaciones del closer. Cucarachas, precio, esperas: agrupado, es la lista de lo que hay que arreglar.
5. **Cuántas se recuperan** — de las malas gestionadas, cuántas acaban en "vuelve cliente".
6. **Quién responde y quién no** — comensales a los que se pidió opinión frente a los que contestaron, por vía.

### Criterios de éxito

- [ ] La pantalla de Calidad enseña la misma nota que decide el veredicto: un 4 no puede estar en dos sitios.
- [ ] Las 104 gestiones del Excel están dentro, con sus observaciones, y se ven en la valoración correspondiente.
- [ ] La gráfica de comida / servicio / ambiente sale de los 2.115 desgloses que ya existen.
- [ ] Ninguna de las columnas retiradas queda referenciada en el código.

## Fases

1. **Traer el Excel de calidad** — las 104 gestiones a los cuatro campos vacíos. 42 casan con una valoración; el resto se reporta.
2. **El veredicto se calcula** — `estado` deja de guardarse y pasa a derivarse de la nota, con los umbrales en un solo sitio.
3. **Limpieza** — fuera las nueve columnas de arriba, con su migración.
4. **Gráficas** — las seis, en la analítica de Calidad.

## Lo que hace falta antes de empezar

- Confirmar los umbrales del veredicto: **≥ 4 excelente · 3 a 3,9 regular · < 3 malo** (es lo que ya se aplicó al migrar Cover).
- Los Excel de calidad de años anteriores, si existen.
- Decidir si "Nuevo comensal" sigue siendo una columna del tablero o pasa a ser un filtro ("sin valorar todavía").
