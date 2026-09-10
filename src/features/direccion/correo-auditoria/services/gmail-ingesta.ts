import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { zonaHorariaDeConfig } from "@/features/empresa/lib/empresa-server";
import { leerRefreshTokenBuzon, marcarBuzonCaducado } from "./buzones";
import {
  extraerContraparte,
  esAutomatico,
  diaEnZona,
} from "./contraparte";

/**
 * Traerse el índice de correo de un buzón (PRP-094, Fase 2).
 *
 * QUÉ SE PIDE A GOOGLE
 *   `format=metadata`: Google devuelve fecha, etiquetas y las cabeceras que se
 *   le piden por nombre. El cuerpo NUNCA sale de Gmail, así que no hay forma de
 *   que acabe guardado por descuido.
 *
 * POR QUÉ EL VOLCADO VA POR TRAMOS
 *   Doce meses de un buzón activo son decenas de miles de correos, y cada uno es
 *   una llamada. Eso no cabe en el tiempo que puede durar una ejecución. En vez
 *   de forzarlo, cada pasada retrocede un trozo y apunta hasta dónde llegó
 *   (`backfill_hasta`); la siguiente sigue por ahí. El histórico se completa
 *   solo en unas cuantas horas y ninguna ejecución se queda a medias sin avisar.
 *
 * POR QUÉ EL DÍA A DÍA VA POR FECHA Y NO POR `historyId`
 *   Gmail ofrece un puntero incremental (`history.list`) que ahorra llamadas.
 *   Ahorra poco aquí —un buzón de restaurante mueve decenas de correos al día—
 *   y caduca: cuando lo hace, Google responde 404 y el buzón deja de
 *   sincronizar EN SILENCIO, que es exactamente el fallo que no queremos.
 *   Pedir «lo de los últimos dos días» cada hora no tiene estado que caducar, y
 *   lo repetido lo descarta la clave única. Menos piezas, ninguna muda.
 */

/** Hasta dónde se vuelca hacia atrás la primera vez. Decisión de Iván. */
const MESES_DE_HISTORICO = 12;

/** Tamaño del trozo que se vuelca en cada pasada. */
const DIAS_POR_TRAMO = 30;

/** Ventana del día a día: se re-pide lo de dos días por si algo llegó tarde. */
const DIAS_INCREMENTAL = 2;

/** Cuánto puede durar una pasada de un buzón antes de dejarlo para la siguiente. */
const PRESUPUESTO_MS = 45_000;

/**
 * Llamadas simultáneas a Gmail.
 *
 * Google permite 250 unidades de cuota por segundo y usuario, y pedir la ficha
 * de un mensaje cuesta 5: el techo real son 50 fichas por segundo. Con 10 a la
 * vez se van unas 20 por segundo — la mitad del margen, que deja sitio a que
 * alguien esté usando su Gmail a la vez sin que Google empiece a rechazar.
 */
const EN_PARALELO = 10;

/** Cabeceras que se piden. Ni una más: cada una es un dato que se guarda. */
const CABECERAS = ["From", "To", "Subject", "List-Unsubscribe"];

type MensajeGmail = {
  id: string;
  threadId?: string;
  internalDate?: string;
  labelIds?: string[];
  payload?: { headers?: { name: string; value: string }[] };
};

export type ResultadoSync = {
  ok: boolean;
  /** Mensajes nuevos guardados en esta pasada. */
  guardados: number;
  /** true si aún queda histórico por volcar (la siguiente pasada sigue). */
  quedaHistorico: boolean;
  error?: string;
};

/**
 * Canjea el permiso del buzón por un acceso temporal.
 *
 * Distingue «revocado» de «Google no contesta ahora», que es la diferencia entre
 * pedirle a alguien que reconecte y esperar tranquilamente a la siguiente
 * pasada. Solo `invalid_grant` significa que el permiso ya no existe.
 */
async function conseguirAcceso(
  refreshToken: string,
): Promise<{ token: string | null; revocado: boolean }> {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    console.error("[correo-auditoria] faltan credenciales de Google");
    return { token: null, revocado: false };
  }

  try {
    const res = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: refreshToken,
        grant_type: "refresh_token",
      }).toString(),
      cache: "no-store",
    });

    const datos = (await res.json().catch(() => ({}))) as {
      access_token?: string;
      error?: string;
    };

    if (res.ok && datos.access_token) {
      return { token: datos.access_token, revocado: false };
    }
    // La única respuesta que significa de verdad «ese permiso ya no existe».
    return { token: null, revocado: datos.error === "invalid_grant" };
  } catch (err) {
    console.error("[correo-auditoria] refresco error:", err);
    return { token: null, revocado: false };
  }
}

/** GET a Gmail devolviendo también el código, para poder reaccionar al 429. */
async function gmail<T>(
  url: string,
  token: string,
): Promise<{ datos: T | null; status: number }> {
  try {
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    });
    if (!res.ok) return { datos: null, status: res.status };
    return { datos: (await res.json()) as T, status: res.status };
  } catch {
    return { datos: null, status: 0 };
  }
}

/** aaaa/mm/dd, que es como Gmail entiende las fechas en una búsqueda. */
function fechaGmail(d: Date): string {
  return `${d.getUTCFullYear()}/${d.getUTCMonth() + 1}/${d.getUTCDate()}`;
}

function restarDias(d: Date, dias: number): Date {
  const copia = new Date(d);
  copia.setUTCDate(copia.getUTCDate() - dias);
  return copia;
}

/** Lista los ids de un rango, paginando hasta que Google deja de dar páginas. */
async function listarIds(
  token: string,
  desde: Date,
  hasta: Date,
): Promise<string[] | null> {
  const ids: string[] = [];
  let pageToken: string | undefined;

  do {
    const params = new URLSearchParams({
      maxResults: "500",
      // La papelera cuenta: ese correo llegó igual y dio trabajo. El spam se
      // filtra después por etiqueta, porque no es trabajo de nadie.
      includeSpamTrash: "true",
      q: `after:${fechaGmail(desde)} before:${fechaGmail(hasta)}`,
    });
    if (pageToken) params.set("pageToken", pageToken);

    const { datos, status } = await gmail<{
      messages?: { id: string }[];
      nextPageToken?: string;
    }>(
      `https://gmail.googleapis.com/gmail/v1/users/me/messages?${params}`,
      token,
    );

    if (!datos) {
      console.error(`[correo-auditoria] listar → ${status}`);
      return null;
    }

    for (const m of datos.messages ?? []) ids.push(m.id);
    pageToken = datos.nextPageToken;
  } while (pageToken);

  return ids;
}

/** Pide la ficha de un mensaje: fecha, etiquetas y cabeceras. Nunca el cuerpo. */
async function pedirFicha(
  token: string,
  id: string,
): Promise<MensajeGmail | null> {
  const params = new URLSearchParams({ format: "metadata" });
  for (const c of CABECERAS) params.append("metadataHeaders", c);

  const { datos } = await gmail<MensajeGmail>(
    `https://gmail.googleapis.com/gmail/v1/users/me/messages/${id}?${params}`,
    token,
  );
  return datos;
}

/** Ejecuta las tareas de N en N, para no disparar el límite de Google. */
async function enTandas<T, R>(
  elementos: T[],
  tamano: number,
  tarea: (elemento: T) => Promise<R>,
): Promise<R[]> {
  const salida: R[] = [];
  for (let i = 0; i < elementos.length; i += tamano) {
    const tanda = elementos.slice(i, i + tamano);
    salida.push(...(await Promise.all(tanda.map(tarea))));
  }
  return salida;
}

type FilaMensaje = {
  empresa_id: string;
  buzon_id: string;
  gmail_message_id: string;
  gmail_thread_id: string;
  direccion: string;
  enviado_at: string;
  dia_empresa: string;
  contraparte_email: string;
  contraparte_dominio: string;
  contraparte_nombre: string;
  asunto: string;
  etiquetas: string[];
  automatico: boolean;
};

/**
 * Convierte la ficha que devuelve Gmail en la fila que se guarda.
 *
 * Devuelve null para lo que no cuenta como trabajo: borradores (aún no se han
 * enviado) y spam (no lo lee nadie).
 */
function aFila(
  mensaje: MensajeGmail,
  empresaId: string,
  buzonId: string,
  tz: string,
): FilaMensaje | null {
  const etiquetas = mensaje.labelIds ?? [];
  if (etiquetas.includes("DRAFT") || etiquetas.includes("SPAM")) return null;

  const cabeceras: Record<string, string> = {};
  for (const h of mensaje.payload?.headers ?? []) {
    cabeceras[h.name.toLowerCase()] = h.value;
  }

  // Saliente si Gmail lo marca como enviado. Un correo puede llevar muchas
  // etiquetas a la vez, así que se mira solo esta.
  const saliente = etiquetas.includes("SENT");

  // En un correo que entra, «el otro» es quien escribe; en uno que sale, a
  // quien se le escribe.
  const contraparte = extraerContraparte(
    saliente ? cabeceras["to"] : cabeceras["from"],
  );

  const enviado = new Date(Number(mensaje.internalDate ?? 0));
  if (Number.isNaN(enviado.getTime()) || enviado.getTime() === 0) return null;

  return {
    empresa_id: empresaId,
    buzon_id: buzonId,
    gmail_message_id: mensaje.id,
    gmail_thread_id: mensaje.threadId ?? "",
    direccion: saliente ? "saliente" : "entrante",
    enviado_at: enviado.toISOString(),
    dia_empresa: diaEnZona(enviado, tz),
    contraparte_email: contraparte.email,
    contraparte_dominio: contraparte.dominio,
    contraparte_nombre: contraparte.nombre,
    asunto: (cabeceras["subject"] ?? "").slice(0, 500),
    etiquetas,
    automatico: esAutomatico(contraparte.email, cabeceras),
  };
}

/**
 * Pone al día un buzón: primero lo de estos días, y si aún falta histórico,
 * retrocede un tramo más.
 */
export async function sincronizarBuzon(
  buzonId: string,
  presupuestoMs: number = PRESUPUESTO_MS,
): Promise<ResultadoSync> {
  const arranque = Date.now();
  const admin = createAdminClient();

  const { data: buzon } = await admin
    .from("correo_buzones")
    .select("id, empresa_id, email, backfill_hasta, conexion, estado")
    .eq("id", buzonId)
    .maybeSingle();

  if (!buzon || buzon.estado !== "Activo") {
    return { ok: false, guardados: 0, quedaHistorico: false, error: "Buzón no disponible" };
  }
  if (buzon.conexion === "sin_conectar") {
    return { ok: false, guardados: 0, quedaHistorico: false, error: "Sin conectar" };
  }

  const refreshToken = await leerRefreshTokenBuzon(buzonId);
  if (!refreshToken) {
    return { ok: false, guardados: 0, quedaHistorico: false, error: "Sin permiso" };
  }

  const { token, revocado } = await conseguirAcceso(refreshToken);
  if (!token) {
    if (revocado) {
      await marcarBuzonCaducado(
        buzonId,
        "Se ha retirado el permiso en la cuenta de Google.",
      );
      return { ok: false, guardados: 0, quedaHistorico: false, error: "Permiso revocado" };
    }
    // Google no contesta ahora: no se toca el estado, se reintenta a la
    // siguiente pasada. Un corte de red no es una desconexión.
    return { ok: false, guardados: 0, quedaHistorico: true, error: "Google no responde" };
  }

  // El buzón vuelve a contar: si venía marcado como caducado, se limpia.
  if (buzon.conexion === "caducado") {
    await admin
      .from("correo_buzones")
      .update({ conexion: "conectado", ultimo_error: null })
      .eq("id", buzonId);
  }

  const { data: empresa } = await admin
    .from("empresas")
    .select("config_operativa")
    .eq("id", buzon.empresa_id as string)
    .maybeSingle();
  const tz = zonaHorariaDeConfig(empresa?.config_operativa);

  const hoy = new Date();
  let guardados = 0;

  // ── 1. Lo de estos días ───────────────────────────────────────────────────
  const desdeIncremental = restarDias(hoy, DIAS_INCREMENTAL);
  const idsRecientes = await listarIds(
    token,
    desdeIncremental,
    restarDias(hoy, -1), // `before` es exclusivo: se pide hasta mañana
  );
  if (idsRecientes === null) {
    await anotarError(buzonId, "Gmail no ha respondido al pedir los últimos días");
    return { ok: false, guardados: 0, quedaHistorico: true, error: "Gmail no responde" };
  }
  guardados += await volcar(
    idsRecientes,
    token,
    buzon.empresa_id as string,
    buzonId,
    tz,
    arranque,
    presupuestoMs,
  );

  // ── 2. Un tramo más de histórico, si falta ────────────────────────────────
  const objetivo = new Date(hoy);
  objetivo.setUTCMonth(objetivo.getUTCMonth() - MESES_DE_HISTORICO);

  let backfillHasta = buzon.backfill_hasta
    ? new Date(`${buzon.backfill_hasta}T00:00:00Z`)
    : hoy;

  let quedaHistorico = backfillHasta > objetivo;

  while (
    quedaHistorico &&
    Date.now() - arranque < presupuestoMs
  ) {
    const finTramo = backfillHasta;
    const inicioTramo = new Date(
      Math.max(restarDias(finTramo, DIAS_POR_TRAMO).getTime(), objetivo.getTime()),
    );

    const ids = await listarIds(token, inicioTramo, restarDias(finTramo, -1));
    if (ids === null) {
      await anotarError(buzonId, "Gmail no ha respondido al traer el histórico");
      break;
    }

    guardados += await volcar(
      ids,
      token,
      buzon.empresa_id as string,
      buzonId,
      tz,
      arranque,
      presupuestoMs,
    );

    backfillHasta = inicioTramo;
    quedaHistorico = backfillHasta > objetivo;

    await admin
      .from("correo_buzones")
      .update({ backfill_hasta: backfillHasta.toISOString().slice(0, 10) })
      .eq("id", buzonId);
  }

  await admin
    .from("correo_buzones")
    .update({ ultima_sync_at: new Date().toISOString(), ultimo_error: null })
    .eq("id", buzonId);

  return { ok: true, guardados, quedaHistorico };
}

/** Pide las fichas de esos ids y las guarda. Devuelve cuántas se guardaron. */
async function volcar(
  ids: string[],
  token: string,
  empresaId: string,
  buzonId: string,
  tz: string,
  arranque: number,
  presupuestoMs: number,
): Promise<number> {
  if (!ids.length) return 0;

  const admin = createAdminClient();

  // Lo ya guardado no se vuelve a pedir: en el día a día casi todo se repite, y
  // preguntar por ello otra vez es gastar cuota de Google para nada.
  const nuevos = await filtrarNuevos(ids, buzonId);
  if (!nuevos.length) return 0;

  let guardados = 0;

  // De 200 en 200: si se acaba el tiempo, lo hecho queda guardado y la
  // siguiente pasada sigue donde lo dejó.
  for (let i = 0; i < nuevos.length; i += 200) {
    if (Date.now() - arranque > presupuestoMs) break;

    const lote = nuevos.slice(i, i + 200);
    const fichas = await enTandas(lote, EN_PARALELO, (id) =>
      pedirFicha(token, id),
    );

    const filas = fichas
      .filter((f): f is MensajeGmail => Boolean(f))
      .map((f) => aFila(f, empresaId, buzonId, tz))
      .filter((f): f is FilaMensaje => Boolean(f));

    if (!filas.length) continue;

    const { error } = await admin
      .from("correo_mensajes")
      .upsert(filas, { onConflict: "buzon_id,gmail_message_id" });

    if (error) {
      console.error("[correo-auditoria] guardar mensajes:", error.message);
      continue;
    }
    guardados += filas.length;
  }

  return guardados;
}

/** Devuelve los ids que todavía no están guardados para ese buzón. */
async function filtrarNuevos(ids: string[], buzonId: string): Promise<string[]> {
  const admin = createAdminClient();
  const conocidos = new Set<string>();

  // Supabase corta en 1000 filas: se pregunta por trozos y se acumula.
  for (let i = 0; i < ids.length; i += 500) {
    const trozo = ids.slice(i, i + 500);
    const { data } = await admin
      .from("correo_mensajes")
      .select("gmail_message_id")
      .eq("buzon_id", buzonId)
      .in("gmail_message_id", trozo);
    for (const fila of data ?? []) {
      conocidos.add(fila.gmail_message_id as string);
    }
  }

  return ids.filter((id) => !conocidos.has(id));
}

/** Deja constancia del fallo en el buzón, sin cambiar su estado de conexión. */
async function anotarError(buzonId: string, motivo: string): Promise<void> {
  const admin = createAdminClient();
  await admin
    .from("correo_buzones")
    .update({ ultimo_error: motivo })
    .eq("id", buzonId);
}
