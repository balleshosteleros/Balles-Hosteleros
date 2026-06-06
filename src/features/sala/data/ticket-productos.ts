export type TicketModoPrecio = "por_persona" | "por_reserva";
export type TicketStockModo = "ilimitado" | "limitado";

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
}

export const TICKET_MODO_PRECIO_LABELS: Record<TicketModoPrecio, string> = {
  por_persona: "Por persona",
  por_reserva: "Por reserva",
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
  if (input.stockModo === "limitado") {
    if (input.stockTotal == null || input.stockTotal < 0 || !Number.isInteger(input.stockTotal)) {
      return { ok: false, error: "El stock total debe ser un entero mayor o igual a 0" };
    }
  }
  return { ok: true };
}
