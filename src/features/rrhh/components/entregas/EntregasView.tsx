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
  AlertTriangle, CheckCircle2, RotateCcw, Mail, Undo2, PackageX, History,
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
  pedirDevolucion,
  cancelarDevolucion,
  reenviarEntregaAFirma,
} from "@/features/rrhh/actions/entregas-actions";
import {
  ESTADO_LABEL,
  ESTADO_COLOR,
  DEVOLUCION_LABEL,
  DEVOLUCION_COLOR,
  sePuedePedirDevolucion,
  sePuedeDarDeBajaPorMerma,
  type Entrega,
} from "@/features/rrhh/data/entregas";
import { HistorialEntregaDialog } from "@/features/rrhh/components/entregas/HistorialEntregaDialog";
import { MermaDialog } from "./MermaDialog";
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
  /** Id de la entrega cuya acción está en curso, para no repetir el clic. */
  const [accionando, setAccionando] = useState<string | null>(null);
  /** Entrega que se está dando de baja por deterioro. Null = diálogo cerrado. */
  const [mermaDe, setMermaDe] = useState<Entrega | null>(null);
  /** Entrega cuyo historial se está mirando. Null = diálogo cerrado. */
  const [historialDe, setHistorialDe] = useState<Entrega | null>(null);
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
        (e.item?.tipoNombre ?? "").toLowerCase().includes(q) ||
        (e.nota ?? "").toLowerCase().includes(q)
      );
    });
    list = aplicarFiltrosToolbar(list, filtros, acceso);
    list = aplicarOrdenToolbar(list, orden, acceso);
    return list;
  }, [entregas, busqueda, filtros, orden]);

  const stats = useMemo(() => {
    // Sin devolver = firmada, hay que devolverla, y aún no la ha devuelto.
    const pendientesDevolucion = entregas.filter(
      (e) =>
        e.estado === "firmada" &&
        e.item?.requiereDevolucion &&
        e.devolucionEstado !== "devuelta",
    ).length;
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

  /**
   * Pide la devolución: le manda al trabajador el acta para que firme que la ha
   * devuelto. No la marca como devuelta — eso lo hace su firma.
   */
  async function solicitarDevolucion(e: Entrega) {
    const ok = await confirm({
      // No borra nada: aquí "Borrar" en rojo se leía igual que "Cancelar".
      tono: "normal",
      confirmLabel: "Pedir la devolución",
      title: "Pedir la devolución",
      description: `Se le mandará a ${e.empleadoNombre} un correo para que firme que ha devuelto ${e.item?.tipoNombre ?? "el material"}. Queda devuelta cuando lo firme.`,
    });
    if (!ok) return;

    setAccionando(e.id);
    const res = await pedirDevolucion(e.id);
    setAccionando(null);
    if (!res.ok) { toast.error(res.error); return; }
    toast.success("Le hemos mandado el correo para firmar la devolución");
    void cargar();
  }

  /** Deshace una devolución pedida por error, si aún no la ha firmado. */
  async function anularDevolucion(e: Entrega) {
    setAccionando(e.id);
    const res = await cancelarDevolucion(e.id);
    setAccionando(null);
    if (!res.ok) { toast.error(res.error); return; }
    toast.success("Devolución cancelada");
    void cargar();
  }

  /** Vuelve a mandar el acta de entrega cuando el correo no salió o caducó. */
  async function reenviarFirmaEntrega(e: Entrega) {
    setAccionando(e.id);
    const res = await reenviarEntregaAFirma(e.id);
    setAccionando(null);
    if (!res.ok) { toast.error(res.error); return; }
    toast.success("Correo de firma reenviado");
    void cargar();
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
                <TableHead>Entregado</TableHead>
                <TableHead>Devuelto</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead>Devolución</TableHead>
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
                      <div className="flex items-center gap-2 text-sm">
                        {e.item?.categoria === "uniforme" ? (
                          <Shirt className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                        ) : (
                          <Package className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                        )}
                        <span
                          className={
                            e.devolucionEstado === "devuelta"
                              ? "text-muted-foreground line-through"
                              : ""
                          }
                        >
                          {e.item?.tipoNombre ?? "—"}
                          {e.item?.talla && ` · talla ${e.item.talla}`}
                        </span>
                      </div>
                      {e.nota && (
                        <p className="text-xs text-muted-foreground italic pt-1">{e.nota}</p>
                      )}
                    </div>
                  </TableCell>

                  <TableCell className="text-sm align-top whitespace-nowrap">{fmt(e.fecha)}</TableCell>

                  {/* Cuándo salió de sus manos: la firmó devuelta, o dada de baja. */}
                  <TableCell className="text-sm align-top whitespace-nowrap">
                    {e.devueltaEn || e.mermaEn ? (
                      fmt(e.devueltaEn ?? e.mermaEn)
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>

                  <TableCell className="align-top">
                    <Badge variant="outline" className={ESTADO_COLOR[e.estado]}>
                      {ESTADO_LABEL[e.estado]}
                    </Badge>
                  </TableCell>

                  <TableCell className="align-top">
                    {/* Solo tiene sentido hablar de devolución si hay que devolverlo. */}
                    {!e.item?.requiereDevolucion ? (
                      <span className="text-xs text-muted-foreground">—</span>
                    ) : e.devolucionEstado === "no_procede" ? (
                      <Badge
                        variant="outline"
                        className="text-[10px] bg-amber-50 text-amber-700 border-amber-200"
                      >
                        Sin devolver
                      </Badge>
                    ) : (
                      // La fecha vive en su propia columna: aquí solo el estado.
                      <Badge variant="outline" className={DEVOLUCION_COLOR[e.devolucionEstado]}>
                        {DEVOLUCION_LABEL[e.devolucionEstado]}
                      </Badge>
                    )}
                  </TableCell>

                  <TableCell className="text-right align-top">
                    <div className="flex items-center justify-end gap-1">
                      {/* El rastro de los correos y el documento firmado. */}
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setHistorialDe(e)}
                        title="Ver el documento firmado y el historial de correos"
                      >
                        <History className="h-4 w-4" />
                      </Button>

                      {/* Reenviar el acta de entrega si el correo no salió. */}
                      {(e.estado === "pendiente_firma" || e.estado === "borrador") && (
                        <Button
                          size="sm"
                          variant="ghost"
                          disabled={accionando === e.id}
                          onClick={() => void reenviarFirmaEntrega(e)}
                          title="Reenviar el correo de firma"
                        >
                          {accionando === e.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Mail className="h-4 w-4" />
                          )}
                        </Button>
                      )}

                      {/* Pedir la devolución: le manda el acta a firmar. */}
                      {sePuedePedirDevolucion(e) && (
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={accionando === e.id}
                          onClick={() => void solicitarDevolucion(e)}
                        >
                          {accionando === e.id ? (
                            <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                          ) : (
                            <RotateCcw className="h-4 w-4 mr-1" />
                          )}
                          Devolución
                        </Button>
                      )}

                      {/* Baja por deterioro: lo que se rompe no se devuelve. */}
                      {sePuedeDarDeBajaPorMerma(e) && (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-8 px-2 text-xs text-muted-foreground"
                          disabled={accionando === e.id}
                          onClick={() => setMermaDe(e)}
                          title="Dar de baja por rotura o desgaste"
                        >
                          <PackageX className="h-3.5 w-3.5 mr-1" />
                          Merma
                        </Button>
                      )}

                      {/* Deshacer una devolución o merma pedida por error. */}
                      {(e.devolucionEstado === "pendiente_firma" ||
                        e.devolucionEstado === "merma_pendiente_firma") && (
                        <Button
                          size="sm"
                          variant="ghost"
                          disabled={accionando === e.id}
                          onClick={() => void anularDevolucion(e)}
                          title="Cancelar la devolución pedida"
                        >
                          <Undo2 className="h-4 w-4" />
                        </Button>
                      )}

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
                    </div>
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

      <HistorialEntregaDialog
        entrega={historialDe}
        onOpenChange={(abierto) => { if (!abierto) setHistorialDe(null); }}
      />

      <MermaDialog
        entrega={mermaDe}
        onOpenChange={(abierto) => { if (!abierto) setMermaDe(null); }}
        onHecho={() => { setMermaDe(null); void cargar(); }}
      />
    </div>
  );
}
