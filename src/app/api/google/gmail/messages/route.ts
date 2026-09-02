import { NextResponse } from "next/server";
import { googleFetchAuto, getGoogleTokens } from "@/lib/google/api";

type GmailThreadListResponse = {
  threads?: { id: string; historyId: string }[];
  nextPageToken?: string;
  resultSizeEstimate?: number;
};

type GmailMessage = {
  id: string;
  threadId: string;
  snippet: string;
  internalDate: string;
  labelIds?: string[];
  payload?: {
    headers: { name: string; value: string }[];
  };
};

type GmailThreadResponse = {
  id: string;
  messages?: GmailMessage[];
};

function header(msg: GmailMessage, name: string): string {
  return (
    msg.payload?.headers?.find(
      (h) => h.name.toLowerCase() === name.toLowerCase(),
    )?.value ?? ""
  );
}

function parseFrom(value: string): { name: string; email: string } {
  const m = value.match(/^(.*?)\s*<(.+)>$/);
  if (m) return { name: m[1].replace(/"/g, "").trim(), email: m[2] };
  return { name: value, email: value };
}

/** Varias direcciones en una cabecera ("a@b.com, Ana <c@d.com>"). */
function parseLista(value: string): { name: string; email: string }[] {
  if (!value.trim()) return [];
  return value
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean)
    .map(parseFrom)
    .filter((d) => d.email.includes("@"));
}

/**
 * NOMBRE DE LOS PARTICIPANTES DEL HILO, COMO GMAIL.
 *
 * Gmail no muestra "el remitente del último mensaje": muestra QUIÉN habla en la
 * conversación, en el orden en que intervino, y a uno mismo lo llama "yo".
 * Reglas que se reproducen aquí:
 *
 *  · Si el mensaje lo has mandado tú, sales como "yo".
 *  · En un hilo con varias personas se listan todas separadas por coma
 *    ("yo, Marta, Luis"), sin repetir a nadie aunque haya escrito diez veces.
 *  · Con más de un participante se usa solo el NOMBRE DE PILA, que es como cabe
 *    la lista en la columna; con uno solo se deja el nombre completo.
 *  · Un hilo que solo tienes tú (un borrador, un correo a ti mismo) se queda en
 *    "yo" en vez de mostrar tu propia dirección.
 *  · Si el contacto no tiene nombre guardado, Gmail enseña la parte anterior a
 *    la arroba, no la dirección entera.
 *
 * En "Enviados" Gmail muestra en cambio a los DESTINATARIOS ("Para: ..."), que
 * es la información útil ahí: ya sabes que lo mandaste tú.
 */
function nombreVisible(d: { name: string; email: string }, soloNombre: boolean): string {
  const limpio = d.name.trim();
  const base =
    limpio && limpio.toLowerCase() !== d.email.toLowerCase()
      ? limpio
      : d.email.split("@")[0];
  if (!soloNombre) return base;
  // "Marta García Ruiz" → "Marta". Una dirección sin nombre no se parte.
  return base.split(/\s+/)[0] || base;
}

function participantesDelHilo(
  msgs: GmailMessage[],
  cuenta: string,
  esEnviados: boolean,
): string {
  const orden: Array<{ name: string; email: string; soyYo: boolean }> = [];
  const vistos = new Set<string>();
  const mia = cuenta.toLowerCase();

  const anotar = (d: { name: string; email: string }) => {
    const clave = d.email.toLowerCase();
    if (vistos.has(clave)) return;
    vistos.add(clave);
    orden.push({ ...d, soyYo: clave === mia });
  };

  for (const m of msgs) {
    if (esEnviados) {
      // En Enviados interesa a quién se escribió, no quién escribe.
      parseLista(header(m, "To")).forEach(anotar);
    } else {
      anotar(parseFrom(header(m, "From")));
    }
  }

  if (orden.length === 0) return "(sin remitente)";

  // Un hilo donde solo apareces tú (nota para uno mismo, borrador) es "yo".
  const otros = orden.filter((d) => !d.soyYo);
  const lista = otros.length > 0 ? orden : orden.slice(0, 1);

  const soloNombre = lista.length > 1;
  return lista
    .map((d) => (d.soyYo ? "yo" : nombreVisible(d, soloNombre)))
    .join(", ");
}

function quitarPrefijoRe(asunto: string): string {
  return asunto.replace(/^\s*(re|fwd|rv|ref)\s*:\s*/i, "").trim();
}

// El servidor corre en UTC; comparar el día con getDate()/getMonth() daría el
// día UTC. Anclamos a la zona peninsular (Madrid) para que "hoy/ayer" y la hora
// del correo coincidan con la hora real en España (PRP-069). La bandeja es del
// usuario, no de una empresa concreta; el desfase entre husos aquí es cosmético.
const TZ_CORREO = "Europe/Madrid";
function diaEnTZ(d: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ_CORREO, year: "numeric", month: "2-digit", day: "2-digit",
  }).format(d);
}
function fechaCorta(internalDate: string): string {
  const d = new Date(parseInt(internalDate, 10));
  const now = new Date();
  const diaD = diaEnTZ(d);
  if (diaD === diaEnTZ(now)) {
    return d.toLocaleTimeString("es-ES", {
      timeZone: TZ_CORREO,
      hour: "2-digit",
      minute: "2-digit",
    });
  }
  const ayer = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  if (diaD === diaEnTZ(ayer)) return "Ayer";
  const diffDays = Math.floor(
    (now.getTime() - d.getTime()) / (1000 * 60 * 60 * 24),
  );
  if (diffDays < 7)
    return d.toLocaleDateString("es-ES", { timeZone: TZ_CORREO, weekday: "short" });
  return d.toLocaleDateString("es-ES", { timeZone: TZ_CORREO, day: "2-digit", month: "short" });
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const carpeta = url.searchParams.get("carpeta") ?? "inbox";
  // Si se pasa labelId explícito (etiqueta del usuario), tiene prioridad
  const labelIdParam = url.searchParams.get("labelId");
  const q = url.searchParams.get("q");
  const pageToken = url.searchParams.get("pageToken");
  const maxResultsParam = Number(url.searchParams.get("maxResults"));
  const maxResults =
    Number.isFinite(maxResultsParam) && maxResultsParam > 0
      ? Math.min(maxResultsParam, 100)
      : 50;
  const labelMap: Record<string, string> = {
    inbox: "INBOX",
    enviados: "SENT",
    borradores: "DRAFT",
    papelera: "TRASH",
    destacados: "STARRED",
    spam: "SPAM",
  };

  // Gmail expone dos cosas que la app antes no cubría:
  //  - "Todos" (archivados incluidos): en la API NO se filtra por labelIds; se
  //    pide el buzón entero con q="in:anywhere -in:spam -in:trash", igual que
  //    la vista "Todos los mensajes" de Gmail web. Sin esto, los correos
  //    archivados (sin INBOX y sin etiqueta de usuario) no salían en ningún
  //    sitio de la app.
  //  - Búsqueda: cuando el usuario escribe un término, se manda como q= a Gmail
  //    para buscar en TODO el buzón (no solo en los 50 ya cargados en cliente).
  const esTodos = carpeta === "todos" && !labelIdParam;
  const label = labelIdParam ?? labelMap[carpeta] ?? "INBOX";

  const params = new URLSearchParams({
    maxResults: String(maxResults),
  });
  if (pageToken) params.set("pageToken", pageToken);

  // Componemos el query de Gmail: la búsqueda del usuario (q) se combina con el
  // ámbito de la carpeta actual, de modo que buscar dentro de "Recibidos" busca
  // en recibidos, y buscar en "Todos" busca en todo el buzón.
  const tieneBusqueda = !!(q && q.trim());
  const partesQuery: string[] = [];
  if (tieneBusqueda) partesQuery.push(q!.trim());

  if (esTodos) {
    // "Todos": todo el buzón salvo spam/papelera (como "Todos los mensajes").
    // Sin labelIds; el ámbito se expresa con operadores de búsqueda.
    partesQuery.push("in:anywhere -in:spam -in:trash");
  } else if (labelIdParam) {
    // Etiqueta de usuario: Gmail permite combinar labelIds + q, así que
    // filtramos por la etiqueta (por ID) y añadimos el término si lo hay.
    // (El operador `label:` de búsqueda usa el NOMBRE, no el ID, por eso aquí
    // usamos labelIds y no lo metemos en el query.)
    params.set("labelIds", label);
  } else if (tieneBusqueda) {
    // Carpeta de sistema + búsqueda: acotamos con operadores in:/is:, que sí
    // se combinan con el término en una sola query.
    const scopePorCarpeta: Record<string, string> = {
      INBOX: "in:inbox",
      SENT: "in:sent",
      DRAFT: "in:drafts",
      TRASH: "in:trash",
      STARRED: "is:starred",
      SPAM: "in:spam",
    };
    partesQuery.push(scopePorCarpeta[label] ?? `in:inbox`);
  } else {
    // Carpeta de sistema sin búsqueda: filtrado directo por label.
    //
    // "Recibidos" es el INBOX COMPLETO, exactamente lo que el usuario ve al
    // abrir gmail.com.
    //
    // NO acotar con `CATEGORY_PERSONAL`. Hubo una versión que lo hacía, con la
    // idea de mostrar "la pestaña Principal" y esquivar las promociones, pero
    // parte de una premisa falsa: estas cuentas tienen Gmail con UNA sola
    // bandeja, sin pestañas. Cuando las pestañas están desactivadas Google ni
    // siquiera categoriza la mayoría de los mensajes — en el buzón de Bacanal,
    // 4 de 7 correos no traen ninguna etiqueta `CATEGORY_*` —, así que filtrar
    // por `CATEGORY_PERSONAL` no seleccionaba una pestaña: descartaba todo el
    // correo sin clasificar, que es correo de trabajo corriente. La bandeja
    // enseñaba 3 de 7 y no había manera de llegar al resto desde el software.
    params.set("labelIds", label);
  }

  if (partesQuery.length > 0) params.set("q", partesQuery.join(" "));

  // Se necesita la dirección propia para poder decir "yo" en los hilos donde
  // el que escribe eres tú, exactamente como hace Gmail.
  const { email: cuentaPropia } = await getGoogleTokens();

  // 1) Listado de hilos (conversaciones), igual que Gmail web
  const listRes = await googleFetchAuto<GmailThreadListResponse>(
    `https://gmail.googleapis.com/gmail/v1/users/me/threads?${params.toString()}`,
  );
  if (listRes.needsReauth) {
    return NextResponse.json(
      { connected: false, needsReauth: true, mensajes: [] },
      { status: 401 },
    );
  }
  const list = listRes.data;
  if (!list || !list.threads) {
    return NextResponse.json({ connected: true, mensajes: [], nextPageToken: null });
  }

  // 1.b) Qué hilos llevan ficheros. La etiqueta HAS_ATTACHMENT no es fiable
  // (correos con PDF real llegan sin ella) y `format=metadata` no devuelve las
  // partes del mensaje, así que se le pregunta a Gmail con su propio operador
  // `has:attachment` y se cruzan los ids. Es una sola llamada extra.
  const idsHilo = list.threads.slice(0, maxResults).map((t) => t.id);
  const conAdjunto = new Set<string>();
  if (idsHilo.length > 0) {
    const paramsAdj = new URLSearchParams({
      maxResults: String(maxResults),
      q: `${partesQuery.length > 0 ? partesQuery.join(" ") + " " : ""}has:attachment`,
    });
    const label = params.get("labelIds");
    if (label) paramsAdj.set("labelIds", label);
    const adjRes = await googleFetchAuto<GmailThreadListResponse>(
      `https://gmail.googleapis.com/gmail/v1/users/me/threads?${paramsAdj.toString()}`,
    );
    adjRes.data?.threads?.forEach((t) => conAdjunto.add(t.id));
  }

  // 2) Detalles de cada hilo en paralelo (todos sus mensajes en metadata)
  const detalles = await Promise.all(
    list.threads.slice(0, maxResults).map((t) =>
      googleFetchAuto<GmailThreadResponse>(
        `https://gmail.googleapis.com/gmail/v1/users/me/threads/${t.id}?format=metadata&metadataHeaders=From&metadataHeaders=To&metadataHeaders=Subject&metadataHeaders=Date`,
      ).then((r) => r.data),
    ),
  );

  const mensajes = detalles
    .filter(
      (t): t is GmailThreadResponse =>
        t !== null && Array.isArray(t.messages) && t.messages.length > 0,
    )
    .map((t) => {
      const msgs = t.messages!;
      const ultimoMsg = msgs[msgs.length - 1];
      const primerMsg = msgs[0];
      const esEnviados = carpeta === "enviados";
      // La dirección "de la fila": en Enviados es el destinatario (a quién le
      // escribiste), en el resto el remitente. Es la que usan el avatar y el
      // botón de responder, así que tiene que ser la persona que se ve escrita.
      const contraparte = esEnviados
        ? parseLista(header(ultimoMsg, "To"))[0] ?? parseFrom(header(ultimoMsg, "From"))
        : parseFrom(header(ultimoMsg, "From"));

      // Estado agregado del hilo (Gmail considera el hilo no leído si CUALQUIER
      // mensaje lo está; idem con la estrella). También unimos todas las labels
      // para que las etiquetas del usuario se vean.
      const todosLabels = new Set<string>();
      let algunoNoLeido = false;
      let algunoEstrella = false;
      for (const m of msgs) {
        m.labelIds?.forEach((l) => todosLabels.add(l));
        if (m.labelIds?.includes("UNREAD")) algunoNoLeido = true;
        if (m.labelIds?.includes("STARRED")) algunoEstrella = true;
      }

      const asuntoBase =
        header(primerMsg, "Subject") || header(ultimoMsg, "Subject") || "";
      // Gmail muestra el asunto del primer mensaje sin "Re:"
      const asunto = quitarPrefijoRe(asuntoBase) || "(sin asunto)";

      return {
        id: ultimoMsg.id,
        threadId: t.id,
        remitente: participantesDelHilo(msgs, cuentaPropia ?? "", esEnviados),
        email: contraparte.email,
        asunto,
        preview: ultimoMsg.snippet,
        fecha: fechaCorta(ultimoMsg.internalDate),
        leido: !algunoNoLeido,
        estrella: algunoEstrella,
        carpeta,
        labelIds: Array.from(todosLabels),
        mensajesCount: msgs.length,
        // Clip de la fila: el hilo salió en la consulta `has:attachment`, o
        // Gmail lo etiquetó (esa etiqueta sola no basta, ver arriba).
        tieneAdjuntos: conAdjunto.has(t.id) || todosLabels.has("HAS_ATTACHMENT"),
        // Destinatarios del último mensaje: los necesita "Responder a todos"
        // del menú contextual, que sin esto no tendría a quién poner en Cc.
        destinatarios: [
          ...parseLista(header(ultimoMsg, "To")),
          ...parseLista(header(ultimoMsg, "Cc")),
        ].map((d) => d.email),
      };
    });

  return NextResponse.json({
    connected: true,
    mensajes,
    nextPageToken: list.nextPageToken ?? null,
  });
}
