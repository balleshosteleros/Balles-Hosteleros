"use client";

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { Settings, LayoutGrid, List, CalendarDays } from "lucide-react";
import { Button } from "@/components/ui/button";
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
import { CambiosCartaCalendario } from "./CambiosCartaCalendario";
import type { EstadoGeneral } from "../types";
import { ESTADO_GENERAL_LABELS } from "../types";
import { LoadingSpinner } from "@/shared/components/LoadingSpinner";
import { useGlobalLoadingSync } from "@/shared/hooks/use-global-loading-sync";
import {
  SubmoduleToolbar,
  colVisible,
  ordenarColumnas,
  type ToolbarColumnaVisible,
  type ToolbarColumna,
} from "@/shared/components/SubmoduleToolbar";
import { TableColumnHeader } from "@/shared/components/TableColumnHeader";
import { ResizableColumnsProvider } from "@/shared/components/ResizableColumns";

type Vista = "kanban" | "tabla" | "calendario";

export function NuevasRecetasView() {
  const [fases, setFases] = useState<FaseConPolicies[]>([]);
  const [recetas, setRecetas] = useState<RecetaConExtras[]>([]);
  const [cargando, setCargando] = useState(true);
  useGlobalLoadingSync(cargando);
  const [busqueda, setBusqueda] = useState("");
  const [estadoGeneral, setEstadoGeneral] = useState<EstadoGeneral>("en_progreso");
  const [vista, setVista] = useState<Vista>("kanban");
  const [showNew, setShowNew] = useState(false);
  const [detalleReceta, setDetalleReceta] = useState<RecetaConExtras | null>(null);
  const [editFase, setEditFase] = useState<FaseConPolicies | null>(null);
  const [showGestionarFases, setShowGestionarFases] = useState(false);
  const [columnasVisibles, setColumnasVisibles] = useState<ToolbarColumnaVisible>({});
  const [columnasOrden, setColumnasOrden] = useState<string[] | undefined>(undefined);

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

  const columnasDef: ToolbarColumna[] = [
    { campo: "nombre", label: "Nombre", bloqueada: true },
    { campo: "fase", label: "Fase" },
    { campo: "sub_estado", label: "Sub-estado" },
    { campo: "dias", label: "Días en fase" },
    { campo: "propuesto", label: "Propuesto por" },
    { campo: "fecha", label: "Fecha" },
  ];

  const columnDefs: Record<string, { th: ReactNode; td: (r: RecetaConExtras) => ReactNode }> = {
    nombre: {
      th: <TableColumnHeader key="nombre" label="Nombre" campo="nombre" />,
      td: (r) => (
        <td key="nombre" className="px-4 py-2 font-medium">{r.nombre}</td>
      ),
    },
    fase: {
      th: <TableColumnHeader key="fase" label="Fase" campo="fase" />,
      td: (r) => {
        const fase = r.fase_id ? faseMap.get(r.fase_id) : undefined;
        return <td key="fase" className="px-4 py-2">{fase?.nombre ?? "—"}</td>;
      },
    },
    sub_estado: {
      th: <TableColumnHeader key="sub_estado" label="Sub-estado" campo="sub_estado" />,
      td: (r) => (
        <td key="sub_estado" className="px-4 py-2 text-muted-foreground">{r.sub_estado_nombre ?? "—"}</td>
      ),
    },
    dias: {
      th: <TableColumnHeader key="dias" label="Días en fase" campo="dias" />,
      td: (r) => (
        <td key="dias" className="px-4 py-2">{r.dias_en_fase}d</td>
      ),
    },
    propuesto: {
      th: <TableColumnHeader key="propuesto" label="Propuesto por" campo="propuesto" />,
      td: (r) => (
        <td key="propuesto" className="px-4 py-2 text-muted-foreground">{r.propuesto_por_nombre ?? "—"}</td>
      ),
    },
    fecha: {
      th: <TableColumnHeader key="fecha" label="Fecha" campo="fecha" />,
      td: (r) => (
        <td key="fecha" className="px-4 py-2 text-muted-foreground">{r.created_at.slice(0, 10)}</td>
      ),
    },
  };

  const columnasRender = ordenarColumnas(columnasDef, columnasOrden).filter(
    (c) => c.bloqueada || colVisible(columnasVisibles, c.campo),
  );

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)]">
      <div className="px-6 py-4 border-b border-border bg-card space-y-3">
        {/* Toolbar estándar (BARRA HORIZONTAL 1) */}
        <SubmoduleToolbar
          busqueda={busqueda}
          onBusquedaChange={setBusqueda}
          placeholderBusqueda="Buscar"
          onNuevo={() => setShowNew(true)}
          columnas={columnasDef}
          columnasVisibles={columnasVisibles}
          onColumnasVisiblesChange={setColumnasVisibles}
          columnasOrden={columnasOrden}
          onColumnasOrdenChange={setColumnasOrden}
          extraDerecha={
            <Button
              size="icon"
              variant="outline"
              className="h-9 w-9"
              onClick={() => setShowGestionarFases(true)}
              title="Configuración"
              aria-label="Configuración"
            >
              <Settings className="h-4 w-4" strokeWidth={1.75} />
            </Button>
          }
        />

        {/* Filtros + toggles secundarios (fuera de la toolbar) */}
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2">
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
          <div className="flex items-center gap-1 bg-muted rounded-lg p-1">
            <Button variant={vista === "kanban" ? "default" : "ghost"} size="sm" className="h-7 text-xs gap-1" onClick={() => setVista("kanban")}>
              <LayoutGrid className="h-3.5 w-3.5" /> Pipeline
            </Button>
            <Button variant={vista === "tabla" ? "default" : "ghost"} size="sm" className="h-7 text-xs gap-1" onClick={() => setVista("tabla")}>
              <List className="h-3.5 w-3.5" /> Tabla
            </Button>
            <Button variant={vista === "calendario" ? "default" : "ghost"} size="sm" className="h-7 text-xs gap-1" onClick={() => setVista("calendario")}>
              <CalendarDays className="h-3.5 w-3.5" /> Calendario
            </Button>
          </div>
        </div>
      </div>

      {/* Body */}
      {cargando && <LoadingSpinner className="flex-1" />}

      {!cargando && vista === "kanban" && (
        <RecetaKanban
          fases={fases}
          recetas={recetas}
          onRecetaClick={openDetalle}
          onConfigFase={openConfigFase}
          onRefresh={cargar}
        />
      )}

      {!cargando && vista === "calendario" && (
        <div className="flex-1 overflow-y-auto">
          <CambiosCartaCalendario />
        </div>
      )}

      {!cargando && vista === "tabla" && (
        <div className="p-6">
          <ResizableColumnsProvider storageKey="cocina-nuevas-recetas">
            <Card>
              <CardContent className="p-0">
                <table className="w-full text-sm">
                  <thead className="border-b bg-muted/30">
                    <tr className="text-left">
                      {columnasRender.map((c) => columnDefs[c.campo]?.th)}
                    </tr>
                  </thead>
                  <tbody>
                    {recetas.length === 0 && (
                      <tr><td colSpan={columnasRender.length} className="text-center py-8 text-muted-foreground">Sin recetas</td></tr>
                    )}
                    {recetas.map((r) => (
                      <tr key={r.id} className="border-b hover:bg-muted/30 cursor-pointer" onClick={() => openDetalle(r)}>
                        {columnasRender.map((c) => columnDefs[c.campo]?.td(r))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </CardContent>
            </Card>
          </ResizableColumnsProvider>
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
