"use client";

import { useState } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Star, Archive, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

import type { RecetaConExtras } from "../actions/recetas-actions";
import type { FaseConPolicies } from "../actions/fases-actions";
import { toggleFavorita, cambiarEstadoGeneral } from "../actions/recetas-actions";
import { ESTADO_GENERAL_LABELS, COLOR_PALETTE, type FaseColor } from "../types";
import { EscandalloTab } from "./EscandalloTab";
import { CompraTab } from "./CompraTab";
import { CataTab } from "./CataTab";
import { MarketingTab } from "./MarketingTab";
import { HistorialTab } from "./HistorialTab";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  receta: RecetaConExtras | null;
  fases: FaseConPolicies[];
  onRefresh: () => void;
}

export function RecetaDetailDialog({ open, onOpenChange, receta, fases, onRefresh }: Props) {
  const [tab, setTab] = useState("escandallo");

  if (!receta) return null;

  const fase = fases.find((f) => f.id === receta.fase_id);
  const color = fase ? COLOR_PALETTE[fase.color as FaseColor] : COLOR_PALETTE.gris;
  const fasePosicion = fase ? fase.orden : 0;

  // Mostrar tab Etiquetas finales sólo si está en fase 4 (Segunda cata) en adelante
  const definirEtiquetasFinales = fasePosicion >= 4;

  async function onFav() {
    if (!receta) return;
    const res = await toggleFavorita(receta.id);
    if (res.ok) onRefresh();
    else toast.error(res.error);
  }

  async function onArchivar() {
    if (!receta) return;
    const motivo = prompt("Motivo del archivado (opcional):") ?? undefined;
    const res = await cambiarEstadoGeneral(receta.id, "archivada", motivo);
    if (res.ok) {
      toast.success("Receta archivada");
      onRefresh();
      onOpenChange(false);
    } else {
      toast.error(res.error);
    }
  }

  async function onReactivar() {
    if (!receta) return;
    const res = await cambiarEstadoGeneral(receta.id, "en_progreso");
    if (res.ok) {
      toast.success("Receta reactivada");
      onRefresh();
    } else {
      toast.error(res.error);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <div className="flex items-start justify-between gap-3 pr-6">
            <div className="flex-1 min-w-0">
              <DialogTitle className="text-lg">{receta.nombre}</DialogTitle>
              <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                {fase && (
                  <Badge
                    className="text-[11px] border-0"
                    style={{ backgroundColor: color.from, color: "#fff" }}
                  >
                    Fase {fase.orden}: {fase.nombre}
                  </Badge>
                )}
                {receta.sub_estado_nombre && (
                  <Badge variant="outline" className="text-[11px]">
                    {receta.sub_estado_nombre}
                  </Badge>
                )}
                <Badge
                  variant="outline"
                  className={cn(
                    "text-[11px]",
                    receta.estado_general === "aprobada" && "border-emerald-500 text-emerald-700",
                    receta.estado_general === "archivada" && "border-gray-500 text-gray-700",
                  )}
                >
                  {ESTADO_GENERAL_LABELS[receta.estado_general]}
                </Badge>
                {receta.propuesto_por_nombre && (
                  <span className="text-[11px] text-muted-foreground">
                    Por {receta.propuesto_por_nombre}
                  </span>
                )}
              </div>
            </div>

            <div className="flex gap-1 shrink-0">
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={onFav}
                title="Favorita"
              >
                <Star className={cn("h-4 w-4", receta.favorita && "fill-amber-400 text-amber-400")} />
              </Button>
              {receta.estado_general === "archivada" ? (
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onReactivar} title="Reactivar">
                  <RotateCcw className="h-4 w-4" />
                </Button>
              ) : (
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onArchivar} title="Archivar">
                  <Archive className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>
        </DialogHeader>

        <Tabs value={tab} onValueChange={setTab} className="flex-1 flex flex-col overflow-hidden">
          <TabsList className="grid grid-cols-6 w-full h-8">
            <TabsTrigger value="escandallo" className="text-xs">Escandallo</TabsTrigger>
            <TabsTrigger value="compra" className="text-xs">Compra</TabsTrigger>
            <TabsTrigger value="cata1" className="text-xs">Cata 1</TabsTrigger>
            <TabsTrigger value="cata2" className="text-xs">Cata 2</TabsTrigger>
            <TabsTrigger value="marketing" className="text-xs">Marketing</TabsTrigger>
            <TabsTrigger value="historial" className="text-xs">Historial</TabsTrigger>
          </TabsList>

          <div className="flex-1 overflow-y-auto mt-3 pr-1">
            <TabsContent value="escandallo" className="mt-0">
              <EscandalloTab
                receta={receta}
                onChanged={onRefresh}
                definirEtiquetasFinales={definirEtiquetasFinales}
              />
            </TabsContent>

            <TabsContent value="compra" className="mt-0">
              <CompraTab recetaId={receta.id} />
            </TabsContent>

            <TabsContent value="cata1" className="mt-0">
              <CataTab
                recetaId={receta.id}
                numero={1}
                escandallo={{
                  esc_coste_estimado: receta.esc_coste_estimado,
                  esc_pvp_propuesto: receta.esc_pvp_propuesto,
                }}
                onChanged={onRefresh}
              />
            </TabsContent>

            <TabsContent value="cata2" className="mt-0">
              <CataTab
                recetaId={receta.id}
                numero={2}
                escandallo={{
                  esc_coste_estimado: receta.esc_coste_estimado,
                  esc_pvp_propuesto: receta.esc_pvp_propuesto,
                }}
                onChanged={onRefresh}
              />
            </TabsContent>

            <TabsContent value="marketing" className="mt-0">
              <MarketingTab receta={receta} onChanged={onRefresh} />
            </TabsContent>

            <TabsContent value="historial" className="mt-0">
              <HistorialTab recetaId={receta.id} />
            </TabsContent>
          </div>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
