"use client";

/**
 * En qué pipelines está esta persona, dentro de su ficha de cliente.
 *
 * La ficha del cliente es UNA, como en reservas: quien contrata Ágora y Sesame
 * no son dos personas, es la misma con dos tarjetas. Por eso esto no vive en el
 * tablero sino en la ficha, y enseña las tres cosas que cambian de una tarjeta
 * a otra: en qué PIPELINE está, en qué FASE de ese pipeline, y en qué ESTADO
 * (activo, ganado, perdido o abandonado).
 *
 * Si la persona no está en ningún pipeline no se pinta nada: en los
 * restaurantes no hay tablero comercial y la ficha no debe llenarse de huecos.
 */
import { useEffect, useState } from "react";
import { GitBranch } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { formatEur } from "@/shared/lib/numero";
import {
  listOportunidadesDeCliente,
  type OportunidadDeCliente,
} from "../actions/pipeline-actions";
import { OPORTUNIDAD_ESTADO_CLASE, OPORTUNIDAD_ESTADO_LABEL } from "../types";

export function PipelinesCliente({ clienteId }: { clienteId: string }) {
  // Se guarda de qué cliente son las filas que hay en mano: así al abrir otra
  // ficha no se enseña un instante lo del cliente anterior.
  const [cargado, setCargado] = useState<{
    clienteId: string;
    filas: OportunidadDeCliente[];
  } | null>(null);

  useEffect(() => {
    let vigente = true;
    listOportunidadesDeCliente(clienteId).then((res) => {
      if (!vigente) return;
      setCargado({ clienteId, filas: res.ok ? res.data : [] });
    });
    return () => {
      vigente = false;
    };
  }, [clienteId]);

  const filas = cargado?.clienteId === clienteId ? cargado.filas : [];
  if (filas.length === 0) return null;

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
        <GitBranch className="h-3.5 w-3.5 shrink-0" />
        <span>
          {filas.length === 1 ? "Está en 1 pipeline" : `Está en ${filas.length} pipelines`}
        </span>
      </div>

      <ul className="space-y-1.5">
        {filas.map((o) => (
          <li
            key={o.id}
            className="flex flex-wrap items-center gap-x-2 gap-y-1 rounded-md border border-border/60 bg-muted/30 px-2.5 py-2 text-xs"
          >
            <span className="font-medium text-foreground">{o.pipelineNombre}</span>
            <span className="text-muted-foreground">·</span>
            <span className="text-foreground/80">
              {o.faseIcono ? `${o.faseIcono} ` : ""}
              {o.faseNombre}
            </span>
            <Badge
              variant="outline"
              className={cn(
                "ml-auto h-5 shrink-0 px-1.5 text-[10px] font-medium",
                OPORTUNIDAD_ESTADO_CLASE[o.estado],
              )}
            >
              {OPORTUNIDAD_ESTADO_LABEL[o.estado]}
            </Badge>
            {o.valor > 0 && (
              <span className="shrink-0 text-muted-foreground">{formatEur(o.valor)}</span>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
