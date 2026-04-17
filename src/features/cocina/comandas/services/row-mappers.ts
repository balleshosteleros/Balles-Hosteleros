import type { LineaEstadoCocina, TicketLineaConCocina } from "../types";

export interface LineaCocinaRow {
  id: string;
  ticket_id: string;
  producto_id: string | null;
  nombre: string;
  cantidad: number | string;
  precio_unitario: number | string;
  iva_pct: number | string;
  descuento_pct: number | string;
  destino: "COCINA" | "BARRA" | "NINGUNO";
  enviada_at: string | null;
  nota_cocina: string;
  comensal_idx: number | null;
  created_at: string;
  estado_cocina: LineaEstadoCocina;
  preparando_at: string | null;
  listo_at: string | null;
  servido_at: string | null;
  partida_id: string | null;
  prioridad: number;
}

export function rowToLineaCocina(r: LineaCocinaRow): TicketLineaConCocina {
  return {
    id: r.id,
    ticketId: r.ticket_id,
    productoId: r.producto_id,
    nombre: r.nombre,
    cantidad: Number(r.cantidad ?? 0),
    precioUnitario: Number(r.precio_unitario ?? 0),
    ivaPct: Number(r.iva_pct ?? 10),
    descuentoPct: Number(r.descuento_pct ?? 0),
    destino: r.destino,
    enviadaAt: r.enviada_at,
    notaCocina: r.nota_cocina ?? "",
    comensalIdx: r.comensal_idx,
    createdAt: r.created_at,
    estadoCocina: r.estado_cocina,
    preparandoAt: r.preparando_at,
    listoAt: r.listo_at,
    servidoAt: r.servido_at,
    partidaId: r.partida_id,
    prioridad: r.prioridad ?? 0,
  };
}
