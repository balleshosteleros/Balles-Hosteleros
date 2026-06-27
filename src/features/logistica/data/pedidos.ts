import { DIAS_REPARTO } from "./proveedores";

// ─── Types ────────────────────────────────────────────────

export interface LineaAnalisis {
  productoProveedor: string;
  cantidadProveedor: number;
  precioProveedor: number;
  unidadProveedor: string;
  productoInterno: string | null;
  cantidadInterna: number;
  precioInterno: number;
  tipo: "coincide" | "cantidad_diferente" | "precio_diferente" | "cantidad_y_precio" | "extra" | "faltante";
}

export interface AnalisisAlbaran {
  datosAlbaran: {
    proveedor: string;
    numero: string;
    fecha: string;
  };
  lineas: LineaAnalisis[];
  resumen: {
    totalLineas: number;
    coincidencias: number;
    diferencias: number;
    extras: number;
    faltantes: number;
    hayAlerta: boolean;
  };
}

export interface DocumentoAdjunto {
  id: string;
  fileName: string;
  fileUrl: string;
  mimeType: string;
  uploadedAt: string;
  uploadedBy: string;
  analisis: AnalisisAlbaran | null;
  hayAlerta: boolean;
}

// Estados canónicos simplificados (vocabulario compartido pedido/albarán/factura).
// Patrón: editable → Confirmado (🔒, tiene un hijo en la cadena). Sin "Anulado": si algo
// está mal se borra y el documento anterior retrocede un puesto.
//   Pedido:  Pendiente → Enviado   → Confirmado (tiene albarán)
//   Albarán: Pendiente → Entregado → Confirmado (tiene factura)
export type EstadoPedido = "Pendiente" | "Enviado" | "Confirmado";
export type EstadoAlbaran = "Pendiente" | "Entregado" | "Confirmado";

export const ESTADOS_PEDIDO: EstadoPedido[] = ["Pendiente", "Enviado", "Confirmado"];
export const ESTADOS_ALBARAN: EstadoAlbaran[] = ["Pendiente", "Entregado", "Confirmado"];

export interface LineaPedido {
  id: string;
  productoId: string;
  producto: string;
  cantidad: number;
  unidad: string;
  servida: number;
  precioUC: number;
  impuesto: number; // %
  dtoPct: number;
  dtoEur: number;
  total: number;
}

export interface Pedido {
  id: string;
  numeroSecuencial?: number;
  numero: string;
  empresaId: string;
  empresa: string;
  proveedor: string;
  almacen: string;
  fecha: string;
  fechaEntrega: string;
  estado: EstadoPedido;
  lineas: LineaPedido[];
  dtoPct: number;
  dtoEur: number;
  notas: string;
  albaranId: string | null;
  creador: string;
  ultimaActualizacion: string;
  enviadoAt: string | null;
  enviadoEmail: string | null;
  /** Email real del proveedor (resuelto en getPedido: email_pedidos → email_principal). */
  proveedorEmail?: string | null;
  /** Id del proveedor (para resolver su reparto vigente). */
  proveedorId?: string | null;
  /** Inicio del rango de hora de reparto ('HH:MM'). Se auto-rellena desde la franja del proveedor. */
  horaEntrega?: string | null;
  /** Fin del rango de hora de reparto ('HH:MM'). */
  horaEntregaHasta?: string | null;
  /** Reparto vigente del proveedor (transitorio, para pintar el aviso de fuera-de-estipulado). */
  proveedorReparto?: RepartoProveedor | null;
}

export interface LineaAlbaran {
  id: string;
  productoId: string;
  producto: string;
  cantidad: number;
  unidad: string;
  precioUC: number;
  impuesto: number;
  dtoPct: number;
  dtoEur: number;
  total: number;
  docPedido: string;
}

export interface Albaran {
  id: string;
  numeroSecuencial?: number;
  numero: string;
  /** Nº de albarán que figura en el documento del proveedor. Distinto del `numero` interno. */
  numeroProveedor?: string | null;
  empresaId: string;
  empresa: string;
  proveedor: string;
  documento: string;
  factura: string;
  almacen: string;
  fecha: string;
  estado: EstadoAlbaran;
  lineas: LineaAlbaran[];
  dtoPct: number;
  dtoEur: number;
  notas: string;
  pedidoId: string;
  creador: string;
  ultimaActualizacion: string;
}

// ─── Helpers ──────────────────────────────────────────────

export function calcularTotalesLineas(lineas: { precioUC: number; cantidad: number; impuesto: number; dtoPct: number; dtoEur: number }[]) {
  let base = 0;
  let cuota = 0;
  lineas.forEach((l) => {
    const bruto = l.precioUC * l.cantidad;
    const descuento = bruto * (l.dtoPct / 100) + l.dtoEur;
    const lineaBase = bruto - descuento;
    base += lineaBase;
    cuota += lineaBase * (l.impuesto / 100);
  });
  return { base: Math.round(base * 100) / 100, cuota: Math.round(cuota * 100) / 100, total: Math.round((base + cuota) * 100) / 100 };
}

export function calcLineaTotal(l: { precioUC: number; cantidad: number; dtoPct: number; dtoEur: number }): number {
  const bruto = l.precioUC * l.cantidad;
  return Math.round((bruto - bruto * (l.dtoPct / 100) - l.dtoEur) * 100) / 100;
}

// ─── Proveedores / Almacenes ──────────────────────────────
// Se poblarán con datos reales cuando se migren desde la antigua plataforma.

export const PROVEEDORES: string[] = [];

export const ALMACENES: Record<string, string[]> = {};

// ─── Accessors ────────────────────────────────────────────
// Datos reales vendrán de Supabase en próxima iteración.
// Vacío hasta que se migren los pedidos y albaranes reales.

export function getPedidosPorEmpresa(_empresaId: string): Pedido[] {
  return [];
}

export function getAlbaranesPorEmpresa(_empresaId: string): Albaran[] {
  return [];
}

// ─── Reparto (día y hora de entrega vs. lo estipulado por el proveedor) ──────────

/** Reparto vigente de un proveedor: días de reparto + horario (rango) por día + día principal. */
export interface RepartoProveedor {
  dias: string[];                       // días con reparto, p.ej. ["Lunes","Miércoles","Viernes"]
  horario: Record<string, string>;      // díaNombre → rango ("09:00-15:00")
  principal?: string | null;            // día principal negociado: default de los pedidos
}

/** Día principal efectivo del reparto: el marcado como principal si reparte ese día; si no, el primero. */
export function principalDeReparto(reparto: RepartoProveedor | null | undefined): string | null {
  const dias = reparto?.dias ?? [];
  if (dias.length === 0) return null;
  return reparto?.principal && dias.includes(reparto.principal) ? reparto.principal : dias[0];
}

/** Resultado de comparar el día/hora de entrega de un pedido con el reparto del proveedor. */
export interface EvalReparto {
  diaSemana: string | null;     // día de la semana de la fecha de entrega
  franjaProveedor: string | null; // franja que el proveedor reparte ese día (si la hay)
  hayReparto: boolean;          // el proveedor tiene días de reparto configurados
  fueraDia: boolean;            // el día elegido NO está entre los de reparto
  fueraHora: boolean;           // la hora elegida cae fuera de la franja de ese día
}

/** Nombre del día de la semana (es) para una fecha ISO 'YYYY-MM-DD'. null si vacía/ inválida. */
export function diaSemanaDeFechaISO(fechaISO: string | null | undefined): string | null {
  if (!fechaISO) return null;
  const d = new Date(`${fechaISO}T00:00:00`);
  if (isNaN(d.getTime())) return null;
  // getDay(): 0=Domingo..6=Sábado → DIAS_REPARTO empieza en Lunes.
  return DIAS_REPARTO[(d.getDay() + 6) % 7] ?? null;
}

/** Extrae el rango 'HH:MM-HH:MM' de una franja ("Mañana (09:00-15:00)" o "09:00-13:00"). null si no se puede. */
export function rangoDeFranja(franja: string | null | undefined): { inicio: string; fin: string } | null {
  if (!franja) return null;
  const m = franja.match(/(\d{1,2}:\d{2})\s*[-–]\s*(\d{1,2}:\d{2})/);
  if (!m) return null;
  return { inicio: m[1], fin: m[2] };
}

/** Describe el día/hora PRINCIPAL del proveedor: "Viernes 09:00-15:00". */
export function describirReparto(reparto: RepartoProveedor | null | undefined): string {
  const principal = principalDeReparto(reparto);
  if (!principal) return "—";
  const r = rangoDeFranja(reparto?.horario?.[principal]);
  const horas = r ? ` ${r.inicio}-${r.fin}` : (reparto?.horario?.[principal] ? ` ${reparto.horario[principal]}` : "");
  return `${principal}${horas}`;
}

/** Formatea el rango de hora de reparto de un pedido: "09:00 - 15:00" (o solo una si falta la otra). */
export function formatoHoraReparto(desde: string | null | undefined, hasta: string | null | undefined): string {
  if (desde && hasta) return `${desde} - ${hasta}`;
  return desde || hasta || "";
}

/**
 * Compara el día y el RANGO de hora de entrega de un pedido contra el día/hora PRINCIPAL del
 * proveedor (el default). Cualquier desviación respecto al principal marca el aviso:
 * - fueraDia: el día de entrega no es el día principal.
 * - fueraHora: el rango de hora difiere del horario configurado para el día principal.
 */
export function evaluarReparto(
  fechaEntrega: string | null | undefined,
  horaDesde: string | null | undefined,
  horaHasta: string | null | undefined,
  reparto: RepartoProveedor | null | undefined,
): EvalReparto {
  const dias = reparto?.dias ?? [];
  const hayReparto = dias.length > 0;
  const principal = principalDeReparto(reparto);
  const franjaProveedor = principal ? (reparto?.horario?.[principal] ?? null) : null;
  const diaSemana = diaSemanaDeFechaISO(fechaEntrega);

  const fueraDia = !!(principal && diaSemana && diaSemana !== principal);

  let fueraHora = false;
  if (!fueraDia && (horaDesde || horaHasta)) {
    const rango = rangoDeFranja(franjaProveedor);
    if (rango) {
      fueraHora = (horaDesde || "") !== rango.inicio || (horaHasta || "") !== rango.fin;
    }
  }
  return { diaSemana, franjaProveedor, hayReparto, fueraDia, fueraHora };
}

/**
 * Sugiere día (fecha ISO) y hora de entrega por defecto a partir del reparto del proveedor:
 * el próximo día (desde `desdeISO`, sin contar hoy) cuyo día de la semana esté en el reparto,
 * y la hora de inicio de la franja de ese día. Devuelve null si el proveedor no tiene reparto.
 */
export function sugerirEntregaDesdeReparto(
  reparto: RepartoProveedor | null | undefined,
  desdeISO: string,
): { fecha: string; horaDesde: string; horaHasta: string } | null {
  const principal = principalDeReparto(reparto);
  if (!principal) return null;
  const base = new Date(`${desdeISO}T00:00:00`);
  if (isNaN(base.getTime())) return null;
  const rango = rangoDeFranja(reparto?.horario?.[principal]);
  for (let i = 1; i <= 14; i++) {
    const cand = new Date(base);
    cand.setDate(base.getDate() + i);
    const nombre = DIAS_REPARTO[(cand.getDay() + 6) % 7];
    if (nombre === principal) {
      return { fecha: cand.toISOString().slice(0, 10), horaDesde: rango?.inicio ?? "", horaHasta: rango?.fin ?? "" };
    }
  }
  return null;
}
