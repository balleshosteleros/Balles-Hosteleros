/**
 * Validación del canje de un código de Ticket.
 *
 * Un código de Ticket es de UN SOLO USO y arrastra las condiciones que el
 * restaurante configuró en el producto: qué días se puede usar, a qué horas,
 * en qué turnos y en qué zonas. Aquí viven esas reglas, separadas de la base de
 * datos y de la interfaz, para que el motor público y el panel interno apliquen
 * exactamente las mismas.
 *
 * Regla de oro: un eje vacío significa "sin restricción". Si el restaurante no
 * marca ningún día, vale cualquier día — no lo contrario.
 */

import { DIA_SEMANA_KEY, type DiaSemanaKey } from "@/features/sala/data/reservas";

export type TicketTurno = "COMIDA" | "CENA";

/** Condiciones tal y como se guardan en el producto. */
export interface TicketCondiciones {
  diasSemana: DiaSemanaKey[];
  diasExcluidos: string[];
  turnos: TicketTurno[];
  horaDesde: string | null;
  horaHasta: string | null;
  horasExcluidas: string[];
  grupoZonaIds: string[];
}

/** Datos de la compra que también condicionan el canje. */
export interface TicketCompraEstado {
  estado: string;
  canjeHasta: string | null;
  unidades: number;
}

export type TicketMotivoInvalidez =
  | "NO_EXISTE"
  | "YA_UTILIZADO"
  | "NO_PAGADO"
  | "ANULADO"
  | "CADUCADO"
  | "DIA_NO_PERMITIDO"
  | "FECHA_EXCLUIDA"
  | "TURNO_NO_PERMITIDO"
  | "HORA_NO_PERMITIDA"
  | "ZONA_NO_PERMITIDA";

/**
 * Mensajes para el cliente final. Dicen qué pasa y, cuando se puede, qué hacer:
 * un "código no válido" a secas deja al cliente sin saber si se equivocó de
 * letra o si es que ese día no entra.
 */
export const TICKET_MOTIVO_LABELS: Record<TicketMotivoInvalidez, string> = {
  NO_EXISTE: "No encontramos ningún código así. Revísalo y vuelve a intentarlo.",
  YA_UTILIZADO: "Este código ya se usó en otra reserva.",
  NO_PAGADO: "Este código todavía no está activo. Si acabas de pagar, espera unos minutos.",
  ANULADO: "Este código ya no es válido.",
  CADUCADO: "Este código ha caducado.",
  // Estos cinco NO son culpa del código: es bueno, lo que no encaja es el día,
  // la hora o la zona elegidos. Decirle "tu código no es válido" le hacía
  // pensar que había comprado mal, cuando solo tiene que cambiar la fecha.
  DIA_NO_PERMITIDO: "Tu experiencia no se puede usar ese día de la semana. Elige otra fecha.",
  FECHA_EXCLUIDA: "Tu experiencia no se puede usar en esa fecha. Elige otro día.",
  TURNO_NO_PERMITIDO: "Tu experiencia no incluye ese turno. Prueba con el otro.",
  HORA_NO_PERMITIDA: "Tu experiencia no se puede usar a esa hora. Elige otra.",
  ZONA_NO_PERMITIDA: "Tu experiencia no incluye esa zona. Elige otra.",
};

/** "HH:MM" → minutos desde medianoche. */
function aMinutos(hora: string): number | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(hora.trim());
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h > 23 || min > 59) return null;
  return h * 60 + min;
}

/**
 * Turno de una hora, con el mismo criterio que el resto del módulo:
 * de 06:00 a 18:00 es comida; el resto, cena.
 */
export function turnoDeHoraTicket(hora: string): TicketTurno {
  const min = aMinutos(hora);
  if (min == null) return "CENA";
  return min >= 6 * 60 && min < 18 * 60 ? "COMIDA" : "CENA";
}

/** Día de la semana de una fecha "YYYY-MM-DD", sin líos de zona horaria. */
export function diaSemanaDeFecha(fecha: string): DiaSemanaKey | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(fecha);
  if (!m) return null;
  // Mediodía UTC: evita que el cambio de hora mueva la fecha un día.
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 12));
  return DIA_SEMANA_KEY[d.getUTCDay()] ?? null;
}

/**
 * ¿Está la hora dentro de la franja permitida?
 *
 * La franja puede cruzar la medianoche (una cena de 20:00 a 02:00), así que no
 * basta con comparar "desde <= hora <= hasta".
 */
function horaEnFranja(hora: string, desde: string | null, hasta: string | null): boolean {
  if (!desde && !hasta) return true;
  const h = aMinutos(hora);
  if (h == null) return false;
  const d = desde ? aMinutos(desde) : null;
  const f = hasta ? aMinutos(hasta) : null;
  if (d != null && f != null) {
    return d <= f ? h >= d && h <= f : h >= d || h <= f;
  }
  if (d != null) return h >= d;
  if (f != null) return h <= f;
  return true;
}

export interface ContextoCanje {
  fecha: string | null;
  hora: string | null;
  grupoZonaId: string | null;
}

export type ResultadoCanje =
  | { ok: true }
  | { ok: false; motivo: TicketMotivoInvalidez };

/**
 * Comprueba si la compra puede canjearse. Se valida en dos pasos:
 *
 *   1. El código en sí (existe, está pagado, no se ha usado, no ha caducado).
 *   2. Las condiciones del producto contra lo que el cliente está eligiendo.
 *
 * El contexto se valida solo en lo que ya se ha elegido: mientras el cliente no
 * haya escogido hora, no tiene sentido rechazarle por la hora.
 */
export function validarCanjeTicket(
  compra: TicketCompraEstado,
  cond: TicketCondiciones,
  ctx: ContextoCanje,
): ResultadoCanje {
  // ── 1. El código ──────────────────────────────────────────────────
  if (compra.estado === "canjeada") return { ok: false, motivo: "YA_UTILIZADO" };
  if (compra.estado === "cancelada" || compra.estado === "fallida") {
    return { ok: false, motivo: "ANULADO" };
  }
  if (compra.estado === "caducada") return { ok: false, motivo: "CADUCADO" };
  if (compra.estado !== "pagada") return { ok: false, motivo: "NO_PAGADO" };

  // La caducidad se mide contra HOY, no contra la fecha de la reserva: lo que
  // caduca es el derecho a reservar, no la visita.
  if (compra.canjeHasta) {
    const hoy = new Date().toISOString().slice(0, 10);
    if (compra.canjeHasta < hoy) return { ok: false, motivo: "CADUCADO" };
  }

  // ── 2. Las condiciones del producto ───────────────────────────────
  if (ctx.fecha) {
    if (cond.diasExcluidos.length > 0 && cond.diasExcluidos.includes(ctx.fecha)) {
      return { ok: false, motivo: "FECHA_EXCLUIDA" };
    }
    if (cond.diasSemana.length > 0) {
      const dia = diaSemanaDeFecha(ctx.fecha);
      if (!dia || !cond.diasSemana.includes(dia)) {
        return { ok: false, motivo: "DIA_NO_PERMITIDO" };
      }
    }
  }

  if (ctx.hora) {
    if (cond.turnos.length > 0 && !cond.turnos.includes(turnoDeHoraTicket(ctx.hora))) {
      return { ok: false, motivo: "TURNO_NO_PERMITIDO" };
    }
    if (cond.horasExcluidas.length > 0 && cond.horasExcluidas.includes(ctx.hora)) {
      return { ok: false, motivo: "HORA_NO_PERMITIDA" };
    }
    if (!horaEnFranja(ctx.hora, cond.horaDesde, cond.horaHasta)) {
      return { ok: false, motivo: "HORA_NO_PERMITIDA" };
    }
  }

  if (ctx.grupoZonaId && cond.grupoZonaIds.length > 0) {
    if (!cond.grupoZonaIds.includes(ctx.grupoZonaId)) {
      return { ok: false, motivo: "ZONA_NO_PERMITIDA" };
    }
  }

  return { ok: true };
}

/**
 * ¿Se puede reservar ese día con este código? Sirve para apagar los días
 * prohibidos en el calendario ANTES de que el cliente los pulse: es mejor no
 * poder elegir un día que elegirlo y que te lo rechacen después.
 */
export function fechaPermitidaPorTicket(cond: TicketCondiciones, fecha: string): boolean {
  if (cond.diasExcluidos.includes(fecha)) return false;
  if (cond.diasSemana.length === 0) return true;
  const dia = diaSemanaDeFecha(fecha);
  return !!dia && cond.diasSemana.includes(dia);
}

/** ¿Se puede reservar a esa hora? Se usa para ocultar las horas no válidas. */
export function horaPermitidaPorTicket(cond: TicketCondiciones, hora: string): boolean {
  if (cond.turnos.length > 0 && !cond.turnos.includes(turnoDeHoraTicket(hora))) return false;
  if (cond.horasExcluidas.includes(hora)) return false;
  return horaEnFranja(hora, cond.horaDesde, cond.horaHasta);
}

/** ¿Vale esa zona? Se usa para ocultar las zonas no permitidas. */
export function zonaPermitidaPorTicket(cond: TicketCondiciones, grupoZonaId: string): boolean {
  return cond.grupoZonaIds.length === 0 || cond.grupoZonaIds.includes(grupoZonaId);
}

/** Texto corto que resume las condiciones, para enseñárselas al cliente. */
export function describirCondiciones(
  cond: TicketCondiciones,
  nombresZonas?: Map<string, string>,
): string[] {
  const LABEL: Record<DiaSemanaKey, string> = {
    lun: "lunes", mar: "martes", mie: "miércoles", jue: "jueves",
    vie: "viernes", sab: "sábados", dom: "domingos",
  };
  const out: string[] = [];

  if (cond.diasSemana.length > 0) {
    const dias = cond.diasSemana.map((d) => LABEL[d]).join(", ");
    out.push(`Solo ${dias}`);
  }
  if (cond.turnos.length === 1) {
    out.push(cond.turnos[0] === "COMIDA" ? "Solo comidas" : "Solo cenas");
  }
  if (cond.horaDesde && cond.horaHasta) {
    out.push(`De ${cond.horaDesde} a ${cond.horaHasta}`);
  } else if (cond.horaDesde) {
    out.push(`A partir de las ${cond.horaDesde}`);
  } else if (cond.horaHasta) {
    out.push(`Hasta las ${cond.horaHasta}`);
  }
  if (cond.grupoZonaIds.length > 0 && nombresZonas) {
    const nombres = cond.grupoZonaIds
      .map((id) => nombresZonas.get(id))
      .filter((n): n is string => !!n);
    if (nombres.length > 0) out.push(`Solo en ${nombres.join(", ")}`);
  }
  return out;
}
