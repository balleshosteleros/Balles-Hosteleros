"use client";

import { useState, useEffect, useMemo, useTransition } from "react";
import Link from "next/link";
import { ClipboardList } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  SubmoduleToolbar,
  type ToolbarColumna,
  type ToolbarColumnaVisible,
  ordenarColumnas,
  colVisible,
} from "@/shared/components/SubmoduleToolbar";
import { ResizableColumnsProvider } from "@/shared/components/ResizableColumns";
import { LoadingSpinner } from "@/shared/components/LoadingSpinner";
import { NuevaCampanaDialog } from "./NuevaCampanaDialog";
import { listCampanas } from "@/features/calidad/cuestionarios/actions";
import type { CampanaResumen } from "@/features/calidad/cuestionarios/types";

const columnasDef: ToolbarColumna[] = [
  { campo: "periodo", label: "Periodo", bloqueada: true },
  { campo: "plantillaNombre", label: "Cuestionario" },
  { campo: "respondidos", label: "Respondidos" },
  { campo: "reuniones", label: "Reuniones" },
  { campo: "estado", label: "Estado" },
];

interface Props {
  onAbrirPlantillas: () => void;
}

export function CampanasListView({ onAbrirPlantillas }: Props) {
  const [campanas, setCampanas] = useState<CampanaResumen[]>([]);
  const [loading, setLoading] = useState(true);
  const [busqueda, setBusqueda] = useState("");
  const [columnasVisibles, setColumnasVisibles] = useState<ToolbarColumnaVisible>({});
  const [columnasOrden, setColumnasOrden] = useState<string[]>(columnasDef.map((c) => c.campo));
  const [openDialog, setOpenDialog] = useState(false);
  const [, startTransition] = useTransition();

  function refresh() {
    setLoading(true);
    listCampanas().then((data) => {
      setCampanas(data);
      setLoading(false);
    });
  }

  useEffect(() => {
    refresh();
  }, []);

  const filtradas = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    if (!q) return campanas;
    return campanas.filter(
      (c) =>
        c.plantillaNombre.toLowerCase().includes(q) ||
        c.periodo.toLowerCase().includes(q),
    );
  }, [campanas, busqueda]);

  const columnasRender = ordenarColumnas(columnasDef, columnasOrden).filter(
    (c) => c.bloqueada || colVisible(columnasVisibles, c.campo),
  );

  return (
    <div className="space-y-4">
      <SubmoduleToolbar
        busqueda={busqueda}
        onBusquedaChange={setBusqueda}
        placeholderBusqueda="Buscar"
        onNuevo={() => setOpenDialog(true)}
        columnas={columnasDef}
        columnasVisibles={columnasVisibles}
        onColumnasVisiblesChange={setColumnasVisibles}
        columnasOrden={columnasOrden}
        onColumnasOrdenChange={setColumnasOrden}
        extraIzquierda={
          <Button
            variant="outline"
            size="sm"
            onClick={onAbrirPlantillas}
            className="gap-1.5"
          >
            <ClipboardList className="h-3.5 w-3.5" /> Plantillas
          </Button>
        }
      />

      <ResizableColumnsProvider storageKey="calidad-cuestionarios-campanas">
        <div className="bg-card rounded-lg border overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                {columnasRender.map((c) => (
                  <th key={c.campo} className="text-left px-3 py-2 font-medium text-foreground">
                    {c.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading && campanas.length === 0 && (
                <tr>
                  <td colSpan={columnasRender.length} className="text-center py-10">
                    <LoadingSpinner />
                  </td>
                </tr>
              )}
              {!loading && filtradas.length === 0 && (
                <tr>
                  <td
                    colSpan={columnasRender.length}
                    className="text-center py-16"
                  >
                    {campanas.length === 0 ? (
                      <>
                        <ClipboardList className="h-10 w-10 mx-auto text-muted-foreground/40 mb-2" />
                        <div className="text-sm text-muted-foreground">
                          Aún no hay campañas.
                        </div>
                        <div className="text-xs text-muted-foreground mt-1">
                          Pulsa + Nuevo para crear la primera.
                        </div>
                      </>
                    ) : (
                      <span className="text-sm text-muted-foreground">
                        Ninguna campaña coincide con la búsqueda.
                      </span>
                    )}
                  </td>
                </tr>
              )}
              {filtradas.map((c) => {
                const cells: Record<string, React.ReactNode> = {
                  periodo: (
                    <Link
                      href={`/calidad/cuestionarios/${c.id}`}
                      className="font-medium hover:underline"
                    >
                      {labelPeriodo(c.periodo)}
                    </Link>
                  ),
                  plantillaNombre: <span>{c.plantillaNombre}</span>,
                  respondidos: (
                    <ProgresoLinea
                      hecho={c.envioRespondidos}
                      total={c.totalEnvios}
                    />
                  ),
                  reuniones: (
                    <ProgresoLinea
                      hecho={c.envioReunionesHechas}
                      total={c.totalEnvios}
                    />
                  ),
                  estado: <EstadoBadge estado={c.estado} />,
                };
                return (
                  <tr
                    key={c.id}
                    className="border-b hover:bg-muted/30 transition-colors"
                  >
                    {columnasRender.map((col) => (
                      <td key={col.campo} className="px-3 py-2 align-middle">
                        {cells[col.campo] ?? null}
                      </td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </ResizableColumnsProvider>

      <div className="text-xs text-muted-foreground text-right">
        {filtradas.length} de {campanas.length}{" "}
        {campanas.length === 1 ? "campaña" : "campañas"}
      </div>

      <NuevaCampanaDialog
        open={openDialog}
        onOpenChange={setOpenDialog}
        onCreada={() => startTransition(refresh)}
      />
    </div>
  );
}

function labelPeriodo(p: string): string {
  const [year, semestre] = p.split("-");
  return semestre === "S1" ? `${year} · S1` : `${year} · S2`;
}

function ProgresoLinea({ hecho, total }: { hecho: number; total: number }) {
  const pct = total > 0 ? Math.round((hecho / total) * 100) : 0;
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
        <div
          className="h-full bg-primary transition-all"
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-xs text-muted-foreground tabular-nums whitespace-nowrap">
        {hecho}/{total}
      </span>
    </div>
  );
}

function EstadoBadge({ estado }: { estado: CampanaResumen["estado"] }) {
  const cls =
    estado === "activa"
      ? "bg-emerald-500/15 text-emerald-700 border-emerald-200"
      : estado === "cerrada"
        ? "bg-blue-500/15 text-blue-700 border-blue-200"
        : "bg-muted text-muted-foreground border";
  const label = estado === "activa" ? "Activa" : estado === "cerrada" ? "Cerrada" : "Archivada";
  return (
    <Badge variant="outline" className={`text-[10px] ${cls}`}>
      {label}
    </Badge>
  );
}
