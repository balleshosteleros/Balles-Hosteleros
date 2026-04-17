"use client";

import { useCallback, useEffect, useReducer, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import { fetchComandasAbiertas } from "../services/fetch-comandas-abiertas";
import { rowToLineaCocina, type LineaCocinaRow } from "../services/row-mappers";
import type { ComandaAgrupada, TicketLineaConCocina } from "../types";

// ─── Estado del reducer ───────────────────────────────────────
interface State {
  comandas: ComandaAgrupada[];
  loading: boolean;
  error: string | null;
  connected: boolean;
  /** Monotonic counter para forzar re-render cuando nada cambia estructuralmente. */
  version: number;
}

type Action =
  | { type: "HYDRATE"; payload: ComandaAgrupada[] }
  | { type: "SET_ERROR"; error: string }
  | { type: "SET_CONNECTED"; connected: boolean }
  | { type: "UPSERT_LINEA"; linea: TicketLineaConCocina }
  | { type: "DELETE_LINEA"; lineaId: string }
  | { type: "REMOVE_SERVIDO"; lineaId: string };

const initial: State = {
  comandas: [],
  loading: true,
  error: null,
  connected: false,
  version: 0,
};

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "HYDRATE":
      return { ...state, comandas: action.payload, loading: false, error: null };

    case "SET_ERROR":
      return { ...state, error: action.error, loading: false };

    case "SET_CONNECTED":
      return { ...state, connected: action.connected };

    case "UPSERT_LINEA": {
      const linea = action.linea;
      // Descartar líneas sin enviar o canceladas (no deben estar en el board)
      if (!linea.enviadaAt || linea.estadoCocina === "CANCELADA") {
        return {
          ...state,
          comandas: removeLinea(state.comandas, linea.id),
          version: state.version + 1,
        };
      }
      return {
        ...state,
        comandas: upsertLinea(state.comandas, linea),
        version: state.version + 1,
      };
    }

    case "DELETE_LINEA":
    case "REMOVE_SERVIDO":
      return {
        ...state,
        comandas: removeLinea(state.comandas, action.lineaId),
        version: state.version + 1,
      };

    default:
      return state;
  }
}

// ─── Helpers puros ────────────────────────────────────────────
function upsertLinea(
  comandas: ComandaAgrupada[],
  linea: TicketLineaConCocina,
): ComandaAgrupada[] {
  const idx = comandas.findIndex((c) => c.ticketId === linea.ticketId);
  if (idx === -1) {
    // Ticket aún no presente localmente: el hidratador completará tras re-fetch.
    return comandas;
  }
  const current = comandas[idx];
  const li = current.lineas.findIndex((l) => l.id === linea.id);
  const nextLineas =
    li === -1
      ? [...current.lineas, linea]
      : current.lineas.map((l, i) => (i === li ? linea : l));
  const updated: ComandaAgrupada = {
    ...current,
    lineas: nextLineas.sort((a, b) =>
      a.createdAt < b.createdAt ? -1 : a.createdAt > b.createdAt ? 1 : 0,
    ),
    total: nextLineas.length,
    listos: nextLineas.filter((l) => l.estadoCocina === "LISTO").length,
  };
  const next = [...comandas];
  next[idx] = updated;
  return next;
}

function removeLinea(
  comandas: ComandaAgrupada[],
  lineaId: string,
): ComandaAgrupada[] {
  return comandas
    .map((c) => {
      const li = c.lineas.findIndex((l) => l.id === lineaId);
      if (li === -1) return c;
      const nextLineas = c.lineas.filter((_, i) => i !== li);
      return {
        ...c,
        lineas: nextLineas,
        total: nextLineas.length,
        listos: nextLineas.filter((l) => l.estadoCocina === "LISTO").length,
      };
    })
    .filter((c) => c.lineas.length > 0);
}

// ─── Hook principal ───────────────────────────────────────────
export function useComandasRealtime() {
  const [state, dispatch] = useReducer(reducer, initial);
  const rehydrateTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const rehydrate = useCallback(async () => {
    const res = await fetchComandasAbiertas();
    if (res.ok) {
      dispatch({ type: "HYDRATE", payload: res.data });
    } else {
      dispatch({ type: "SET_ERROR", error: res.error });
    }
  }, []);

  /** Rehidrata con debounce de 400 ms para coalescer bursts de inserts. */
  const scheduleRehydrate = useCallback(() => {
    if (rehydrateTimer.current) clearTimeout(rehydrateTimer.current);
    rehydrateTimer.current = setTimeout(() => {
      void rehydrate();
    }, 400);
  }, [rehydrate]);

  useEffect(() => {
    // 1. Carga inicial
    void rehydrate();

    // 2. Suscripción Realtime
    const supabase = createClient();
    const channel = supabase
      .channel("kds-comandas")
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "pos_ticket_lineas" },
        (payload) => {
          const row = payload.new as LineaCocinaRow;
          // Si la línea no tiene enviada_at aún, ignorar.
          if (!row.enviada_at) return;
          const linea = rowToLineaCocina(row);
          dispatch({ type: "UPSERT_LINEA", linea });
        },
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "pos_ticket_lineas" },
        (payload) => {
          const row = payload.new as LineaCocinaRow;
          if (!row.enviada_at) return; // se añadirá cuando enviarACocina() dispare UPDATE
          // Ticket puede ser nuevo → rehidratamos para traer contexto completo
          scheduleRehydrate();
        },
      )
      .on(
        "postgres_changes",
        { event: "DELETE", schema: "public", table: "pos_ticket_lineas" },
        (payload) => {
          const oldRow = payload.old as { id?: string };
          if (oldRow?.id) dispatch({ type: "DELETE_LINEA", lineaId: oldRow.id });
        },
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "pos_tickets" },
        () => {
          // Cambios de ticket (p.ej. enviado_at) pueden requerir rehidratar
          scheduleRehydrate();
        },
      )
      .subscribe((status) => {
        if (status === "SUBSCRIBED") {
          dispatch({ type: "SET_CONNECTED", connected: true });
        } else if (status === "CHANNEL_ERROR" || status === "CLOSED" || status === "TIMED_OUT") {
          dispatch({ type: "SET_CONNECTED", connected: false });
          // Re-hidratar al reconectar (Supabase reintenta internamente)
          scheduleRehydrate();
        }
      });

    // 3. Timer para limpiar líneas servidas >60 s
    const limpiador = setInterval(() => {
      const cutoff = Date.now() - 60_000;
      for (const c of state.comandas) {
        for (const l of c.lineas) {
          if (
            l.estadoCocina === "SERVIDO" &&
            l.servidoAt &&
            new Date(l.servidoAt).getTime() < cutoff
          ) {
            dispatch({ type: "REMOVE_SERVIDO", lineaId: l.id });
          }
        }
      }
    }, 5_000);

    return () => {
      if (rehydrateTimer.current) clearTimeout(rehydrateTimer.current);
      clearInterval(limpiador);
      void supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return {
    comandas: state.comandas,
    loading: state.loading,
    error: state.error,
    connected: state.connected,
    refresh: rehydrate,
  };
}
