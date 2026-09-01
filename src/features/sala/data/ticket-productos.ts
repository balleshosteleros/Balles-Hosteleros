import type { DiaSemanaKey } from "@/features/sala/data/reservas";

export type TicketModoPrecio = "por_persona" | "por_reserva";
export type TicketStockModo = "ilimitado" | "limitado";
/** Cómo se cobra el producto. */
export type TicketCobroModo = "revolut" | "gratis";
export type TicketTurno = "COMIDA" | "CENA";

export interface ReservaTicketProducto {
  id: string;
  empresaId: string;
  numeroSecuencial: number;
  nombre: string;
  descripcion: string | null;
  precio: number;
  iva: number;
  modoPrecio: TicketModoPrecio;
  comentarios: string | null;
  stockModo: TicketStockModo;
  stockTotal: number | null;
  stockConsumido: number;
  ocultarAlAgotar: boolean;
  activo: boolean;
  orden: number;
  cobroModo: TicketCobroModo;
  /** Si se puede comprar desde la tienda pública. */
  ventaPublica: boolean;
  /** Días de validez del código desde la compra. null = no caduca. */
  validezDias: number | null;
  /** Fecha límite fija para canjear. null = sin fecha límite. */
  canjeHasta: string | null;
  // Condiciones de canje. Vacío = sin restricción en ese eje.
  diasSemana: DiaSemanaKey[];
  diasExcluidos: string[];
  turnos: TicketTurno[];
  horaDesde: string | null;
  horaHasta: string | null;
  horasExcluidas: string[];
  grupoZonaIds: string[];
  createdAt: string;
  updatedAt: string;
}

export interface ReservaTicketProductoInput {
  nombre: string;
  descripcion?: string | null;
  precio: number;
  iva: number;
  modoPrecio: TicketModoPrecio;
  comentarios?: string | null;
  stockModo: TicketStockModo;
  stockTotal?: number | null;
  ocultarAlAgotar?: boolean;
  activo?: boolean;
  orden?: number;
  cobroModo?: TicketCobroModo;
  ventaPublica?: boolean;
  validezDias?: number | null;
  canjeHasta?: string | null;
  diasSemana?: DiaSemanaKey[];
  diasExcluidos?: string[];
  turnos?: TicketTurno[];
  horaDesde?: string | null;
  horaHasta?: string | null;
  horasExcluidas?: string[];
  grupoZonaIds?: string[];
}

export const TICKET_MODO_PRECIO_LABELS: Record<TicketModoPrecio, string> = {
  por_persona: "Por persona",
  por_reserva: "Por reserva",
};

export const TICKET_COBRO_MODO_LABELS: Record<TicketCobroModo, string> = {
  revolut: "Cobrar con Revolut",
  gratis: "No cobrar",
};

export const TICKET_TURNO_LABELS: Record<TicketTurno, string> = {
  COMIDA: "Comidas",
  CENA: "Cenas",
};

export const TICKET_STOCK_MODO_LABELS: Record<TicketStockModo, string> = {
  ilimitado: "Sin stock (ilimitado)",
  limitado: "Stock limitado",
};

export function stockDisponible(p: Pick<ReservaTicketProducto, "stockModo" | "stockTotal" | "stockConsumido">): number | null {
  if (p.stockModo === "ilimitado" || p.stockTotal == null) return null;
  return Math.max(0, p.stockTotal - p.stockConsumido);
}

export function estaAgotado(p: Pick<ReservaTicketProducto, "stockModo" | "stockTotal" | "stockConsumido">): boolean {
  if (p.stockModo === "ilimitado" || p.stockTotal == null) return false;
  return p.stockConsumido >= p.stockTotal;
}

export function validarTicketInput(input: ReservaTicketProductoInput): { ok: true } | { ok: false; error: string } {
  if (!input.nombre.trim()) return { ok: false, error: "El nombre es obligatorio" };
  if (input.precio == null || Number.isNaN(input.precio) || input.precio < 0) {
    return { ok: false, error: "El precio debe ser un número mayor o igual a 0" };
  }
  if (input.iva == null || input.iva < 0 || input.iva > 100) {
    return { ok: false, error: "El IVA debe estar entre 0 y 100" };
  }
  // Una franja horaria a medias no se puede aplicar: o las dos horas, o ninguna.
  const soloUnaHora = Boolean(input.horaDesde) !== Boolean(input.horaHasta);
  if (soloUnaHora) {
    return { ok: false, error: "Indica la hora de inicio y la de fin, o deja las dos vacías" };
  }
  if (input.validezDias != null && (input.validezDias < 1 || !Number.isInteger(input.validezDias))) {
    return { ok: false, error: "Los días de validez deben ser un número entero mayor que 0" };
  }
  if (input.stockModo === "limitado") {
    if (input.stockTotal == null || input.stockTotal < 0 || !Number.isInteger(input.stockTotal)) {
      return { ok: false, error: "El stock total debe ser un entero mayor o igual a 0" };
    }
  }
  return { ok: true };
}
