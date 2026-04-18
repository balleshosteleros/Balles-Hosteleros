"use client";

import { Star, Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import type { RecetaConExtras } from "../actions/recetas-actions";
import type { Fase } from "../types";

interface Props {
  receta: RecetaConExtras;
  fase: Fase | undefined;
  onDragStart: (e: React.DragEvent, r: RecetaConExtras) => void;
  onClick: (r: RecetaConExtras) => void;
}

export function RecetaCard({ receta, fase, onDragStart, onClick }: Props) {
  const dentroPlazo = fase?.plazo_dias ? receta.dias_en_fase <= fase.plazo_dias : true;
  const semaforo = dentroPlazo ? "text-emerald-600" : "text-red-600 font-semibold";

  return (
    <div
      draggable
      onDragStart={(e) => onDragStart(e, receta)}
      onClick={() => onClick(receta)}
      className="bg-card border border-border rounded-lg p-3 cursor-grab active:cursor-grabbing hover:shadow-md transition-shadow group"
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <h4 className="font-medium text-sm text-foreground truncate flex-1">
          {receta.nombre}
        </h4>
        {receta.favorita && (
          <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400 shrink-0" />
        )}
      </div>

      {receta.sub_estado_nombre && (
        <div className="text-[10px] text-muted-foreground mb-2 uppercase tracking-wide">
          {receta.sub_estado_nombre}
        </div>
      )}

      <div className="flex items-center justify-between text-[11px]">
        <span className={cn("inline-flex items-center gap-1", semaforo)}>
          <Clock className="h-3 w-3" />
          {receta.dias_en_fase}d
          {fase?.plazo_dias ? <span className="text-muted-foreground">/{fase.plazo_dias}d</span> : null}
        </span>
        {receta.propuesto_por_nombre && (
          <span className="text-muted-foreground truncate max-w-[120px]">
            {receta.propuesto_por_nombre}
          </span>
        )}
      </div>
    </div>
  );
}
