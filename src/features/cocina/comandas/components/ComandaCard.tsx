"use client";

import { Button } from "@/shared/components/ui/button";
import { Card } from "@/shared/components/ui/card";
import { cn } from "@/lib/utils";
import type { ComandaAgrupada, ColumnaKDS, TicketLineaConCocina } from "../types";
import { LineaItem } from "./LineaItem";
import { useTranscurrido } from "../hooks/useCronometroGlobal";
import { bordeDeAlerta, useNivelAlerta } from "./AlertaRetraso";

interface Props {
  comanda: ComandaAgrupada;
  columna: ColumnaKDS;
  onAvanzar?: (comanda: ComandaAgrupada) => void;
  onRetroceder?: (comanda: ComandaAgrupada) => void;
  onLineaClick?: (linea: TicketLineaConCocina) => void;
}

const LABEL_ACCION: Record<ColumnaKDS, string> = {
  PENDIENTE: "Empezar",
  PREPARANDO: "Marcar listo",
  LISTO: "Servido",
  SERVIDO: "—",
};

function formatHora(iso: string): string {
  try {
    return new Date(iso).toLocaleTimeString("es-ES", {
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "--:--";
  }
}

export function ComandaCard({
  comanda,
  columna,
  onAvanzar,
  onRetroceder,
  onLineaClick,
}: Props) {
  // Filtramos las líneas que pertenecen a esta columna
  const lineasColumna = comanda.lineas.filter((l) => l.estadoCocina === columna);

  const transcurrido = useTranscurrido(comanda.enviadoAt);
  // Sólo aplicamos alarma en columnas activas (no en LISTO/SERVIDO)
  const columnaActiva = columna === "PENDIENTE" || columna === "PREPARANDO";
  const nivelParaAlarma = useNivelAlerta(columnaActiva ? comanda.enviadoAt : null);
  const bordeAlarma = bordeDeAlerta(nivelParaAlarma);

  if (lineasColumna.length === 0) return null;

  const lineasCocina = lineasColumna.filter((l) => l.destino === "COCINA");
  const lineasBarra = lineasColumna.filter((l) => l.destino === "BARRA");
  const lineasOtras = lineasColumna.filter((l) => l.destino === "NINGUNO");

  return (
    <Card className={cn("flex flex-col gap-3 overflow-hidden p-4 shadow-sm", bordeAlarma)}>
      {/* Header: mesa + comensales + hora + cronómetro */}
      <div className="flex items-start justify-between gap-2 border-b pb-2">
        <div className="min-w-0">
          <h3 className="truncate text-xl font-bold">{comanda.mesaNombre}</h3>
          <p className="text-xs text-muted-foreground">
            #{comanda.numero} · {comanda.comensales} {comanda.comensales === 1 ? "comensal" : "comensales"}
          </p>
        </div>
        <div className="text-right">
          <div
            className={cn(
              "text-lg font-bold tabular-nums",
              nivelParaAlarma === "ROJO" || nivelParaAlarma === "PARPADEO"
                ? "text-red-600"
                : nivelParaAlarma === "AMBAR"
                  ? "text-amber-600"
                  : "",
            )}
          >
            {transcurrido}
          </div>
          <div className="text-xs text-muted-foreground">
            {formatHora(comanda.enviadoAt)} · {comanda.listos}/{comanda.total}
          </div>
        </div>
      </div>

      {/* Líneas agrupadas por destino */}
      <div className="flex flex-col gap-2">
        {lineasCocina.length > 0 && (
          <Grupo titulo="Cocina" lineas={lineasCocina} onLineaClick={onLineaClick} />
        )}
        {lineasBarra.length > 0 && (
          <Grupo titulo="Barra" lineas={lineasBarra} onLineaClick={onLineaClick} />
        )}
        {lineasOtras.length > 0 && (
          <Grupo titulo="Otros" lineas={lineasOtras} onLineaClick={onLineaClick} />
        )}
      </div>

      {/* Acción principal + retroceder */}
      <div className="mt-auto flex gap-2">
        {columna !== "SERVIDO" && (
          <Button
            size="lg"
            className={cn("flex-1 h-12 text-base font-semibold")}
            onClick={() => onAvanzar?.(comanda)}
          >
            {LABEL_ACCION[columna]}
          </Button>
        )}
        {columna !== "PENDIENTE" && (
          <Button
            size="lg"
            variant="outline"
            className="h-12"
            onClick={() => onRetroceder?.(comanda)}
            title="Volver al estado anterior"
          >
            ↶
          </Button>
        )}
      </div>
    </Card>
  );
}

function Grupo({
  titulo,
  lineas,
  onLineaClick,
}: {
  titulo: string;
  lineas: TicketLineaConCocina[];
  onLineaClick?: (l: TicketLineaConCocina) => void;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
        {titulo}
      </p>
      {lineas.map((l) => (
        <LineaItem key={l.id} linea={l} onClick={onLineaClick} />
      ))}
    </div>
  );
}
