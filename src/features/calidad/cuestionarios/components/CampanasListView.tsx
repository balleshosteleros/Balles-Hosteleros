"use client";

import { useState, useEffect, useMemo, useTransition } from "react";
import Link from "next/link";
import { ClipboardList } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { SubmoduleToolbar } from "@/shared/components/SubmoduleToolbar";
import { ResizableColumnsProvider } from "@/shared/components/ResizableColumns";
import { TableColumnHeader } from "@/shared/components/TableColumnHeader";
import { LoadingSpinner } from "@/shared/components/LoadingSpinner";
import { NuevaCampanaDialog } from "./NuevaCampanaDialog";
import { listCampanas } from "@/features/calidad/cuestionarios/actions";
import type { CampanaResumen } from "@/features/calidad/cuestionarios/types";

interface Props {
  onAbrirPlantillas: () => void;
}

export function CampanasListView({ onAbrirPlantillas }: Props) {
  const [campanas, setCampanas] = useState<CampanaResumen[]>([]);
  const [loading, setLoading] = useState(true);
  const [busqueda, setBusqueda] = useState("");
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

  return (
    <div className="space-y-4">
      <SubmoduleToolbar
        busqueda={busqueda}
        onBusquedaChange={setBusqueda}
        placeholderBusqueda="Buscar campaña"
        onNuevo={() => setOpenDialog(true)}
        textoNuevo="Nueva campaña"
        extraDerecha={
          <Button
            variant="outline"
            size="sm"
            onClick={onAbrirPlantillas}
            className="h-9 gap-2"
          >
            <ClipboardList className="h-4 w-4" strokeWidth={1.75} />
            Plantillas
          </Button>
        }
      />

      <ResizableColumnsProvider storageKey="calidad-cuestionarios-campanas">
        <div className="bg-card rounded-lg border overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <TableColumnHeader label="Periodo" />
                <TableColumnHeader label="Cuestionario" />
                <TableColumnHeader label="Respondidos" />
                <TableColumnHeader label="Reuniones" />
                <TableColumnHeader label="Estado" />
              </tr>
            </thead>
            <tbody>
              {loading && campanas.length === 0 && (
                <tr>
                  <td colSpan={5} className="text-center py-10">
                    <LoadingSpinner />
                  </td>
                </tr>
              )}
              {!loading && filtradas.length === 0 && (
                <tr>
                  <td colSpan={5} className="text-center py-10 text-muted-foreground">
                    {campanas.length === 0
                      ? "Aún no hay campañas. Crea la primera con + Nueva campaña."
                      : "Ninguna campaña coincide con la búsqueda."}
                  </td>
                </tr>
              )}
              {filtradas.map((c) => (
                <tr
                  key={c.id}
                  className="border-b hover:bg-muted/30 transition-colors"
                >
                  <td className="px-3 py-2.5">
                    <Link
                      href={`/calidad/cuestionarios/${c.id}`}
                      className="font-medium hover:underline"
                    >
                      {labelPeriodo(c.periodo)}
                    </Link>
                  </td>
                  <td className="px-3 py-2.5">{c.plantillaNombre}</td>
                  <td className="px-3 py-2.5 w-48">
                    <ProgresoLinea
                      hecho={c.envioRespondidos}
                      total={c.totalEnvios}
                    />
                  </td>
                  <td className="px-3 py-2.5 w-48">
                    <ProgresoLinea
                      hecho={c.envioReunionesHechas}
                      total={c.totalEnvios}
                    />
                  </td>
                  <td className="px-3 py-2.5">
                    <EstadoBadge estado={c.estado} />
                  </td>
                </tr>
              ))}
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
