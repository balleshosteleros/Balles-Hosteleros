"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  ArrowLeft, Settings, PackageCheck, Shirt, Package, Trash2, Loader2,
  AlertTriangle, CheckCircle2, RotateCcw,
} from "lucide-react";
import { toast } from "sonner";
import {
  SubmoduleToolbar,
  aplicarFiltrosToolbar,
  aplicarOrdenToolbar,
  type ToolbarFiltroActivo,
  type ToolbarOrdenActivo,
} from "@/shared/components/SubmoduleToolbar";
import { useConfirmDelete } from "@/shared/components/ConfirmDeleteDialog";
import { useGlobalLoadingSync } from "@/shared/hooks/use-global-loading-sync";
import { useEmpresa } from "@/features/empresa/contexts/empresa-context";
import { formatFechaEnZona } from "@/features/empresa/lib/zona-horaria";
import {
  listEntregas,
  borrarEntrega,
  marcarItemDevuelto,
} from "@/features/rrhh/actions/entregas-actions";
import {
  ESTADO_LABEL,
  ESTADO_COLOR,
  type Entrega,
} from "@/features/rrhh/data/entregas";
import { TiposMaterialConfig } from "./TiposMaterialConfig";
import { NuevaEntregaDialog } from "./NuevaEntregaDialog";

/**
 * Submódulo Entregas: histórico de todo el uniforme y material entregado.
 * El engranaje abre el catálogo de tipos que la empresa se configura.
 */

function KPI({
  titulo, valor, Icono, color,
}: {
  titulo: string;
  valor: number;
  Icono: React.ElementType;
  color?: string;
}) {
  return (
    <Card>
      <CardContent className="p-4 flex items-center gap-3">
        <div className="h-10 w-10 rounded-lg bg-muted flex items-center justify-center shrink-0">
          <Icono className={`h-5 w-5 ${color ?? "text-primary"}`} />
        </div>
        <div className="min-w-0">
          <p className="text-xs text-muted-foreground">{titulo}</p>
          <p className="text-xl font-semibold text-foreground">{valor}</p>
        </div>
      </CardContent>
    </Card>
  );
}

export function EntregasView() {
  const { empresaActual } = useEmpresa();
  const [entregas, setEntregas] = useState<Entrega[]>([]);
  const [loading, setLoading] = useState(true);
  const [showConfig, setShowConfig] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [busqueda, setBusqueda] = useState("");
  const [filtros, setFiltros] = useState<ToolbarFiltroActivo[]>([]);
  const [orden, setOrden] = useState<ToolbarOrdenActivo | null>(null);
  const { confirm, dialog } = useConfirmDelete();
  useGlobalLoadingSync(loading);

  const cargar = useCallback(async () => {
    setLoading(true);
    const data = await listEntregas();
    setEntregas(data);
    setLoading(false);
  }, []);

  useEffect(() => { void cargar(); }, [cargar]);

  const fmt = (s: string | null): string => {
    if (!s) return "—";
    return formatFechaEnZona(s, empresaActual.zonaHoraria) || s;
  };

  const acceso = (e: Entrega, campo: string): unknown => {
    if (campo === "empleado") return e.empleadoNombre;
    if (campo === "estado") return ESTADO_LABEL[e.estado];
    if (campo === "fecha") return e.fecha;
    return (e as unknown as Record<string, unknown>)[campo];
  };

  const filtradas = useMemo(() => {
    let list = entregas.filter((e) => {
      if (!busqueda) return true;
      const q = busqueda.toLowerCase();
      return (
        e.empleadoNombre.toLowerCase().includes(q) ||
        e.items.some((i) => i.tipoNombre.toLowerCase().includes(q)) ||
        (e.nota ?? "").toLowerCase().includes(q)
      );
    });
    list = aplicarFiltrosToolbar(list, filtros, acceso);
    list = aplicarOrdenToolbar(list, orden, acceso);
    return list;
  }, [entregas, busqueda, filtros, orden]);

  const stats = useMemo(() => {
    const pendientesDevolucion = entregas
      .flatMap((e) => e.items)
      .filter((i) => i.requiereDevolucion && !i.devueltoEn).length;
    return {
      total: entregas.length,
      firmadas: entregas.filter((e) => e.estado === "firmada").length,
      pendientesFirma: entregas.filter((e) => e.estado === "pendiente_firma").length,
      pendientesDevolucion,
    };
  }, [entregas]);

  async function borrar(e: Entrega) {
    const ok = await confirm({
      title: "Borrar entrega",
      description: `Se eliminará la entrega a ${e.empleadoNombre} del ${fmt(e.fecha)}. Esta acción no se puede deshacer.`,
    });
    if (!ok) return;
    const res = await borrarEntrega(e.id);
    if (!res.ok) { toast.error(res.error); return; }
    setEntregas((prev) => prev.filter((x) => x.id !== e.id));
    toast.success("Entrega borrada");
  }

  async function alternarDevuelto(entregaId: string, itemId: string, devuelto: boolean) {
    const res = await marcarItemDevuelto(itemId, devuelto);
    if (!res.ok) { toast.error(res.error); return; }
    setEntregas((prev) =>
      prev.map((e) =>
        e.id !== entregaId
          ? e
          : {
              ...e,
              items: e.items.map((i) =>
                i.id === itemId ? { ...i, devueltoEn: devuelto ? new Date().toISOString() : null } : i,
              ),
            },
      ),
    );
    toast.success(devuelto ? "Marcado como devuelto" : "Marca de devolución quitada");
  }

  if (showConfig) {
    return (
      <div className="p-4 md:p-6 max-w-7xl mx-auto space-y-5">
        <Button variant="ghost" size="sm" onClick={() => setShowConfig(false)}>
          <ArrowLeft className="h-4 w-4 mr-1" />
          Volver a entregas
        </Button>
        <TiposMaterialConfig />
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto space-y-5 pb-28">
      {dialog}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KPI titulo="Entregas" valor={stats.total} Icono={PackageCheck} />
        <KPI titulo="Firmadas" valor={stats.firmadas} Icono={CheckCircle2} color="text-emerald-600" />
        <KPI titulo="Pendientes de firma" valor={stats.pendientesFirma} Icono={Loader2} color="text-amber-600" />
        <KPI titulo="Sin devolver" valor={stats.pendientesDevolucion} Icono={AlertTriangle} color="text-rose-600" />
      </div>

      <SubmoduleToolbar
        busqueda={busqueda}
        onBusquedaChange={setBusqueda}
        placeholderBusqueda="Buscar"
        onNuevo={() => setDialogOpen(true)}
        filtros={filtros}
        onFiltrosChange={setFiltros}
        orden={orden}
        onOrdenChange={setOrden}
        extraDerecha={
          <Button
            size="icon"
            variant="outline"
            className="h-9 w-9"
            onClick={() => setShowConfig(true)}
            title="Configuración"
            aria-label="Configuración"
          >
            <Settings className="h-4 w-4" strokeWidth={1.75} />
          </Button>
        }
      />

      {loading ? (
        <div className="flex items-center justify-center py-16 text-muted-foreground text-sm gap-2">
          <Loader2 className="h-4 w-4 animate-spin" /> Cargando…
        </div>
      ) : filtradas.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <PackageCheck className="h-12 w-12 text-muted-foreground/30 mb-3" />
          <p className="text-sm text-muted-foreground">
            {entregas.length === 0
              ? "Todavía no se ha registrado ninguna entrega."
              : "No hay entregas que coincidan con la búsqueda."}
          </p>
        </div>
      ) : (
        <div className="rounded-lg border bg-card overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Trabajador</TableHead>
                <TableHead>Qué se entregó</TableHead>
                <TableHead>Fecha</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtradas.map((e) => (
                <TableRow key={e.id}>
                  <TableCell className="font-medium align-top">
                    <div className="line-clamp-1">{e.empleadoNombre || "—"}</div>
                    {e.entregadoPorNombre && (
                      <div className="text-xs text-muted-foreground">
                        Entregado por {e.entregadoPorNombre}
                      </div>
                    )}
                  </TableCell>

                  <TableCell className="align-top max-w-md">
                    <div className="space-y-1">
                      {e.items.map((i) => (
                        <div key={i.id} className="flex items-center gap-2 text-sm">
                          {i.categoria === "uniforme" ? (
                            <Shirt className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                          ) : (
                            <Package className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                          )}
                          <span className={i.devueltoEn ? "text-muted-foreground line-through" : ""}>
                            {i.cantidad > 1 && `${i.cantidad}× `}
                            {i.tipoNombre}
                            {i.talla && ` · talla ${i.talla}`}
                          </span>
                          {i.requiereDevolucion && (
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-6 px-1.5 text-[10px]"
                              onClick={() => void alternarDevuelto(e.id, i.id, !i.devueltoEn)}
                              title={i.devueltoEn ? "Quitar la marca de devuelto" : "Marcar como devuelto"}
                            >
                              {i.devueltoEn ? (
                                <>
                                  <RotateCcw className="h-3 w-3 mr-1" />
                                  Devuelto
                                </>
                              ) : (
                                <Badge variant="outline" className="text-[10px] bg-amber-50 text-amber-700 border-amber-200">
                                  Sin devolver
                                </Badge>
                              )}
                            </Button>
                          )}
                        </div>
                      ))}
                      {e.nota && (
                        <p className="text-xs text-muted-foreground italic pt-1">{e.nota}</p>
                      )}
                    </div>
                  </TableCell>

                  <TableCell className="text-sm align-top whitespace-nowrap">{fmt(e.fecha)}</TableCell>

                  <TableCell className="align-top">
                    <Badge variant="outline" className={ESTADO_COLOR[e.estado]}>
                      {ESTADO_LABEL[e.estado]}
                    </Badge>
                  </TableCell>

                  <TableCell className="text-right align-top">
                    {e.estado !== "firmada" && (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-destructive hover:text-destructive"
                        onClick={() => void borrar(e)}
                        title="Borrar entrega"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <NuevaEntregaDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onCreada={() => void cargar()}
      />
    </div>
  );
}
