"use client";

/**
 * Estado del ticket POS en curso.
 * Líneas y ticket se persisten en BD al "Enviar a cocina" (PRP-025 Fase 5).
 * El estado local se sincroniza con IDs reales del servidor tras cada envío.
 */

import * as React from "react";
import type { TicketLinea, ProductoPOS, TotalesTicket } from "../types";
import { calcularTotales, type DescuentoCabecera } from "../services/calculo-ticket";

// ─── STATE ────────────────────────────────────────────────────

interface TicketState {
  lineas: TicketLinea[];
  mesaId: string | null;
  comensales: number;
  descuento: DescuentoCabecera | null;
  seleccionLineaId: string | null;
  /** ID del ticket persistido en BD (null hasta el primer envío a cocina). */
  ticketIdServer: string | null;
}

type Action =
  | { type: "addProducto"; producto: ProductoPOS; cantidad?: number }
  | { type: "setCantidad"; lineaId: string; cantidad: number }
  | { type: "setPrecio"; lineaId: string; precio: number }
  | { type: "removeLinea"; lineaId: string }
  | { type: "setNota"; lineaId: string; nota: string }
  | { type: "selectLinea"; lineaId: string | null }
  | { type: "setMesa"; mesaId: string | null; comensales?: number }
  | { type: "setDescuento"; descuento: DescuentoCabecera | null }
  | { type: "marcarEnviadas" }
  | {
      type: "syncConServer";
      ticketIdServer: string;
      enviadaAt: string;
      lineaIdMap: Record<string, string>;
    }
  | { type: "reset" };

const initial: TicketState = {
  lineas: [],
  mesaId: null,
  comensales: 1,
  descuento: null,
  seleccionLineaId: null,
  ticketIdServer: null,
};

function uid() {
  return `tmp_${Date.now()}_${Math.floor(Math.random() * 1e6)}`;
}

function reducer(state: TicketState, action: Action): TicketState {
  switch (action.type) {
    case "addProducto": {
      const cantidad = action.cantidad ?? 1;
      // Si la última línea es el mismo producto y no está enviada, agregamos cantidad
      const ultima = state.lineas[state.lineas.length - 1];
      if (
        ultima &&
        ultima.productoId === action.producto.id &&
        !ultima.enviadaAt
      ) {
        const nuevas = [...state.lineas];
        nuevas[nuevas.length - 1] = {
          ...ultima,
          cantidad: ultima.cantidad + cantidad,
        };
        return { ...state, lineas: nuevas, seleccionLineaId: ultima.id };
      }
      const nueva: TicketLinea = {
        id: uid(),
        ticketId: "",
        productoId: action.producto.id,
        nombre: action.producto.nombre,
        cantidad,
        precioUnitario: action.producto.precioVenta,
        ivaPct: action.producto.ivaPct,
        descuentoPct: 0,
        destino: action.producto.destino,
        enviadaAt: null,
        notaCocina: "",
        comensalIdx: null,
        createdAt: new Date().toISOString(),
      };
      return {
        ...state,
        lineas: [...state.lineas, nueva],
        seleccionLineaId: nueva.id,
      };
    }
    case "setCantidad": {
      return {
        ...state,
        lineas: state.lineas.map((l) =>
          l.id === action.lineaId ? { ...l, cantidad: Math.max(0, action.cantidad) } : l
        ),
      };
    }
    case "setPrecio": {
      return {
        ...state,
        lineas: state.lineas.map((l) =>
          l.id === action.lineaId ? { ...l, precioUnitario: Math.max(0, action.precio) } : l
        ),
      };
    }
    case "removeLinea": {
      return {
        ...state,
        lineas: state.lineas.filter((l) => l.id !== action.lineaId),
        seleccionLineaId:
          state.seleccionLineaId === action.lineaId ? null : state.seleccionLineaId,
      };
    }
    case "setNota": {
      return {
        ...state,
        lineas: state.lineas.map((l) =>
          l.id === action.lineaId ? { ...l, notaCocina: action.nota } : l
        ),
      };
    }
    case "selectLinea":
      return { ...state, seleccionLineaId: action.lineaId };
    case "setMesa":
      return {
        ...state,
        mesaId: action.mesaId,
        comensales: action.comensales ?? state.comensales,
      };
    case "setDescuento":
      return { ...state, descuento: action.descuento };
    case "marcarEnviadas": {
      const now = new Date().toISOString();
      return {
        ...state,
        lineas: state.lineas.map((l) => (l.enviadaAt ? l : { ...l, enviadaAt: now })),
      };
    }
    case "syncConServer": {
      // Reemplaza IDs locales por IDs del servidor y marca enviadas.
      return {
        ...state,
        ticketIdServer: action.ticketIdServer,
        lineas: state.lineas.map((l) => {
          const serverId = action.lineaIdMap[l.id];
          return {
            ...l,
            id: serverId ?? l.id,
            ticketId: action.ticketIdServer,
            enviadaAt: l.enviadaAt ?? action.enviadaAt,
          };
        }),
      };
    }
    case "reset":
      return initial;
  }
}

// ─── CONTEXT ──────────────────────────────────────────────────

interface Ctx {
  state: TicketState;
  dispatch: React.Dispatch<Action>;
  totales: TotalesTicket;
}

const TicketCtx = React.createContext<Ctx | null>(null);

export function POSTicketProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = React.useReducer(reducer, initial);
  const totales = React.useMemo(
    () => calcularTotales(state.lineas, state.descuento),
    [state.lineas, state.descuento]
  );
  const value = React.useMemo(() => ({ state, dispatch, totales }), [state, totales]);
  return <TicketCtx.Provider value={value}>{children}</TicketCtx.Provider>;
}

export function usePOSTicket() {
  const ctx = React.useContext(TicketCtx);
  if (!ctx) throw new Error("usePOSTicket debe usarse dentro de POSTicketProvider");
  return ctx;
}
