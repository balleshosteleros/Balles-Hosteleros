"use client";

import { useEffect, useState, useCallback } from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { ClipboardCheck } from "lucide-react";
import { listEnvios, type EnvioResumen } from "@/features/calidad/actions/envios-actions";
import {
  SubmoduleToolbar,
  type ToolbarColumna,
  type ToolbarColumnaVisible,
  coincideBusquedaUniversal,
  ordenarColumnas,
  colVisible,
} from "@/shared/components/SubmoduleToolbar";
import { ResizableColumnsProvider } from "@/shared/components/ResizableColumns";
import { LoadingSpinner } from "@/shared/components/LoadingSpinner";

const columnasDef: ToolbarColumna[] = [
  { campo: "numero_secuencial", label: "Nº", bloqueada: true },
  { campo: "fecha", label: "Fecha" },
  { campo: "plantilla_nombre", label: "Plantilla" },
  { campo: "version", label: "Versión" },
  { campo: "local_nombre", label: "Local" },
  { campo: "auditor_nombre", label: "Auditor" },
  { campo: "nota_final", label: "Nota final" },
  { campo: "estado", label: "Estado" },
];

function formatFecha(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("es-ES", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function NotaBadge({ nota }: { nota: number | null }) {
  if (nota === null) return <span className="text-muted-foreground">—</span>;
  const color =
    nota >= 9 ? "bg-emerald-100 text-emerald-700" :
    nota >= 7 ? "bg-blue-100 text-blue-700" :
    nota >= 5 ? "bg-amber-100 text-amber-700" :
    "bg-red-100 text-red-700";
  return <Badge className={`tabular-nums font-mono ${color} hover:${color}`}>{nota.toFixed(2).replace(".", ",")}</Badge>;
}

export function EnviosListView() {
  const [envios, setEnvios] = useState<EnvioResumen[]>([]);
  const [loading, setLoading] = useState(true);
  const [busqueda, setBusqueda] = useState("");
  const [columnasVisibles, setColumnasVisibles] = useState<ToolbarColumnaVisible>({});
  const [columnasOrden, setColumnasOrden] = useState<string[]>(columnasDef.map((c) => c.campo));

  const reload = useCallback(() => {
    setLoading(true);
    listEnvios().then((d) => {
      setEnvios(d);
      setLoading(false);
    });
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  const filtrados = envios.filter((e) => coincideBusquedaUniversal(e, busqueda));
  const columnasRender = ordenarColumnas(columnasDef, columnasOrden).filter(
    (c) => c.bloqueada || colVisible(columnasVisibles, c.campo),
  );

  if (!loading && envios.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-16 text-center">
          <ClipboardCheck className="h-12 w-12 text-muted-foreground/50 mb-4" />
          <h3 className="text-lg font-semibold text-foreground">Aún no hay auditorías realizadas</h3>
          <p className="text-sm text-muted-foreground max-w-md mt-2">
            Las auditorías rellenadas aparecerán aquí. La creación y el rellenado se construirán
            en la siguiente fase.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <SubmoduleToolbar
        busqueda={busqueda}
        onBusquedaChange={setBusqueda}
        placeholderBusqueda="Buscar auditoría"
        columnas={columnasDef}
        columnasVisibles={columnasVisibles}
        onColumnasVisiblesChange={setColumnasVisibles}
        columnasOrden={columnasOrden}
        onColumnasOrdenChange={setColumnasOrden}
      />

      <ResizableColumnsProvider storageKey="calidad-auditorias-envios">
        <div className="bg-card rounded-lg border overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                {columnasRender.map((c) => (
                  <th key={c.campo} className="text-left px-3 py-2 font-medium text-foreground">{c.label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={columnasRender.length} className="text-center py-10"><LoadingSpinner /></td></tr>
              ) : filtrados.length === 0 ? (
                <tr><td colSpan={columnasRender.length} className="text-center py-10 text-muted-foreground">Ninguna auditoría coincide con la búsqueda.</td></tr>
              ) : (
                filtrados.map((e) => (
                  <tr key={e.id} className="border-b hover:bg-muted/30 transition-colors">
                    {columnasRender.map((c) => {
                      const cells: Record<string, React.ReactNode> = {
                        numero_secuencial: <span className="font-mono text-xs text-muted-foreground">{e.numero_secuencial}</span>,
                        fecha: <span className="tabular-nums">{formatFecha(e.fecha)}</span>,
                        plantilla_nombre: <span>{e.plantilla_nombre}</span>,
                        version: <Badge variant="outline" className="text-[10px]">v{e.version}</Badge>,
                        local_nombre: <span>{e.local_nombre}</span>,
                        auditor_nombre: <span>{e.auditor_nombre}</span>,
                        nota_final: <NotaBadge nota={e.nota_final} />,
                        estado: e.estado === "enviada" ? (
                          <Badge className="text-[10px] bg-emerald-100 text-emerald-700 hover:bg-emerald-100">Enviada</Badge>
                        ) : (
                          <Badge variant="outline" className="text-[10px]">Borrador</Badge>
                        ),
                      };
                      return <td key={c.campo} className="px-3 py-2 align-middle">{cells[c.campo] ?? null}</td>;
                    })}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </ResizableColumnsProvider>

      <div className="text-xs text-muted-foreground text-right">
        {filtrados.length} de {envios.length} auditorías
      </div>
    </div>
  );
}
