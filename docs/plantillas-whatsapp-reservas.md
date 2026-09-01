# Plantillas de WhatsApp para los avisos de reserva

Meta revisa una a una las plantillas antes de dejar enviarlas. Aquí está el
texto exacto de las cuatro, listo para copiar en el panel del proveedor.

**Por qué hacen falta:** fuera de las 24 h desde el último mensaje del cliente,
WhatsApp solo deja escribir con plantillas aprobadas. Como un aviso de reserva
casi siempre cae fuera de esa ventana, sin plantilla no sale nada.

La aprobación suele tardar unas horas.

---

## Cómo se rellenan

Las cuatro usan los mismos huecos, **en este orden**:

| Hueco | Qué es | Ejemplo |
|---|---|---|
| `{{1}}` | Nombre del cliente | María |
| `{{2}}` | Nombre del restaurante | La Bacanal |
| `{{3}}` | Fecha | lunes, 15 de junio de 2026 |
| `{{4}}` | Hora | 21:00 |
| `{{5}}` | Personas | 4 personas |
| `{{6}}` | Enlace para cancelar | https://…/c/HVTUWKFH |

El orden importa: en Meta son huecos numerados, no nombres. Si se cambia el
orden aquí, hay que cambiarlo también en `src/lib/mensajeria/reservas.ts`.

---

## 1. Confirmación

**Categoría:** Utilidad · **Nombre sugerido:** `reserva_confirmacion`

```
Hola {{1}}, tu reserva en {{2}} está confirmada.

📅 {{3}}
🕐 {{4}}
👥 {{5}}

Si no puedes venir, avísanos aquí y liberamos la mesa: {{6}}

¡Te esperamos!
```

---

## 2. Reconfirmación

**Categoría:** Utilidad · **Nombre sugerido:** `reserva_reconfirmacion`

> Es el que más mesas salva: el cliente que no va a venir avisa, y la mesa se
> puede revender.

```
Hola {{1}}, te recordamos tu reserva en {{2}}.

📅 {{3}}
🕐 {{4}}
👥 {{5}}

¿Nos confirmas que vienes? Si te ha surgido algo, puedes cancelar aquí: {{6}}
```

---

## 3. Recordatorio

**Categoría:** Utilidad · **Nombre sugerido:** `reserva_recordatorio`

```
Hola {{1}}, te esperamos hoy en {{2}}.

🕐 {{4}}
👥 {{5}}

Si al final no puedes venir, avísanos aquí: {{6}}
```

> Aquí no se pone la fecha: es hoy, y decirlo sobra.
> La plantilla debe declarar igualmente los seis huecos.

---

## 4. Cancelación

**Categoría:** Utilidad · **Nombre sugerido:** `reserva_cancelacion`

```
Hola {{1}}, tu reserva en {{2}} del {{3}} a las {{4}} ha quedado cancelada.

Si ha sido un error o quieres reservar otro día, escríbenos y lo vemos.
```

> No lleva enlace de cancelar: la reserva ya no existe. El hueco `{{6}}` se
> envía vacío.

---

## Al terminar

Cada plantilla aprobada tiene un identificador. Hay que ponerlo en su variable:

```
WHATSAPP_PLANTILLA_CONFIRMACION=
WHATSAPP_PLANTILLA_RECONFIRMACION=
WHATSAPP_PLANTILLA_RECORDATORIO=
WHATSAPP_PLANTILLA_CANCELACION=
```

Sin ese identificador el WhatsApp no sale y el aviso cae al correo, que sigue
funcionando como siempre.

---

## Dos cosas que conviene saber

**La categoría importa.** Estas cuatro son de *Utilidad*: informan de algo que
el cliente ya ha contratado. Si se mandan como *Marketing* cuestan más y pueden
acabar bloqueadas por spam. Las campañas comerciales sí van como Marketing, y
son otras plantillas distintas.

**No se pueden editar una vez aprobadas.** Cambiar el texto es crear una
plantilla nueva y volver a esperar la revisión. Por eso conviene revisar bien
las faltas y el tono antes de enviarlas.
