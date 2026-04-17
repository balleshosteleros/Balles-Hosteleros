"use client";

import { useCallback, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  updateEstadoCocinaLinea,
  updateEstadoCocinaTicket,
} from "../actions/comandas-actions";
import { useComandasRealtime } from "../hooks/useComandasRealtime";
import { CronometroProvider } from "../hooks/useCronometroGlobal";
import { COLUMNAS_ORDEN } from "../services/clasificador-estados";
import { aplicarFiltros } from "../services/aplicar-filtros";
import type {
  ColumnaKDS,
  ComandaAgrupada,
  FiltrosComandas,
  LineaEstadoCocina,
  TicketLineaConCocina,
} from "../types";
import { ColumnaEstado } from "./ColumnaEstado";
import { FiltrosBar } from "./FiltrosBar";

// ─── Tabla de siguiente/anterior estado ───────────────────────
const SIGUIENTE: Record<ColumnaKDS, LineaEstadoCocina | null> = {
  PENDIENTE: "PREPARANDO",
  PREPARANDO: "LISTO",
  LISTO: "SERVIDO",
  SERVIDO: null,
};

const ANTERIOR: Record<ColumnaKDS, LineaEstadoCocina | null> = {
  PENDIENTE: null,
  PREPARANDO: "PENDIENTE",
  LISTO: "PREPARANDO",
  SERVIDO: "LISTO",
};

export function ComandasBoard() {
  return (
    <CronometroProvider>
      <ComandasBoardInner />
    </CronometroProvider>
  );
}

function ComandasBoardInner() {
  const { comandas, loading, error, connected, refresh } = useComandasRealtime();
  const [filtros, setFiltros] = useState<FiltrosComandas>({
    destino: "TODOS",
    partidaId: null,
  });
  const comandasFiltradas = useMemo(
    () => aplicarFiltros(comandas, filtros),
    [comandas, filtros],
  );

  // ─── Handlers de acciones ──────────────────────────────────
  const cambiarLinea = useCallback(
    async (linea: TicketLineaConCocina, nuevoEstado: LineaEstadoCocina) => {
      const estadoAnterior = linea.estadoCocina;
      const res = await updateEstadoCocinaLinea({
        lineaId: linea.id,
        nuevoEstado,
      });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success(`${linea.nombre} → ${nuevoEstado.toLowerCase()}`, {
        duration: 10_000,
        action: {
          label: "Deshacer",
          onClick: async () => {
            const undo = await updateEstadoCocinaLinea({
              lineaId: linea.id,
              nuevoEstado: estadoAnterior,
            });
            if (!undo.ok) toast.error(undo.error);
          },
        },
      });
    },
    [],
  );

  const avanzarTicket = useCallback(
    async (comanda: ComandaAgrupada, columnaActual: ColumnaKDS) => {
      const siguiente = SIGUIENTE[columnaActual];
      if (!siguiente) return;
      const lineasColumna = comanda.lineas.filter(
        (l) => l.estadoCocina === columnaActual,
      );
      const destinos = Array.from(
        new Set(lineasColumna.map((l) => l.destino)),
      ) as Array<"COCINA" | "BARRA" | "NINGUNO">;

      const res = await updateEstadoCocinaTicket({
        ticketId: comanda.ticketId,
        nuevoEstado: siguiente,
        destinos,
      });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success(
        `${comanda.mesaNombre}: ${res.actualizadas} líneas → ${siguiente.toLowerCase()}`,
        {
          duration: 10_000,
          action: {
            label: "Deshacer",
            onClick: async () => {
              await updateEstadoCocinaTicket({
                ticketId: comanda.ticketId,
                nuevoEstado: columnaActual,
                destinos,
              });
              void refresh();
            },
          },
        },
      );
    },
    [refresh],
  );

  const retrocederTicket = useCallback(
    async (comanda: ComandaAgrupada, columnaActual: ColumnaKDS) => {
      const anterior = ANTERIOR[columnaActual];
      if (!anterior) return;
      const lineasColumna = comanda.lineas.filter(
        (l) => l.estadoCocina === columnaActual,
      );
      const destinos = Array.from(
        new Set(lineasColumna.map((l) => l.destino)),
      ) as Array<"COCINA" | "BARRA" | "NINGUNO">;

      const res = await updateEstadoCocinaTicket({
        ticketId: comanda.ticketId,
        nuevoEstado: anterior,
        destinos,
      });
      if (!res.ok) toast.error(res.error);
    },
    [],
  );

  const handleLineaClick = useCallback(
    (linea: TicketLineaConCocina) => {
      const col = linea.estadoCocina as ColumnaKDS;
      const siguiente = SIGUIENTE[col];
      if (!siguiente) return;
      void cambiarLinea(linea, siguiente);
    },
    [cambiarLinea],
  );

  if (loading) {
    return (
      <div className="flex h-[calc(100vh-3.5rem)] items-center justify-center">
        <p className="text-muted-foreground">Cargando comandas...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-[calc(100vh-3.5rem)] flex-col items-center justify-center gap-3 p-8 text-center">
        <h2 className="text-xl font-bold text-destructive">Error cargando comandas</h2>
        <pre className="max-w-xl overflow-auto rounded bg-muted p-3 text-xs">{error}</pre>
      </div>
    );
  }

  return (
    <div className="flex h-[calc(100vh-3.5rem)] flex-col">
      {/* Barra superior: status de conexión y contador */}
      <div className="flex items-center justify-between border-b bg-background px-4 py-2">
        <div className="flex items-center gap-2">
          <span
            className={`inline-block h-2.5 w-2.5 rounded-full ${connected ? "bg-emerald-500" : "bg-amber-500 animate-pulse"}`}
          />
          <span className="text-xs text-muted-foreground">
            {connected ? "En vivo" : "Reconectando…"}
          </span>
        </div>
        <span className="text-xs text-muted-foreground">
          {comandasFiltradas.length} {comandasFiltradas.length === 1 ? "comanda" : "comandas"} visibles
        </span>
      </div>

      {/* Filtros */}
      <FiltrosBar value={filtros} onChange={setFiltros} />

      {/* Kanban 4 columnas */}
      <div className="grid min-h-0 flex-1 grid-cols-4 gap-2 p-2">
        {COLUMNAS_ORDEN.map((col) => (
          <ColumnaEstado
            key={col}
            columna={col}
            comandas={comandasFiltradas}
            onAvanzar={(c) => void avanzarTicket(c, col)}
            onRetroceder={(c) => void retrocederTicket(c, col)}
            onLineaClick={handleLineaClick}
          />
        ))}
      </div>
    </div>
  );
}
