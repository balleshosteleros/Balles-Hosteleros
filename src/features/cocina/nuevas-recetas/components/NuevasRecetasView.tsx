"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Plus, Search, Settings, LayoutGrid, List } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

import { listFases, type FaseConPolicies } from "../actions/fases-actions";
import {
  listRecetas, type RecetaConExtras,
} from "../actions/recetas-actions";
import { RecetaKanban } from "./RecetaKanban";
import { NuevaRecetaDialog } from "./NuevaRecetaDialog";
import { RecetaDetailDialog } from "./RecetaDetailDialog";
import { FaseConfigDialog } from "./config/FaseConfigDialog";
import { GestionarFasesDialog } from "./config/GestionarFasesDialog";
import type { EstadoGeneral } from "../types";
import { ESTADO_GENERAL_LABELS } from "../types";

type Vista = "kanban" | "tabla";

export function NuevasRecetasView() {
  const [fases, setFases] = useState<FaseConPolicies[]>([]);
  const [recetas, setRecetas] = useState<RecetaConExtras[]>([]);
  const [cargando, setCargando] = useState(true);
  const [busqueda, setBusqueda] = useState("");
  const [estadoGeneral, setEstadoGeneral] = useState<EstadoGeneral>("en_progreso");
  const [vista, setVista] = useState<Vista>("kanban");
  const [showNew, setShowNew] = useState(false);
  const [detalleReceta, setDetalleReceta] = useState<RecetaConExtras | null>(null);
  const [editFase, setEditFase] = useState<FaseConPolicies | null>(null);
  const [showGestionarFases, setShowGestionarFases] = useState(false);

  const cargar = useCallback(async () => {
    setCargando(true);
    try {
      const [fasesRes, recetasRes] = await Promise.all([
        listFases(),
        listRecetas({ estado_general: estadoGeneral, busqueda }),
      ]);
      if (fasesRes.ok) setFases(fasesRes.data);
      if (recetasRes.ok) setRecetas(recetasRes.data);
      else toast.error(recetasRes.error);
    } catch {
      toast.error("Error cargando datos");
    } finally {
      setCargando(false);
    }
  }, [estadoGeneral, busqueda]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  const faseMap = useMemo(() => new Map(fases.map((f) => [f.id, f])), [fases]);

  function openConfigFase(faseId: string) {
    const fase = fases.find((f) => f.id === faseId);
    if (fase) setEditFase(fase);
  }

  function openDetalle(r: RecetaConExtras) {
    setDetalleReceta(r);
  }

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)]">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-card">
        <div className="flex items-center gap-3 flex-1">
          <div className="relative w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar receta..."
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              className="pl-9 h-9"
            />
          </div>

          <Select value={estadoGeneral} onValueChange={(v) => setEstadoGeneral(v as EstadoGeneral)}>
            <SelectTrigger className="w-40 h-9"><SelectValue /></SelectTrigger>
            <SelectContent>
              {(Object.keys(ESTADO_GENERAL_LABELS) as EstadoGeneral[]).map((k) => (
                <SelectItem key={k} value={k}>{ESTADO_GENERAL_LABELS[k]}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Badge variant="secondary" className="text-xs">
            {recetas.length} receta{recetas.length !== 1 ? "s" : ""}
          </Badge>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 bg-muted rounded-lg p-1">
            <Button
              variant={vista === "kanban" ? "default" : "ghost"}
              size="sm"
              className="h-7 text-xs gap-1"
              onClick={() => setVista("kanban")}
            >
              <LayoutGrid className="h-3.5 w-3.5" /> Pipeline
            </Button>
            <Button
              variant={vista === "tabla" ? "default" : "ghost"}
              size="sm"
              className="h-7 text-xs gap-1"
              onClick={() => setVista("tabla")}
            >
              <List className="h-3.5 w-3.5" /> Tabla
            </Button>
          </div>

          <Button
            variant="outline"
            size="sm"
            className="h-9"
            onClick={() => setShowGestionarFases(true)}
          >
            <Settings className="h-4 w-4 mr-1.5" /> Gestionar fases
          </Button>

          <Button size="sm" className="h-9" onClick={() => setShowNew(true)}>
            <Plus className="h-4 w-4 mr-1.5" /> Nueva receta
          </Button>
        </div>
      </div>

      {/* Body */}
      {cargando && (
        <div className="flex-1 flex items-center justify-center text-sm text-muted-foreground">
          Cargando pipeline...
        </div>
      )}

      {!cargando && vista === "kanban" && (
        <RecetaKanban
          fases={fases}
          recetas={recetas}
          onRecetaClick={openDetalle}
          onConfigFase={openConfigFase}
          onRefresh={cargar}
        />
      )}

      {!cargando && vista === "tabla" && (
        <div className="p-6">
          <Card>
            <CardContent className="p-0">
              <table className="w-full text-sm">
                <thead className="border-b bg-muted/30">
                  <tr className="text-left">
                    <th className="px-4 py-2 font-medium">Nombre</th>
                    <th className="px-4 py-2 font-medium">Fase</th>
                    <th className="px-4 py-2 font-medium">Sub-estado</th>
                    <th className="px-4 py-2 font-medium">Días en fase</th>
                    <th className="px-4 py-2 font-medium">Propuesto por</th>
                    <th className="px-4 py-2 font-medium">Fecha</th>
                  </tr>
                </thead>
                <tbody>
                  {recetas.length === 0 && (
                    <tr><td colSpan={6} className="text-center py-8 text-muted-foreground">Sin recetas</td></tr>
                  )}
                  {recetas.map((r) => {
                    const fase = r.fase_id ? faseMap.get(r.fase_id) : undefined;
                    return (
                      <tr key={r.id} className="border-b hover:bg-muted/30 cursor-pointer" onClick={() => openDetalle(r)}>
                        <td className="px-4 py-2 font-medium">{r.nombre}</td>
                        <td className="px-4 py-2">{fase?.nombre ?? "—"}</td>
                        <td className="px-4 py-2 text-muted-foreground">{r.sub_estado_nombre ?? "—"}</td>
                        <td className="px-4 py-2">{r.dias_en_fase}d</td>
                        <td className="px-4 py-2 text-muted-foreground">{r.propuesto_por_nombre ?? "—"}</td>
                        <td className="px-4 py-2 text-muted-foreground">{r.created_at.slice(0, 10)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </div>
      )}

      <NuevaRecetaDialog
        open={showNew}
        onOpenChange={setShowNew}
        onCreated={cargar}
      />

      <RecetaDetailDialog
        open={!!detalleReceta}
        onOpenChange={(o) => !o && setDetalleReceta(null)}
        receta={detalleReceta}
        fases={fases}
        onRefresh={() => {
          cargar();
          if (detalleReceta) {
            listRecetas({ estado_general: estadoGeneral, busqueda }).then((res) => {
              if (res.ok) {
                const updated = res.data.find((r) => r.id === detalleReceta.id);
                if (updated) setDetalleReceta(updated);
              }
            });
          }
        }}
      />

      <FaseConfigDialog
        open={!!editFase}
        onOpenChange={(o) => !o && setEditFase(null)}
        fase={editFase}
        onSaved={cargar}
      />

      <GestionarFasesDialog
        open={showGestionarFases}
        onOpenChange={setShowGestionarFases}
        onChanged={cargar}
      />
    </div>
  );
}
