"use client";

import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { rowToLineaCocina, type LineaCocinaRow } from "../services/row-mappers";
import type { TicketLineaConCocina } from "../types";

/**
 * Hook para consumir desde el POS:
 *   - Suscribe a UPDATE de pos_ticket_lineas
 *   - Emite evento cuando una línea pasa a LISTO (estado_cocina anterior != LISTO)
 *   - Filtra por la lista de ticketIds que el POS tiene abiertos
 *
 * Uso:
 *   const { avisos, limpiarAviso } = useAvisosCocina(ticketsAbiertos)
 */
export function useAvisosCocina(ticketIdsAbiertos: string[]) {
  const [avisos, setAvisos] = useState<TicketLineaConCocina[]>([]);
  const idsRef = useRef<Set<string>>(new Set(ticketIdsAbiertos));

  useEffect(() => {
    idsRef.current = new Set(ticketIdsAbiertos);
  }, [ticketIdsAbiertos]);

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel("pos-avisos-cocina")
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "pos_ticket_lineas" },
        (payload) => {
          const newRow = payload.new as LineaCocinaRow;
          const oldRow = payload.old as Partial<LineaCocinaRow>;

          const paso_a_listo =
            newRow.estado_cocina === "LISTO" && oldRow?.estado_cocina !== "LISTO";
          if (!paso_a_listo) return;
          if (!idsRef.current.has(newRow.ticket_id)) return;

          const linea = rowToLineaCocina(newRow);
          setAvisos((prev) => {
            if (prev.some((a) => a.id === linea.id)) return prev;
            return [...prev, linea];
          });
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, []);

  const limpiarAviso = (lineaId: string) =>
    setAvisos((prev) => prev.filter((a) => a.id !== lineaId));

  const limpiarTodos = () => setAvisos([]);

  return { avisos, limpiarAviso, limpiarTodos };
}
