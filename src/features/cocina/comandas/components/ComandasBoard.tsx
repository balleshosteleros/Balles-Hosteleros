"use client";

import { useCallback, useMemo, useState } from "react";
import { toast } from "sonner";
import { Sun, Moon, PowerOff } from "lucide-react";
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
import { LoadingSpinner } from "@/shared/components/LoadingSpinner";
import { SubmoduleToolbar } from "@/shared/components/SubmoduleToolbar";
import { Button } from "@/shared/components/ui/button";
import { cn } from "@/lib/utils";
// El mismo conmutador claro/oscuro que usa Reservas, y a propósito el mismo:
// quien trabaja de noche lo pone en oscuro una vez y lo encuentra igual en las
// dos pantallas que mira durante el servicio.
import { useSalaTema } from "@/features/sala/hooks/useSalaTema";
import { ApagadosPanel } from "@/features/cocina/apagados/components/ApagadosPanel";

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
  const [busqueda, setBusqueda] = useState("");
  const { esOscuro, alternarTema } = useSalaTema();
  const [apagadosAbierto, setApagadosAbierto] = useState(false);
  const comandasFiltradas = useMemo(() => {
    const base = aplicarFiltros(comandas, filtros);
    const q = busqueda.trim().toLowerCase();
    if (!q) return base;
    return base
      .map((c) => {
        const mesaMatch = (c.mesaNombre ?? "").toLowerCase().includes(q);
        const numeroMatch = (c.numero ?? "").toLowerCase().includes(q);
        if (mesaMatch || numeroMatch) return c;
        const lineasMatch = c.lineas.filter((l) =>
          (l.nombre ?? "").toLowerCase().includes(q),
        );
        if (lineasMatch.length === 0) return null;
        return {
          ...c,
          lineas: lineasMatch,
          total: lineasMatch.length,
          listos: lineasMatch.filter((l) => l.estadoCocina === "LISTO").length,
        };
      })
      .filter((c): c is ComandaAgrupada => c !== null);
  }, [comandas, filtros, busqueda]);

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
    return <LoadingSpinner className="h-[calc(100vh-3.5rem)]" size="lg" />;
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
    <div
      className={cn(
        "sala-tema flex h-[calc(100vh-3.5rem)] flex-col",
        esOscuro && "sala-oscuro",
      )}
    >
      {/* Barra superior: status de conexión, contador y los dos botones de
          servicio (vista oscura y apagar productos). */}
      <div className="flex items-center justify-between border-b bg-background px-4 py-2">
        <div className="flex items-center gap-2">
          <span
            className={`inline-block h-2.5 w-2.5 rounded-full ${connected ? "bg-emerald-500" : "bg-amber-500 animate-pulse"}`}
          />
          <span className="text-xs text-muted-foreground">
            {connected ? "En vivo" : "Reconectando…"}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">
            {comandasFiltradas.length} {comandasFiltradas.length === 1 ? "comanda" : "comandas"} visibles
          </span>
          <Button
            variant="outline"
            size="sm"
            className="h-8 gap-1.5"
            onClick={() => setApagadosAbierto(true)}
            title="Marcar lo que se ha acabado"
          >
            <PowerOff className="h-4 w-4" />
            <span className="hidden sm:inline">Apagar productos</span>
          </Button>
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8"
            onClick={alternarTema}
            title={esOscuro ? "Cambiar a vista clara" : "Cambiar a vista oscura"}
            aria-label={esOscuro ? "Cambiar a vista clara" : "Cambiar a vista oscura"}
            aria-pressed={esOscuro}
          >
            {esOscuro ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </Button>
        </div>
      </div>

      <ApagadosPanel abierto={apagadosAbierto} onCerrar={() => setApagadosAbierto(false)} />

      {/* Toolbar estándar (BARRA HORIZONTAL 1) */}
      <div className="px-2 pt-2 space-y-2">
        <SubmoduleToolbar
          busqueda={busqueda}
          onBusquedaChange={setBusqueda}
          placeholderBusqueda="Buscar"
          ocultarNuevo
        />
        {/* Filtros específicos de comandas (fuera de la toolbar) */}
        <FiltrosBar value={filtros} onChange={setFiltros} />
      </div>

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
