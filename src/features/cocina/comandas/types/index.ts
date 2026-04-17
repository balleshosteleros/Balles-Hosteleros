/**
 * Tipos del submódulo Cocina · Comandas (KDS).
 * Espejo en camelCase de las columnas añadidas a pos_ticket_lineas
 * + tabla cocina_alarmas_config (migración 037_cocina_comandas.sql).
 *
 * Se compone sobre los tipos base del POS: TicketLinea, Ticket, LineaDestino.
 */

import type { LineaDestino, TicketLinea, Ticket } from "@/features/sala/pos/types";

// ─── Estado del panel de cocina por línea ────────────────────
export type LineaEstadoCocina =
  | "PENDIENTE"
  | "PREPARANDO"
  | "LISTO"
  | "SERVIDO"
  | "CANCELADA";

// Columnas del kanban que se pintan (CANCELADA no se pinta).
export type ColumnaKDS = "PENDIENTE" | "PREPARANDO" | "LISTO" | "SERVIDO";

// ─── Línea enriquecida con campos de cocina ──────────────────
export interface TicketLineaConCocina extends TicketLinea {
  estadoCocina: LineaEstadoCocina;
  preparandoAt: string | null;
  listoAt: string | null;
  servidoAt: string | null;
  partidaId: string | null;
  prioridad: number;
}

// ─── Agregado por ticket/mesa que consume el board ───────────
export interface ComandaAgrupada {
  ticketId: string;
  numero: string;
  mesaId: string | null;
  mesaNombre: string | null; // "Mesa 5" / "Barra"
  comensales: number;
  empleadoId: string | null;
  enviadoAt: string; // hora de envío del ticket
  lineas: TicketLineaConCocina[];
  // Derivados útiles para la card:
  total: number; // nº de líneas
  listos: number; // nº líneas en LISTO
}

// ─── Umbrales de alarma por empresa ──────────────────────────
export interface UmbralesAlarma {
  empresaId: string;
  umbralAmbarMin: number;
  umbralRojoMin: number;
  umbralParpadeoMin: number;
  sonidoActivo: boolean;
  updatedAt: string;
}

// Defaults si la empresa no tiene fila en cocina_alarmas_config.
export const UMBRALES_DEFAULT: Omit<UmbralesAlarma, "empresaId" | "updatedAt"> = {
  umbralAmbarMin: 8,
  umbralRojoMin: 15,
  umbralParpadeoMin: 20,
  sonidoActivo: true,
};

// ─── Nivel de alerta derivado del tiempo transcurrido ────────
export type NivelAlerta = "OK" | "AMBAR" | "ROJO" | "PARPADEO";

// ─── Filtros del board ───────────────────────────────────────
export type FiltroDestino = "TODOS" | LineaDestino;

export interface FiltrosComandas {
  destino: FiltroDestino;
  partidaId: string | null; // null = todas las partidas
}

// ─── Utilidad de agrupación (tipo auxiliar para services) ────
export type TicketMinimo = Pick<
  Ticket,
  "id" | "numero" | "mesaId" | "comensales" | "empleadoId" | "enviadoAt"
>;
