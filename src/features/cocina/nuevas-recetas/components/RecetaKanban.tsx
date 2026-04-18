"use client";

import { useCallback, useRef, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Settings } from "lucide-react";
import { COLOR_PALETTE, type FaseColor } from "../types";
import type { FaseConPolicies } from "../actions/fases-actions";
import type { RecetaConExtras } from "../actions/recetas-actions";
import { RecetaCard } from "./RecetaCard";
import { ConfirmarMovimientoDialog } from "./ConfirmarMovimientoDialog";
import { moverReceta } from "../actions/recetas-actions";
import { toast } from "sonner";

interface Props {
  fases: FaseConPolicies[];
  recetas: RecetaConExtras[];
  onRecetaClick: (r: RecetaConExtras) => void;
  onConfigFase: (faseId: string) => void;
  onRefresh: () => void;
}

export function RecetaKanban({ fases, recetas, onRecetaClick, onConfigFase, onRefresh }: Props) {
  const dragged = useRef<RecetaConExtras | null>(null);
  const [moveDialog, setMoveDialog] = useState<{
    receta: RecetaConExtras;
    faseDestino: FaseConPolicies;
  } | null>(null);

  const handleDragStart = useCallback((_e: React.DragEvent, r: RecetaConExtras) => {
    dragged.current = r;
  }, []);

  const handleDrop = useCallback(
    (fase: FaseConPolicies) => {
      const r = dragged.current;
      dragged.current = null;
      if (!r) return;
      if (r.fase_id === fase.id) return;
      setMoveDialog({ receta: r, faseDestino: fase });
    },
    [],
  );

  const handleConfirmMove = async (params: {
    subEstadoId: string | null;
    nota: string;
    comunicar: boolean;
  }) => {
    if (!moveDialog) return;
    const { receta, faseDestino } = moveDialog;
    const res = await moverReceta({
      recetaId: receta.id,
      faseDestinoId: faseDestino.id,
      subEstadoId: params.subEstadoId ?? undefined,
      nota: params.nota || undefined,
      comunicar: params.comunicar,
    });
    if (!res.ok) {
      toast.error(res.error);
    } else {
      toast.success(
        params.comunicar
          ? `"${receta.nombre}" movida a ${faseDestino.nombre} — tarea creada`
          : `"${receta.nombre}" movida a ${faseDestino.nombre}`,
      );
      onRefresh();
    }
    setMoveDialog(null);
  };

  const faseAnterior = moveDialog
    ? fases.find((f) => f.id === moveDialog.receta.fase_id)
    : undefined;

  if (fases.length === 0) {
    return (
      <div className="p-8 text-center text-sm text-muted-foreground">
        No hay fases configuradas. Configura el pipeline primero.
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-x-auto p-4">
      <div className="flex gap-3 min-w-max h-full">
        {fases.map((fase) => {
          const color = COLOR_PALETTE[fase.color as FaseColor] ?? COLOR_PALETTE.gris;
          const recetasFase = recetas.filter((r) => r.fase_id === fase.id);

          return (
            <div key={fase.id} className="flex flex-col shrink-0 w-[260px]">
              {/* Header con gradiente */}
              <div
                className="h-2 rounded-t-lg"
                style={{ background: `linear-gradient(90deg, ${color.from}, ${color.to})` }}
              />

              {/* Nombre fase */}
              <div className="flex items-center gap-2 px-3 py-2 bg-muted/30 border-x border-border">
                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: color.from }} />
                <span className="text-xs font-semibold text-foreground uppercase tracking-wide flex-1 truncate">
                  {fase.nombre}
                </span>
                <Badge variant="outline" className="text-[10px] h-4 px-1.5 font-bold">
                  {recetasFase.length}
                </Badge>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6"
                  onClick={() => onConfigFase(fase.id)}
                  title="Editar fase"
                >
                  <Settings className="h-3 w-3" />
                </Button>
              </div>

              {/* Drop zone */}
              <ScrollArea
                className="flex-1 border-x border-b border-border rounded-b-lg bg-muted/20 p-2"
                style={{ minHeight: "calc(100vh - 280px)" }}
              >
                <div
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => {
                    e.preventDefault();
                    handleDrop(fase);
                  }}
                  className="space-y-2 min-h-full"
                >
                  {recetasFase.length === 0 && (
                    <div className="text-[11px] text-muted-foreground/60 text-center py-6">
                      Arrastra recetas aquí
                    </div>
                  )}
                  {recetasFase.map((r) => (
                    <RecetaCard
                      key={r.id}
                      receta={r}
                      fase={fase}
                      onDragStart={handleDragStart}
                      onClick={onRecetaClick}
                    />
                  ))}
                </div>
              </ScrollArea>
            </div>
          );
        })}
      </div>

      <ConfirmarMovimientoDialog
        open={!!moveDialog}
        onOpenChange={(o) => !o && setMoveDialog(null)}
        receta={moveDialog?.receta ?? null}
        faseAnterior={faseAnterior}
        faseNueva={moveDialog?.faseDestino}
        subEstadosNueva={moveDialog?.faseDestino.sub_estados ?? []}
        onConfirm={handleConfirmMove}
      />
    </div>
  );
}
