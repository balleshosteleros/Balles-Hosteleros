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
