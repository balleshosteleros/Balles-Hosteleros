# Cuadrante de jefes de sala — BACANAL (decidido 10-09-2026)

Decisiones de Iván sobre el horario de dirección de sala de BACANAL. **Aún NO están cargadas
en el sistema**: lo que hay en `rrhh_patrones` sigue siendo el cuadrante viejo.

Comparativa publicada: https://claude.ai/code/artifact/b7dd6fec-75a3-4f32-a44e-533a0adf18d8

## La regla que manda: el cierre del fin de semana

Se ha visto que **después de las 00:00 no hay ventas** los viernes y sábados. El recorte quita
horas muertas, no servicio. Cadena de horas, en orden:

| Hora | Qué pasa |
|------|----------|
| 23:00 | **Última reserva.** No se da mesa más tarde. Es el tope que sostiene lo demás |
| 23:30 | **Último pase de cocina.** Deja de dar servicio. ⚠️ NO es la hora de salida del personal de cocina: cada uno sale a la que marque su horario |
| 00:00 | **Cierre al público** (antes se alargaba). Sale el jefe de sala 1 |
| 00:30 | Sale el jefe de sala 2, que se queda a cerrar |

Antes: la sala se estiraba hasta la 01:30 los viernes y sábados.

## Horario nuevo de los dos jefes de sala

Turnos base: mediodía **12:30–17:00** y noche **19:30–00:00**. Cada uno 40 h exactas.

| Día | Ezequiel Falcone (jefe de sala 1) | David Kenny Zapata (jefe de sala 2) |
|-----|-----------------------------------|-------------------------------------|
| Lunes | 12:30–17:00 (4,5 h) | 19:30–00:00 (4,5 h) |
| Martes | 12:30–17:00 (4,5 h) | 19:30–00:00 (4,5 h) |
| Miércoles | **libre** | 12:30–17:00 + 19:30–**23:30** (8,5 h) |
| Jueves | 12:30–17:00 + 19:30–**23:30** (8,5 h) | **libre** |
| Viernes | 12:30–17:00 + 19:30–00:00 (9 h) | **20:00–00:30** (4,5 h) |
| Sábado | 12:30–17:00 + 19:30–00:00 (9 h) | 12:30–17:00 + **20:00–00:30** (9 h) |
| Domingo | 12:30–17:00 (4,5 h) | 12:30–17:00 + 19:30–00:00 (9 h) |
| **Total** | **40 h** | **40 h** |

Dos reglas que dan forma al cuadro:

1. **La media hora de descuento cae en el día largo, nunca en un día suelto entre diario.**
   Entre semana hacen la jornada entera; para cuadrar las 40 h, el que sobra se quita en el
   turno partido de entre semana: miércoles David y jueves Ezequiel salen a las 23:30.
2. **David entra a las 20:00 los viernes y sábados** (no 19:30) justo para que le salgan las
   horas exactas: mismas 4,5 h de noche, corridas media hora, y así queda jefe de sala hasta
   media hora después del cierre al público.

**Nunca libran a la vez**: Ezequiel el miércoles, David el jueves. Entre los dos cubren los 7 días.

## Marcos David Vasile (jefe de sala 3) sale del cuadrante

Tenía 20 h, todas en fin de semana: viernes y sábado 20:30–01:30 y domingo partido
12:30–17:30 + 19:30–00:30. **Diez de esas horas caían después del nuevo cierre al público.**

Recorte: −20 h/semana, ~87 h/mes, **1.040 h/año**. La dirección de sala pasa de 100 h a 80 h
semanales (−20 %). El importe en euros no se puede calcular: Marcos **no tiene condiciones
cargadas** (`empleado_condiciones` solo tiene 2 filas en toda la BD).

## Se retira la coctelería (desde el lunes 14-09-2026)

Decidido junto con el recorte de barra: los fines de semana la barra va con **una persona menos**.
La coctelería **no es el punto fuerte** de BACANAL y es lo que más frena el servicio, así que
**sale la categoría entera y desaparece de la carta** el 14-09-2026. Sin coctelería la barra es
más llevadera, más rápida y más limpia.

En la BD de BACANAL: `Nuestros cocteles` = 10 productos, los 10 con `visible_carta` (son los que
salen en la carta digital); `Coctelería` = 28 productos, ninguno visible. 38 referencias en total.

## Pendiente

- Cargar los patrones nuevos en el sistema y decidir desde qué fecha (los actuales están
  vigentes desde el 01-09-2026).
- **Los camareros siguen con el horario viejo**, alguno hasta las 02:30. Si el local cierra al
  público a las 00:00, hay que revisarlos uno a uno.
- Tramitar la salida de Marcos del cuadrante.
