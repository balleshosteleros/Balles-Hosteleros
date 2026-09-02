# Conectar WhatsApp y SMS — guía paso a paso

El software ya está listo para enviar. Falta lo único que no se puede hacer
desde aquí: **una cuenta en el operador que pone los mensajes en la red**.

Ningún sistema puede mandar un SMS sin eso. Los operadores no dejan enviar a
quien no se identifica, para que no se use en estafas. Con WhatsApp igual.

Son unos 20 minutos. La cuenta es gratis; solo se paga por mensaje enviado.

---

## Antes de empezar, ten a mano

- El **CIF de la sociedad**
- Una **tarjeta** (para cargar saldo, no hay cuota de alta)
- Uno de los **números eSIM**, con acceso a sus SMS para recibir un código
- El **logo** del restaurante (te lo pedirá WhatsApp para el perfil)

---

## Paso 1 — Crear la cuenta (5 min)

1. Entra en **twilio.com** y pulsa **Sign up**
2. Correo, contraseña y tu móvil personal (es para proteger la cuenta, no para
   los envíos)
3. Te llega un código por SMS: introdúcelo
4. Te preguntará para qué lo quieres. Contesta:
   - ¿Qué vas a construir? → **Alerts & Notifications**
   - ¿Cómo? → **With code**
   - ¿Lenguaje? → **Node.js**

> Estas respuestas solo cambian qué ejemplos te enseña. No condicionan nada.

---

## Paso 2 — Copiar las credenciales (1 min)

Al entrar verás el **Account Dashboard**. Busca el recuadro
**Account Info**, con dos datos:

- **Account SID** — empieza por `AC…`
- **Auth Token** — está oculto, pulsa **Show**

**Cópiame los dos.** Son la llave: con ellos el software puede enviar en tu
nombre. Trátalos como una contraseña — no los pegues en un correo ni en un
chat de grupo.

---

## Paso 3 — Cargar saldo (2 min)

1. Arriba a la derecha, **Upgrade** (la cuenta de prueba solo envía a tu propio
   número, y eso no sirve para clientes)
2. Mete la tarjeta y carga **20 €** para empezar

> Con 20 € tienes unos 400 WhatsApp o 200 SMS. Suficiente para probar y para
> las primeras semanas.

---

## Paso 4 — Dar de alta el número de SMS (3 min)

1. Menú izquierdo → **Phone Numbers** → **Buy a number**
2. País: **Spain**. Marca la casilla **SMS**
3. Elige uno y cómpralo (1-2 € al mes)

> **Ojo:** este es un número *nuevo de Twilio* para mandar SMS, no tu eSIM. Los
> operadores exigen que los SMS masivos salgan de números registrados para ese
> uso. Tu eSIM es para WhatsApp, que va en el paso siguiente.

**Cópiame el número** que te quede, con el +34 delante.

---

## Paso 5 — Conectar el WhatsApp (5 min)

1. Menú izquierdo → **Messaging** → **Senders** → **WhatsApp senders**
2. **Create new sender**
3. Te lleva a una pantalla de **Meta** (WhatsApp es suyo). Inicia sesión con
   Facebook, o crea la cuenta ahí mismo si no tienes
4. Te pedirá los datos de la empresa: nombre y **CIF**
5. Mete el **número de la eSIM** con el +34
6. Recibirás un código en ese número. Introdúcelo

> **Esto es de ida:** ese número deja de poder usarse en la app normal de
> WhatsApp. Como no los usas, sin problema — pero asegúrate de meter el que
> toca.

**Cópiame el número de WhatsApp** que quede conectado.

---

## Paso 6 — Las cuatro plantillas (5 min)

WhatsApp no deja escribir a un cliente cualquier cosa: cada tipo de mensaje se
declara antes y **Meta lo revisa**. Suele tardar unas horas.

1. **Messaging** → **Content Template Builder** → **Create new**
2. Por cada una de las cuatro:
   - **Content type:** Text
   - **Category:** Utility ← importante, no Marketing
   - Nombre y texto: están en `docs/plantillas-whatsapp-reservas.md`,
     listos para copiar
   - **Submit for approval**

> **Category: Utility** no es un detalle menor. Marketing cuesta más y puede
> acabar bloqueado por spam. Estos avisos son de utilidad: informan de algo que
> el cliente ya ha reservado.

Cuando Meta las apruebe, cada una tendrá un identificador que empieza por
`HX…`. **Cópiame los cuatro**, diciéndome cuál es cuál.

---

## Qué tienes que mandarme al final

```
Account SID:              AC...
Auth Token:               ...
Número para SMS:          +34...
Número de WhatsApp:       +34...

Plantilla confirmación:   HX...
Plantilla reconfirmación: HX...
Plantilla recordatorio:   HX...
Plantilla cancelación:    HX...
```

Con eso lo dejo funcionando y hacemos una prueba real a tu móvil.

Los identificadores de plantilla pueden tardar unas horas: mándame lo demás en
cuanto lo tengas y voy dejando el SMS listo, que ese no depende de Meta.

---

## Si algo se atasca

**"Meta no aprueba la plantilla".** Suele ser la categoría: tiene que ser
*Utility*, no *Marketing*. Si la rechaza igual, mándame el motivo que dé y le
doy otra redacción.

**"No me llega el código al número".** La eSIM tiene que estar activa y con
cobertura. Prueba a pedirlo por llamada en vez de por SMS.

**"Me pide verificar la empresa".** Es normal y tarda unos días. Mientras
tanto se puede enviar con un límite bajo al día, así que no esperes a que
termine para mandarme las credenciales.
