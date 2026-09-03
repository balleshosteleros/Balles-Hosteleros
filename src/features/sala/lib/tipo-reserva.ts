/**
 * Identificación del TIPO DE RESERVA: fuente única de verdad.
 *
 * Una reserva es exactamente UNA de estas cuatro cosas, nunca dos:
 *
 *   · gratis      → sin compromiso económico.
 *   · cancelacion → se guarda la tarjeta y se cobra solo si no aparece o
 *                   cancela fuera de plazo. No aparta dinero.
 *   · garantia    → se retiene el importe por adelantado. El dinero ya está
 *                   apartado.
 *   · ticket      → el cliente pagó por adelantado un producto (cena evento,
 *                   brunch…). Ya está cobrado.
 *
 * ── Por qué existe este archivo ────────────────────────────────────────────
 *
 * Antes el tipo se deducía en cada sitio por su cuenta, cruzando banderas
 * sueltas (`tiene_cancelacion`, `tiene_garantia`, `es_ticket`) más una etiqueta
 * manual `tipo_categoria` que alguien elegía en Sala. Eso permitía estados
 * imposibles —una reserva ya pagada a la que además se le pedía tarjeta, o dos
 * correos con condiciones distintas para la misma mesa— y hacía que los correos
 * de política no llegaran, porque preguntaban por la etiqueta y la etiqueta
 * casi nunca estaba puesta.
 *
 * Aquí se decide una vez y todos preguntan lo mismo: correos, listado, chips y
 * la pantalla pública de cancelación.
 *
 * El orden de prioridad resuelve cualquier solape de condiciones:
 *
 *   TICKET → GARANTÍA → CANCELACIÓN → GRATIS
 *
 * El ticket manda porque ya está cobrado: a quien ha pagado no se le pide nada
 * más. La garantía va por delante de la cancelación porque es la más estricta
 * y es lo que el cliente acaba pagando de verdad, así el correo nunca
 * contradice al cobro.
 */

export type TipoReserva = "gratis" | "cancelacion" | "garantia" | "ticket";

export const TIPO_RESERVA_LABELS: Record<TipoReserva, string> = {
  gratis: "Gratis",
  cancelacion: "Política de cancelación",
  garantia: "Política de garantía",
  ticket: "Ticket",
};

/** Los campos congelados en la reserva al crearla. */
export interface ReservaTipoInput {
  esTicket?: boolean | null;
  tieneGarantia?: boolean | null;
  garantiaImporte?: number | string | null;
  tieneCancelacion?: boolean | null;
  cancelacionImporte?: number | string | null;
}

function num(v: number | string | null | undefined): number {
  const n = typeof v === "string" ? Number(v) : (v ?? 0);
  return Number.isFinite(n) ? n : 0;
}

/**
 * Tipo de una reserva, a partir de lo que quedó congelado al crearla.
 *
 * Una política sin importe positivo no es una política: se ignora, porque un
 * cargo de 0 € no se puede comunicar ni cobrar.
 */
export function tipoDeReserva(r: ReservaTipoInput): TipoReserva {
  if (r.esTicket === true) return "ticket";
  if (r.tieneGarantia === true && num(r.garantiaImporte) > 0) return "garantia";
  if (r.tieneCancelacion === true && num(r.cancelacionImporte) > 0) return "cancelacion";
  return "gratis";
}

/** Importe comprometido de la reserva. 0 en las gratis. */
export function importeDeReserva(r: ReservaTipoInput): number {
  switch (tipoDeReserva(r)) {
    case "garantia":
      return num(r.garantiaImporte);
    case "cancelacion":
      return num(r.cancelacionImporte);
    default:
      return 0;
  }
}

/** true si la reserva lleva un compromiso económico del que hay que informar. */
export function tieneCompromisoEconomico(r: ReservaTipoInput): boolean {
  const t = tipoDeReserva(r);
  return t === "cancelacion" || t === "garantia";
}
