/**
 * PRP-052 — Cupones de sala
 *
 * Cupones puramente informativos que se adjuntan a una reserva como etiqueta.
 * NO tocan `tipo_categoria`, `importe_pagado` ni política de cancelación.
 */
import type { DiaSemanaKey } from "@/features/sala/data/reservas";

export type CuponBeneficioTipo = "porcentaje" | "importe" | "producto_gratis";
export type CuponUnidadStock = "reservas" | "personas";
/** Turnos almacenados en BD del cupón (en mayúsculas, alineado con TurnoReserva). */
export type CuponTurno = "COMIDA" | "CENA";

export const CUPON_BENEFICIO_LABELS: Record<CuponBeneficioTipo, string> = {
  porcentaje: "Porcentaje",
  importe: "Importe en €",
  producto_gratis: "Producto gratis",
};

export const CUPON_UNIDAD_STOCK_LABELS: Record<CuponUnidadStock, string> = {
  reservas: "Por reservas",
  personas: "Por personas",
};

export interface Cupon {
  id: string;
  empresaId: string;
  codigo: string;
  tituloInterno: string;
  tituloCliente: string | null;
  beneficioTipo: CuponBeneficioTipo;
  beneficioValor: number | null;
  productoDescripcion: string | null;
  unidadStock: CuponUnidadStock;
  stockTotal: number;
  stockConsumido: number;
  fechaCaducidad: string | null;
  /** Comensales mínimos de la reserva para poder usarlo. null = sin mínimo. */
  minimoPersonas: number | null;
  /** Cliente dueño del cupón, cuando es personal (cumpleaños). */
  clienteId: string | null;
  /** Qué lo generó: 'CUMPLEANOS', o null si lo creó una persona. */
  origen: string | null;
  diasSemana: DiaSemanaKey[];
  turnos: CuponTurno[];
  activo: boolean;
  createdAt: string;
  updatedAt: string;
}

/** Datos del cupón que se pueden enviar al cliente final sin filtrar stock. */
export interface CuponPublico {
  id: string;
  tituloClienteEfectivo: string;
  beneficioTipo: CuponBeneficioTipo;
  beneficioValor: number | null;
  productoDescripcion: string | null;
  fechaCaducidad: string | null;
  minimoPersonas: number | null;
}

export type CuponMotivoInvalidez =
  | "NO_EXISTE"
  | "INACTIVO"
  | "CADUCADO"
  | "AGOTADO"
  | "DIA_NO_PERMITIDO"
  | "TURNO_NO_PERMITIDO"
  | "MINIMO_PERSONAS";

export const CUPON_MOTIVO_LABELS: Record<CuponMotivoInvalidez, string> = {
  NO_EXISTE: "No existe ningún cupón con ese código",
  INACTIVO: "Cupón inactivo",
  CADUCADO: "Cupón caducado",
  AGOTADO: "Cupón agotado",
  DIA_NO_PERMITIDO: "Cupón no válido este día de la semana",
  TURNO_NO_PERMITIDO: "Cupón no válido para este turno",
  MINIMO_PERSONAS: "Sois menos de los que pide el cupón",
};

export interface CuponValidacionResult {
  ok: boolean;
  motivo: CuponMotivoInvalidez | null;
  cupon: CuponPublico | null;
}

export interface CuponInput {
  tituloInterno: string;
  tituloCliente?: string | null;
  beneficioTipo: CuponBeneficioTipo;
  beneficioValor?: number | null;
  productoDescripcion?: string | null;
  unidadStock: CuponUnidadStock;
  stockTotal: number;
  fechaCaducidad?: string | null;
  minimoPersonas?: number | null;
  diasSemana?: DiaSemanaKey[];
  turnos?: CuponTurno[];
  activo?: boolean;
}

export const CUPON_TURNOS_TODOS: CuponTurno[] = ["COMIDA", "CENA"];
export const CUPON_TURNO_LABELS: Record<CuponTurno, string> = {
  COMIDA: "Comida",
  CENA: "Cena",
};

/** Formato esperado del código (6 chars alfanuméricos mayúsculas). */
export const CUPON_CODIGO_REGEX = /^[A-Z0-9]{6}$/;

/** Texto humano para el chip del beneficio (UI). */
export function describirBeneficio(c: Pick<Cupon, "beneficioTipo" | "beneficioValor" | "productoDescripcion">): string {
  switch (c.beneficioTipo) {
    case "porcentaje":
      return `${c.beneficioValor ?? 0}% de descuento`;
    case "importe":
      return `${c.beneficioValor ?? 0} € de descuento`;
    case "producto_gratis":
      return c.productoDescripcion ?? "Producto gratis";
  }
}

/**
 * El mínimo dicho en cristiano: "para 6 personas o más".
 *
 * Se compone aquí y no en cada pantalla porque el mismo texto aparece en el
 * listado de cupones, en el formulario de reserva y en el correo, y tres
 * redacciones distintas del mismo requisito confunden a quien lo lee.
 */
export function describirMinimo(minimoPersonas: number | null): string {
  if (!minimoPersonas || minimoPersonas < 2) return "";
  return `Para ${minimoPersonas} personas o más`;
}
