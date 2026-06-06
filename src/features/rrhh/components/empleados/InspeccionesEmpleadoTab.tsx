"use client";

import { useCallback, useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { FileSearch, CheckCircle2, Loader2, Eye } from "lucide-react";
import { toast } from "sonner";
import {
  listInspeccionesEmpleado,
  getInspeccionEmpleadoDetalle,
  type InspeccionEmpleadoItem,
  type InspeccionEmpleadoDetalle,
} from "@/features/rrhh/actions/inspecciones-empleado-actions";
import { useGlobalLoadingSync } from "@/shared/hooks/use-global-loading-sync";

const ESTADO_LABEL: Record<InspeccionEmpleadoItem["estado"], string> = {
  pendiente_revision: "Pendiente de revisión",
  revisado: "Revisada",
  archivado: "Archivada",
};

const ESTADO_COLOR: Record<InspeccionEmpleadoItem["estado"], string> = {
  pendiente_revision: "border-amber-300 text-amber-700 bg-amber-50",
  revisado: "border-emerald-300 text-emerald-700 bg-emerald-50",
  archivado: "border-muted text-muted-foreground bg-muted/40",
};

const VINCULO_LABEL: Record<InspeccionEmpleadoItem["vinculo"], string> = {
  verificada: "Verificada por él",
  jefe_sala: "Jefe de sala",
};

function fmtFecha(s: string | null): string {
  if (!s) return "—";
  try {
    return new Date(s).toLocaleDateString("es-ES", {
      day: "2-digit", month: "2-digit", year: "numeric",
    });
  } catch { return s; }
}

function notaColor(n: number): string {
  if (n >= 8) return "text-emerald-700";
  if (n >= 5) return "text-amber-700";
  return "text-red-700";
}

export function InspeccionesEmpleadoTab({ empleadoId }: { empleadoId: string }) {
  const [items, setItems] = useState<InspeccionEmpleadoItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [detalle, setDetalle] = useState<InspeccionEmpleadoDetalle | null>(null);
  const [cargandoDetalle, setCargandoDetalle] = useState(false);
  const [abierto, setAbierto] = useState(false);
  useGlobalLoadingSync(loading);

  const cargar = useCallback(async () => {
    setLoading(true);
    const res = await listInspeccionesEmpleado(empleadoId);
    setLoading(false);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    setItems(res.data);
  }, [empleadoId]);

  useEffect(() => { void cargar(); }, [cargar]);

  async function abrirDetalle(envioId: string) {
    setAbierto(true);
    setDetalle(null);
    setCargandoDetalle(true);
    const res = await getInspeccionEmpleadoDetalle(envioId);
    setCargandoDetalle(false);
    if (!res.ok) {
      toast.error(res.error);
      setAbierto(false);
      return;
    }
    setDetalle(res.data);
  }

  const stats = {
    total: items.length,
    verificadas: items.filter((i) => i.vinculo === "verificada").length,
    jefeSala: items.filter((i) => i.vinculo === "jefe_sala").length,
  };

  return (
    <div className="p-6 space-y-4">
      <div>
        <h3 className="text-lg font-semibold text-foreground flex items-center gap-2">
          <FileSearch className="h-5 w-5 text-primary" />
          Inspecciones
        </h3>
        <p className="text-xs text-muted-foreground mt-0.5">
          {items.length > 0
            ? `${stats.total} en total · ${stats.verificadas} verificadas por él · ${stats.jefeSala} como jefe de sala`
            : "Solo lectura"}
        </p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16 text-muted-foreground text-sm gap-2">
          <Loader2 className="h-4 w-4 animate-spin" /> Cargando…
        </div>
      ) : items.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <FileSearch className="h-12 w-12 text-muted-foreground/30 mb-3" />
          <p className="text-sm text-muted-foreground">
            No existe aún ninguna inspección vinculada a su nombre.
          </p>
        </div>
      ) : (
        <div className="rounded-lg border bg-card overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nº</TableHead>
                <TableHead>Local</TableHead>
                <TableHead>Inspector</TableHead>
                <TableHead>Fecha</TableHead>
                <TableHead>Vínculo</TableHead>
                <TableHead>Nota</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead className="text-right">Ver</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((i) => (
                <TableRow key={i.id}>
                  <TableCell className="font-mono text-xs text-muted-foreground">
                    #{i.numero_secuencial ?? "—"}
                  </TableCell>
                  <TableCell className="text-sm">{i.local_nombre ?? "—"}</TableCell>
                  <TableCell className="text-sm">{i.nombre_inspector}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {fmtFecha(i.fecha_inspeccion)}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant="outline"
                      className={
                        i.vinculo === "verificada"
                          ? "gap-1 border-emerald-300 text-emerald-700 bg-emerald-50"
                          : "gap-1"
                      }
                    >
                      {i.vinculo === "verificada" && <CheckCircle2 className="h-3 w-3" />}
                      {VINCULO_LABEL[i.vinculo]}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {i.nota_final != null ? (
                      <span className={`font-semibold ${notaColor(i.nota_final)}`}>
                        {i.nota_final.toFixed(2)}
                      </span>
                    ) : (
                      "—"
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className={ESTADO_COLOR[i.estado]}>
                      {ESTADO_LABEL[i.estado]}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => abrirDetalle(i.id)}
                      title="Ver inspección (solo lectura)"
                    >
                      <Eye className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <Dialog open={abierto} onOpenChange={setAbierto}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileSearch className="h-5 w-5 text-primary" />
              Inspección {detalle?.numero_secuencial ? `#${detalle.numero_secuencial}` : ""}
            </DialogTitle>
            <DialogDescription>
              Vista de solo lectura. La gestión de inspecciones vive en el módulo de Calidad.
            </DialogDescription>
          </DialogHeader>

          {cargandoDetalle || !detalle ? (
            <div className="flex items-center justify-center py-16 text-muted-foreground text-sm gap-2">
              <Loader2 className="h-4 w-4 animate-spin" /> Cargando…
            </div>
          ) : (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <Campo label="Local" value={detalle.local_nombre ?? "—"} />
                <Campo label="Fecha" value={fmtFecha(detalle.fecha_inspeccion)} />
                <Campo label="Inspector" value={detalle.nombre_inspector} />
                <Campo label="Jefe de sala" value={detalle.nombre_jefe_sala ?? "—"} />
                <Campo label="Plantilla" value={detalle.plantilla_nombre ?? "—"} />
                <Campo
                  label="Nota final"
                  value={
                    detalle.nota_final != null ? detalle.nota_final.toFixed(2) : "—"
                  }
                />
              </div>

              {detalle.notas_calidad && (
                <div className="rounded-lg border bg-muted/30 p-3 text-sm">
                  <p className="text-xs font-medium text-muted-foreground mb-1">Notas de calidad</p>
                  <p className="whitespace-pre-wrap">{detalle.notas_calidad}</p>
                </div>
              )}

              {detalle.respuestas.length > 0 && (
                <div className="space-y-3">
                  {agruparPorSeccion(detalle.respuestas).map((sec) => (
                    <div key={sec.titulo} className="rounded-lg border bg-card overflow-hidden">
                      <div className="bg-muted/40 px-3 py-2 text-sm font-medium">{sec.titulo}</div>
                      <div className="divide-y">
                        {sec.respuestas.map((r) => (
                          <div key={r.id} className="px-3 py-2.5">
                            <p className="text-sm text-muted-foreground">{r.enunciado}</p>
                            <p className="text-sm font-medium mt-0.5">
                              {r.valor_numero != null
                                ? `${r.valor_numero}${r.escala_max ? ` / ${r.escala_max}` : ""}`
                                : r.valor_texto?.trim() || "—"}
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Campo({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="font-medium">{value}</p>
    </div>
  );
}

function agruparPorSeccion(respuestas: InspeccionEmpleadoDetalle["respuestas"]) {
  const grupos: { titulo: string; respuestas: typeof respuestas }[] = [];
  for (const r of respuestas) {
    let g = grupos.find((x) => x.titulo === r.seccion_titulo);
    if (!g) {
      g = { titulo: r.seccion_titulo, respuestas: [] };
      grupos.push(g);
    }
    g.respuestas.push(r);
  }
  return grupos;
}
