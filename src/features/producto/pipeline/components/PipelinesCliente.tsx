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
 * Es de la MATRIZ y solo de la matriz: el pipeline es el comercial del propio
 * software, no algo de un restaurante. En una empresa cliente ni se pinta ni se
 * pregunta a la base de datos, aunque la ficha de cliente sea la misma vista.
 */
import { useEffect, useMemo, useState } from "react";
import { GitBranch, StickyNote } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { useCatalogoEmpresa } from "@/features/empresa/contexts/catalogo-empresa-context";
import { formatEur } from "@/shared/lib/numero";
import {
  listOportunidadesDeCliente,
  type OportunidadDeCliente,
} from "../actions/pipeline-actions";
import { OPORTUNIDAD_ESTADO_CLASE, OPORTUNIDAD_ESTADO_LABEL } from "../types";

export function PipelinesCliente({ clienteId }: { clienteId: string }) {
  const { esMatriz } = useCatalogoEmpresa();
  // Se guarda de qué cliente son las filas que hay en mano: así al abrir otra
  // ficha no se enseña un instante lo del cliente anterior.
  const [cargado, setCargado] = useState<{
    clienteId: string;
    filas: OportunidadDeCliente[];
  } | null>(null);

  useEffect(() => {
    if (!esMatriz) return;
    let vigente = true;
    listOportunidadesDeCliente(clienteId).then((res) => {
      if (!vigente) return;
      setCargado({ clienteId, filas: res.ok ? res.data : [] });
    });
    return () => {
      vigente = false;
    };
  }, [clienteId, esMatriz]);

  const filas = useMemo(
    () => (cargado?.clienteId === clienteId ? cargado.filas : []),
    [cargado, clienteId],
  );

  /**
   * Las notas de la persona, sin repetir.
   *
   * En Go High Level la nota colgaba del CONTACTO, no del trato: quien tenía
   * Cover Manager, Joombo y Sesame arrastraba la misma frase en las tres
   * tarjetas. Pintarla tres veces sería ruido, así que se agrupa por texto y se
   * dice de qué tableros viene solo cuando hay más de una nota distinta.
   */
  const notas = useMemo(() => {
    const porTexto = new Map<string, string[]>();
    for (const o of filas) {
      const texto = (o.notas ?? "").trim();
      if (!texto) continue;
      porTexto.set(texto, [...(porTexto.get(texto) ?? []), o.pipelineNombre]);
    }
    return [...porTexto].map(([texto, pipelines]) => ({ texto, pipelines }));
  }, [filas]);

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

      {notas.length > 0 && (
        <div className="space-y-1.5 pt-1">
          <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
            <StickyNote className="h-3.5 w-3.5 shrink-0" />
            <span>{notas.length === 1 ? "Nota" : "Notas"}</span>
          </div>
          {notas.map((n) => (
            <div
              key={n.texto}
              className="rounded-md border border-border/60 bg-muted/30 px-2.5 py-2 text-xs"
            >
              {notas.length > 1 && (
                <p className="mb-1 font-medium text-muted-foreground">
                  {n.pipelines.join(" · ")}
                </p>
              )}
              {/* Vienen con saltos de línea de años de seguimiento: se respetan,
                  y si son muy largas se hace scroll dentro en vez de estirar la
                  ficha entera. */}
              <p className="max-h-40 overflow-y-auto whitespace-pre-wrap text-foreground/90">
                {n.texto}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
