/**
 * El motor que hace salir las campañas solas.
 *
 * Hasta ahora la recurrencia se guardaba y no la leía nadie: la pantalla lo
 * decía en letra pequeña ("la recurrencia queda guardada pero el envío se
 * dispara manualmente"). Esto es lo que faltaba.
 *
 * Se ejecuta una vez por hora y mira dos cosas en cada empresa:
 *
 *   1. Campañas **programadas** para un día concreto cuya hora ya llegó.
 *   2. Campañas **activas y periódicas** a las que les toca en esta hora.
 *
 * ── La hora es la del restaurante ─────────────────────────────────────────
 * "Las once" son las once en el comedor. El servidor corre en UTC y quien
 * programó la campaña puede estar en otro huso, así que la hora que se compara
 * es la de la zona horaria de la empresa. Sin esto, una campaña de las 11:00
 * saldría a las 13:00 en verano.
 *
 * ── Lo que NO hace ────────────────────────────────────────────────────────
 *  - No toca las campañas en borrador: un borrador no sale nunca solo.
 *  - No toca la de cumpleaños, que tiene su propio motor porque no manda un
 *    correo a todos, sino uno distinto a cada persona el día que le toca.
 *  - No repite: una campaña que ya salió en esta hora no vuelve a salir aunque
 *    el cron se ejecute dos veces.
 */
import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getZonaHorariaEmpresa } from "@/features/empresa/lib/empresa-server";
import { cronTocaEstaHora } from "@/features/marketing/lib/programacion";
import { sendEmailCampana } from "./resend-service";
import { sendWhatsAppCampana } from "./whatsapp-service";
import { sendSmsCampana } from "./sms-service";
import { abrirEdicion } from "./concurso";
import type {
  CampanaEmail,
  CampanaSms,
  CampanaWhatsApp,
  SegmentoJson,
} from "@/features/marketing/data/campanas";

/** La de cumpleaños se envía sola, persona a persona, y tiene su propio motor. */
const CLAVE_CUMPLEANOS = "CUMPLEANOS";

export interface ResultadoCampana {
  campana: string;
  canal: string;
  enviados: number;
  fallidos: number;
  error?: string;
}

export interface ResumenProgramador {
  empresaId: string;
  empresaNombre: string;
  /** Hora local de la empresa en la que se hizo la pasada. */
  horaLocal: string;
  disparadas: ResultadoCampana[];
}

interface FilaCampana {
  id: string;
  canal: string;
  nombre: string;
  estado: string;
  fecha_envio: string | null;
  recurrencia_cron: string | null;
  ultima_ejecucion: string | null;
  segmento_json: SegmentoJson | null;
  payload: Record<string, unknown> | null;
  reserva_link_id: string | null;
}

/** Reloj de la empresa, en piezas: es lo que compara el cron. */
function relojDe(zona: string): {
  hora: number;
  diaMes: number;
  mes: number;
  diaSemana: number;
  iso: string;
  etiqueta: string;
} {
  const ahora = new Date();
  const partes = new Intl.DateTimeFormat("en-CA", {
    timeZone: zona,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    weekday: "short",
  }).formatToParts(ahora);
  const dato = (tipo: string) => partes.find((p) => p.type === tipo)?.value ?? "";

  const anio = Number(dato("year"));
  const mes = Number(dato("month"));
  const dia = Number(dato("day"));
  const hora = Number(dato("hour")) % 24;
  const diaSemana = new Date(Date.UTC(anio, mes - 1, dia)).getUTCDay();

  return {
    hora,
    diaMes: dia,
    mes,
    diaSemana,
    iso: `${anio}-${String(mes).padStart(2, "0")}-${String(dia).padStart(2, "0")}`,
    etiqueta: `${String(dia).padStart(2, "0")}/${String(mes).padStart(2, "0")}/${anio} ${String(hora).padStart(2, "0")}:00`,
  };
}

/**
 * ¿Ya salió en esta misma hora?
 *
 * Se compara contra la hora LOCAL: si se comparara el instante en bruto, una
 * campaña diaria podría repetirse al cambiar la hora en octubre, cuando las
 * 02:00 locales ocurren dos veces.
 */
function yaSalioEstaHora(ultimaEjecucion: string | null, zona: string, reloj: { iso: string; hora: number }): boolean {
  if (!ultimaEjecucion) return false;
  const anterior = relojDeInstante(new Date(ultimaEjecucion), zona);
  return anterior.iso === reloj.iso && anterior.hora === reloj.hora;
}

function relojDeInstante(instante: Date, zona: string): { iso: string; hora: number } {
  const partes = new Intl.DateTimeFormat("en-CA", {
    timeZone: zona,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    hour12: false,
  }).formatToParts(instante);
  const dato = (tipo: string) => partes.find((p) => p.type === tipo)?.value ?? "";
  return {
    iso: `${dato("year")}-${dato("month")}-${dato("day")}`,
    hora: Number(dato("hour")) % 24,
  };
}

/**
 * La hora de una campaña programada, leída en la zona de la empresa.
 *
 * `fecha_envio` se guarda tal y como se escribió ("2026-12-24T11:00:00", sin
 * huso) precisamente para esto: son las once del restaurante, no las once de
 * quien la programó.
 */
function yaLeTocaba(fechaEnvio: string, reloj: { iso: string; hora: number }): boolean {
  const [fecha, resto] = fechaEnvio.split("T");
  const hora = Number((resto ?? "00:00").slice(0, 2));
  if (fecha < reloj.iso) return true;
  return fecha === reloj.iso && hora <= reloj.hora;
}

function esCumpleanos(c: FilaCampana): boolean {
  return (c.payload?.claveSeed as string | undefined) === CLAVE_CUMPLEANOS;
}

/** Monta el objeto que espera cada emisor a partir de la fila. */
function aCampana(c: FilaCampana, empresaId: string) {
  const payload = c.payload ?? {};
  const base = {
    id: c.id,
    empresaId,
    nombre: c.nombre,
    segmentoJson: (c.segmento_json ?? { operador: "AND", condiciones: [] }) as SegmentoJson,
    reservaLinkId: c.reserva_link_id,
    recurrenciaCron: c.recurrencia_cron,
    mediaUrls: [] as string[],
    ultimaEjecucion: c.ultima_ejecucion,
    claveSeed: (payload.claveSeed as string | null) ?? null,
    reglasCumpleanos: null,
    estado: c.estado as CampanaEmail["estado"],
    fechaEnvio: c.fecha_envio,
    createdAt: "",
    updatedAt: "",
  };

  if (c.canal === "email") {
    return {
      ...base,
      canal: "email" as const,
      asunto: (payload.asunto as string) ?? "",
      preheader: (payload.preheader as string) ?? "",
      remitenteNombre: (payload.remitenteNombre as string) ?? "",
      remitenteEmail: (payload.remitenteEmail as string) ?? "",
      cuerpoHtml: (payload.cuerpoHtml as string) ?? "",
      mes: payload.mes == null ? null : Number(payload.mes),
      segmento: "",
      estadisticas: { enviados: 0, entregados: 0, abiertos: 0, clicks: 0, rebotes: 0, bajas: 0 },
    } as CampanaEmail;
  }
  if (c.canal === "whatsapp") {
    return {
      ...base,
      canal: "whatsapp" as const,
      plantilla: (payload.plantilla as string) ?? "",
      idioma: (payload.idioma as string) ?? "es",
      cuerpo: (payload.cuerpo as string) ?? "",
      variables: (payload.variables as Record<string, string>) ?? {},
      segmento: "",
      estadisticas: { enviados: 0, entregados: 0, leidos: 0, respuestas: 0, fallidos: 0 },
    } as CampanaWhatsApp;
  }
  return {
    ...base,
    canal: "sms" as const,
    cuerpo: (payload.cuerpo as string) ?? "",
    remitente: (payload.remitente as string) ?? "",
    segmento: "",
    estadisticas: { enviados: 0, entregados: 0, fallidos: 0, clicks: 0 },
  } as CampanaSms;
}

/** Envía una campaña por su canal. */
async function enviar(
  admin: SupabaseClient,
  fila: FilaCampana,
  empresaId: string,
): Promise<ResultadoCampana> {
  const campana = aCampana(fila, empresaId);
  const salida: ResultadoCampana = {
    campana: fila.nombre,
    canal: fila.canal,
    enviados: 0,
    fallidos: 0,
  };

  // Las campañas del calendario anual llevan dentro el concurso del mes, y su
  // edición se abre EN EL ACTO DE ENVIAR: antes no, porque quien adivinara la
  // dirección jugaría sin haber recibido el correo.
  if (campana.claveSeed && campana.canal === "email" && campana.mes) {
    const abierta = await abrirEdicion(admin, empresaId, campana.claveSeed, campana.mes);
    if (!abierta.ok) {
      salida.error = `No se pudo abrir el concurso del mes: ${abierta.error}`;
      return salida;
    }
  }

  const r =
    campana.canal === "email"
      ? await sendEmailCampana(campana)
      : campana.canal === "whatsapp"
        ? await sendWhatsAppCampana(campana)
        : await sendSmsCampana(campana);

  salida.enviados = r.enviados ?? 0;
  salida.fallidos = r.fallidos ?? 0;
  if (!r.success) salida.error = r.error ?? "No se pudo enviar";
  return salida;
}

/** Una pasada por una empresa. */
export async function procesarCampanasDeEmpresa(
  admin: SupabaseClient,
  empresaId: string,
  empresaNombre: string,
): Promise<ResumenProgramador> {
  const zona = await getZonaHorariaEmpresa(admin, empresaId);
  const reloj = relojDe(zona);
  const resumen: ResumenProgramador = {
    empresaId,
    empresaNombre,
    horaLocal: reloj.etiqueta,
    disparadas: [],
  };

  const { data } = await admin
    .from("campanas_marketing")
    .select(
      "id, canal, nombre, estado, fecha_envio, recurrencia_cron, ultima_ejecucion, segmento_json, payload, reserva_link_id",
    )
    .eq("empresa_id", empresaId)
    .in("estado", ["programada", "activa"])
    .in("canal", ["email", "whatsapp", "sms"]);

  for (const bruta of (data ?? []) as unknown as FilaCampana[]) {
    if (esCumpleanos(bruta)) continue;

    const periodica = !!bruta.recurrencia_cron;
    const leToca = periodica
      ? bruta.estado === "activa" &&
        cronTocaEstaHora(bruta.recurrencia_cron!, reloj) &&
        !yaSalioEstaHora(bruta.ultima_ejecucion, zona, reloj)
      : bruta.estado === "programada" &&
        !!bruta.fecha_envio &&
        yaLeTocaba(bruta.fecha_envio, reloj) &&
        !bruta.ultima_ejecucion;

    if (!leToca) continue;

    // La marca de ejecución se pone ANTES de enviar. Si se pusiera después y el
    // envío tardara más que el hueco entre pasadas, la siguiente encontraría la
    // campaña sin marcar y la mandaría otra vez: dos correos a nueve mil
    // personas, y eso no se puede deshacer.
    await admin
      .from("campanas_marketing")
      .update({ ultima_ejecucion: new Date().toISOString() })
      .eq("id", bruta.id);

    const resultado = await enviar(admin, bruta, empresaId);
    resumen.disparadas.push(resultado);

    // Una campaña de un solo día se cierra; una periódica sigue viva esperando
    // su próxima vez.
    if (!periodica) {
      await admin
        .from("campanas_marketing")
        .update({ estado: resultado.error && !resultado.enviados ? "fallida" : "finalizada" })
        .eq("id", bruta.id);
    }
  }

  return resumen;
}
