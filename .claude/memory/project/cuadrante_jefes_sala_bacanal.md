# Cuadrante de jefes de sala — BACANAL (decidido 10-09-2026)

Decisiones de Iván sobre el horario de dirección de sala de BACANAL. **El horario de los 3 jefes de sala YA ESTÁ CARGADO**
(vigente desde el 14-09-2026); el resto de decisiones, no.

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

## Horario nuevo de los dos jefes de sala — CARGADO EN EL SISTEMA desde 14-09-2026

Propuesta de los propios jefes de sala, aceptada. Turnos base: mediodía **12:30–17:00**
y noche **19:30–00:00**. Cada uno 40 h exactas. Ezequiel pasa a ser **el de los mediodías**
(abre siempre él) y David **el de las tardes** (cierra siempre él), salvo los partidos.

| Día | Ezequiel Falcone (jefe de sala 1) | David Kenny Zapata (jefe de sala 2) |
|-----|-----------------------------------|-------------------------------------|
| Lunes | 12:30–17:00 (4,5 h) | 19:30–00:00 (4,5 h) |
| Martes | **libre** | 12:30–17:00 + 19:30–**23:30** (8,5 h) |
| Miércoles | 12:30–17:00 + 19:30–**23:30** (8,5 h) | **libre** |
| Jueves | 12:30–17:00 (4,5 h) | 19:30–00:00 (4,5 h) |
| Viernes | 12:30–17:00 + 19:30–00:00 (9 h) | 12:30–17:00 + **20:00–00:30** (9 h) |
| Sábado | 12:30–17:00 + 19:30–00:00 (9 h) | 12:30–17:00 + **20:00–00:30** (9 h) |
| Domingo | 12:30–17:00 (4,5 h) | 19:30–00:00 (4,5 h) |
| **Total** | **40 h** | **40 h** |

Tres reglas que dan forma al cuadro:

1. **La media hora de descuento cae en el día largo, nunca en un día suelto entre diario.**
   Para cuadrar las 40 h: martes David y miércoles Ezequiel salen a las 23:30.
2. **David entra a las 20:00 los viernes y sábados** (no 19:30) para que le salgan las
   horas exactas y quedar hasta media hora después del cierre al público.
3. **Nunca libran a la vez**: Ezequiel el martes, David el miércoles.

Respecto al reparto anterior, esto mueve **4,5 h del domingo al viernes**: el viernes pasa
a tener dos jefes de sala al mediodía y el domingo se queda con uno. Vigilar si el domingo
al mediodía lo pide.

## CÓMO SE CAMBIA UN HORARIO (el antiguo NUNCA se toca)

Hecho con la migración `20260911120000_horario_jefes_sala_bacanal_desde_14_09.sql`:

1. **Turnos nuevos** en `rrhh_turnos`, con familia propia. Los turnos viejos no se editan.
2. **El patrón antiguo se cierra**: `vigente_hasta` = el día anterior y `es_oficial=false`.
   Sigue ahí entero, como versión 1 y con sus turnos originales.
3. **Patrón nuevo** con la **misma `familia_id`** y `version = 2`, `es_oficial = true` y
   `vigente_desde` = el lunes. ⚠️ El índice `uq_rrhh_patrones_familia_oficial` solo admite
   UN oficial por familia: hay que quitarle el oficial al viejo antes de insertar el nuevo.
4. **La asignación del empleado** (`rrhh_patron_empleados`): a la vieja se le pone
   `vigente_hasta`, y se inserta una nueva con `vigente_desde` = el lunes.

Los 3 motores de horario (fichaje, horas del mes y planner) respetan esas fechas, así que
lo ya fichado y lo pasado se queda tal cual.

## Marcos David Vasile (jefe de sala 3) SE QUEDA, con 6 h

**No sale del cuadrante.** Baja de 20 h a **6 h**: viernes y sábado **20:30–23:30** (3 h cada
día). Deja el domingo, que pasa a llevar la pareja, y deja de estirar la noche hasta la 01:30.

Antes: viernes y sábado 20:30–01:30 (5 h cada uno) y domingo partido 12:30–17:30 + 19:30–00:30
(10 h). Las horas que se van son las que caían después del nuevo cierre al público.

Recorte: −14 h/semana, ~61 h/mes, **728 h/año**. La dirección de sala pasa de 100 h a 86 h
semanales (−14 %). El importe en euros no se puede calcular: Marcos **no tiene condiciones
cargadas** (`empleado_condiciones` solo tiene 2 filas en toda la BD).

## Comunicado a los dos jefes de sala (11-09-2026)

Cuatro puntos, en este orden (lo bueno primero, el ajuste en medio, cierra con lo bueno):

1. **Menos horas y más descanso.** Se les recortan **1,5 h** de jornada, que pasan a librar.
   Y los **sábados**: cuando no haya trabajo de preparación y el turno de comidas vaya **por
   debajo de 25 personas**, uno de los dos puede pedir no trabajar ese servicio — acordado
   entre ellos, consensuado con gerencia y **alternándose cada semana**. Solo si se da de
   verdad: si hay trabajo pendiente o sube el servicio, no se aplica.
2. **Recorte de 50 €** en el salario de los dos jefes de sala.
3. **El camarero 1 se queda**: finalmente no se le echa, hay acuerdo. Estará **viernes y sábado
   noche de 20:30 a 23:30** (3 h cada día, 6 h/semana). Ha hecho un gran esfuerzo reduciéndose
   el volumen de horas; agradecimiento expreso a él y a todos.
4. **Octubre**: se está negociando **subir las nóminas** y **reducir o eliminar los complementos
   salariales**.

⚠️ **Dos vigencias distintas, no confundir:**
- **Salario** (el recorte de 50 €): se aplica ya, a **todo septiembre desde el 01-09-2026**.
- **Horarios**: empiezan a contar el **lunes 14-09-2026**.

⚠️ **Sin resolver:** el cuadrante deja a los dos en 40 h clavadas. Si se recortan 1,5 h quedan
en 38,5 h y falta decidir de qué turno salen.

## Se retira la coctelería (desde el lunes 14-09-2026)

Decidido junto con el recorte de barra: los fines de semana hay **menos manos en barra**.
La coctelería **no es el punto fuerte** de BACANAL y es lo que más frena el servicio, así que
**sale la categoría entera y desaparece de la carta** el 14-09-2026. Sin coctelería la barra es
más llevadera, más rápida y más limpia.

En la BD de BACANAL: `Nuestros cocteles` = 10 productos, los 10 con `visible_carta` (son los que
salen en la carta digital); `Coctelería` = 28 productos, ninguno visible. 38 referencias en total.

## Pendiente

- **Los camareros siguen con el horario viejo**, alguno hasta las 02:30. Si el local cierra al
  público a las 00:00, hay que revisarlos uno a uno.
