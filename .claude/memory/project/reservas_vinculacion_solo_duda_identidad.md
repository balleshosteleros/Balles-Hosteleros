# Vinculación de reservas: solo se pregunta si puede ser OTRA persona

Cuando una reserva engancha con una ficha que ya existe (por correo O por
teléfono, nunca por nombre) y algún dato difiere, **casi nunca hay que
preguntar nada**. La regla vive en `decidirVinculacion()`
(`src/features/sala/lib/cliente-link.ts`) y es la única fuente:

| Qué cambia | Qué hace |
|---|---|
| Nombre y/o apellidos | **Automático.** Manda la ficha. |
| Enganchó por CORREO y el móvil es otro | **Automático.** Manda la ficha. |
| Enganchó por TELÉFONO y el correo es otro | **PREGUNTA.** Móvil compartido: puede ser otra persona. |

**Por qué:** con la regla vieja cualquier diferencia abría el aviso «¿Es la
misma persona?». El 75 % se cerraba con «Dejar esta» — el cliente había escrito
«Gil» donde su ficha decía «Gil Garcia», o «Bea» por «Beatriz». Preguntar eso
no protege nada y entrena a quien está en sala a pulsar sin leer, que es
justo lo que hace peligroso el aviso que SÍ importa.

**Consecuencias:**
- La ficha **nunca** se modifica desde una reserva (decisión de Iván, 06-09-26):
  un móvil nuevo NO se guarda solo, solo queda anotado.
- Lo declarado y descartado se anota en la actividad del CLIENTE
  (`registrarVinculacionAutomatica()`), no se pierde.
- El correo de confirmación sale con los datos de la FICHA. Excepción única:
  cuando hay duda de identidad (teléfono + otro correo) va al buzón de quien
  reservó, para no avisar a un tercero ni revelarle sus datos.
- Solo la reserva PÚBLICA genera el aviso. Sala y RwG no lo marcan nunca.

Ver [[reservas_vinculacion_revision_rgpd]] y [[reservas_dedup_cliente]].

## A qué correo va cada cosa (cuando SÍ pregunta)

Mientras el aviso está PENDIENTE, la reserva lleva el correo **que escribió el
cliente**, no el de la ficha:

- La **confirmación** le llega a él. Es quien ha reservado, y como puede no ser
  el titular, mandarla al de la ficha avisaría a alguien que no ha reservado y
  le revelaría datos de un tercero.
- Ese correo lleva un aviso: «tu reserva figura a nombre de Nicole R.»
  (apellido abreviado a la inicial, para no filtrar la identidad del titular).
  Así el cliente puede decir «esta no soy yo».

Al **resolver** el aviso:

- **Conservar** → `reservas.cliente_email` vuelve al de la FICHA. Todo lo
  posterior (valoración, recordatorios) va al de siempre. El correo escrito se
  descarta.
- **Actualizar** → el correo nuevo pasa a la ficha y manda a partir de ahí.
- **Separar** → ficha propia con el correo nuevo.

Los correos **ya enviados no se tocan**: `reserva_email_envios` guarda el
`destinatario` real de cada uno, así que el histórico de la reserva sigue
mostrando a qué dirección salió cada correo aunque luego se descartara.

**Bug corregido 06-09-26:** en `CONSERVAR` el código hacía
`cliente_email: r.cliente_email` — se reasignaba su propio valor, no cambiaba
nada, y la reserva se quedaba con el correo descartado de por vida. La
valoración se iba a una dirección que el restaurante había rechazado. Pasó de
verdad con una reserva (`nicoleyodi@hotmail.com` en vez de
`laricanicky@gmail.com`).
