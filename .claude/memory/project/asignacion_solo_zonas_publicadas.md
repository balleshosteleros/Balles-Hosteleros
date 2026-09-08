# Asignación de mesa: solo zonas que el cliente puede reservar

**Regla literal del dueño:** «NUNCA puedes poner una mesa en una zona donde el
cliente no reserva, sabiendo que el cliente asigna en grupos de zonas, que son
varias zonas a su vez, que debe respetar.»

El cliente reserva eligiendo un **grupo de zonas** (`grupos_zonas`, lo publicado:
"Sala", "Terraza Interior"…). Cada grupo engloba **varias zonas internas**
(`grupo_zona_zonas`). Una zona que no está en ningún grupo activo NO es
reservable y la asignación automática no puede colocar ahí a nadie, ni siquiera
cuando la reserva no pide zona.

Caso real: en BACANAL la zona **Barra** (B1, 3 pax) no está en ningún grupo, y el
motor la daba como candidata a un grupo de 3. Además tiene un bloqueo permanente
("Barra: no se reserva"). En **HABANA es al revés**: su barra son 4 mesas
(B1–B4), está publicada en el grupo "Sala" y **sí se reserva** — es correcto,
no tocar.

**Cómo se aplica:** `getZonasReservables()` en
`src/features/sala/planos/lib/zonas-reservables.ts`, usada por
`asignarMesaAutomatica` (mesas y uniones) y por `proponerMesaAutomatica`.
Solo filtra cuando la reserva NO pide zona ni grupo — si el usuario interno elige
una zona a mano, se respeta su elección.

## Orden de asignación (motor por defecto)
1. Orden manual de `plano_orden_asignacion` (plano + comensales). Manda sobre todo.
2. Si no hay: capacidad más ajustada (`capacidad_max` ascendente) — un grupo de 3
   no se lleva la mesa de 4.
3. Empate de capacidad: **orden de la zona** (`zonas.orden`), que se arrastra en
   Configuración → Reservas → Estructura. Es el orden de llenado: a igual
   capacidad entra antes la mesa de la zona que está más arriba.
4. Dentro de la zona: por serie del código y número (A1, A2… antes que TE1).
5. Mesa suelta antes que unión.

Orden fijado en BACANAL (08-09-2026): Cuadrado, Cristalera, Altas, Redondas,
Super VIP, VIP, Terraza Interior, Terraza Exterior, Barra (esta no es
reservable). Regla dictada por Iván: A8 va después de las cristaleras.
