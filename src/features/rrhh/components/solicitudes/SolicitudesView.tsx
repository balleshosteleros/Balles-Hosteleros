"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useTabQuery } from "@/shared/hooks/use-tab-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { CheckCircle2, XCircle, Loader2, Inbox, Settings, Lock } from "lucide-react";
import {
  SubmoduleToolbar,
  aplicarFiltrosToolbar,
  aplicarOrdenToolbar,
  colVisible,
  ordenarColumnas,
  type ToolbarFiltroActivo,
  type ToolbarOrdenActivo,
  type ToolbarColumnaVisible,
  type ToolbarColumna,
} from "@/shared/components/SubmoduleToolbar";
import { toast } from "sonner";
import {
  aprobarSolicitud,
  listarSolicitudesEmpresa,
  rechazarSolicitud,
} from "@/features/mi-panel/actions/mi-panel-actions";
import type { SolicitudPersonal } from "@/features/mi-panel/types";
import {
  ESTADO_COLOR,
  ESTADO_LABEL,
  SUBTIPO_LABEL,
} from "@/features/mi-panel/types";

function formatFecha(s: string | null): string {
  if (!s) return "—";
  try {
    const [y, m, d] = s.split("-");
    return `${d}/${m}/${y}`;
  } catch {
    return s;
  }
}

function formatFechaHora(s: string): string {
  try {
    return new Date(s).toLocaleString("es-ES", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return s;
  }
}

type Modo = "aprobar" | "rechazar";

type SolicitudConFlag = SolicitudPersonal & { puedoValidar?: boolean };

export function SolicitudesView() {
  const [tab, setTab] = useTabQuery(["pendientes", "todas"] as const, "pendientes");
  const [items, setItems] = useState<SolicitudConFlag[]>([]);
  const [loading, setLoading] = useState(true);
  const [busqueda, setBusqueda] = useState("");
  const [filtros, setFiltros] = useState<ToolbarFiltroActivo[]>([]);
  const [orden, setOrden] = useState<ToolbarOrdenActivo | null>(null);
  const [columnasVisibles, setColumnasVisibles] = useState<ToolbarColumnaVisible>({});
  const [columnasOrden, setColumnasOrden] = useState<string[] | undefined>(undefined);

  const [revisando, setRevisando] = useState<SolicitudPersonal | null>(null);
  const [modo, setModo] = useState<Modo>("aprobar");
  const [notas, setNotas] = useState("");
  const [working, setWorking] = useState(false);
  const [showConfig, setShowConfig] = useState(false);

  async function load() {
    setLoading(true);
    const res = await listarSolicitudesEmpresa(tab);
    setItems(res.ok ? res.data : []);
    setLoading(false);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  const acceso = (s: SolicitudPersonal, campo: string): unknown => {
    if (campo === "tipo") return s.tipo === "ausencia" ? "Ausencia" : "Trabajo";
    if (campo === "subtipo") return SUBTIPO_LABEL[s.subtipo];
    if (campo === "estado") return ESTADO_LABEL[s.estado];
    if (campo === "empleado") return s.empleadoNombre;
    if (campo === "fechaInicio") return s.fechaInicio;
    if (campo === "createdAt") return s.createdAt;
    return (s as unknown as Record<string, unknown>)[campo];
  };

  const filtrados = useMemo(() => {
    let lista = items;
    if (busqueda.trim()) {
      const q = busqueda.toLowerCase();
      lista = lista.filter(
        (s) =>
          s.empleadoNombre.toLowerCase().includes(q) ||
          SUBTIPO_LABEL[s.subtipo].toLowerCase().includes(q) ||
          s.motivo.toLowerCase().includes(q),
      );
    }
    lista = aplicarFiltrosToolbar(lista, filtros, acceso);
    lista = aplicarOrdenToolbar(lista, orden, acceso);
    return lista;
  }, [items, busqueda, filtros, orden]);

  const puedoValidarIds = useMemo(
    () => new Set(items.filter((s) => s.puedoValidar).map((s) => s.id)),
    [items],
  );

  function abrirRevision(sol: SolicitudPersonal, m: Modo) {
    if (!puedoValidarIds.has(sol.id)) {
      toast.error("Solo el validador asignado de este empleado puede gestionar esta solicitud.");
      return;
    }
    setRevisando(sol);
    setModo(m);
    setNotas("");
  }

  async function confirmar() {
    if (!revisando) return;
    setWorking(true);
    const fn = modo === "aprobar" ? aprobarSolicitud : rechazarSolicitud;
    const res = await fn(revisando.id, notas.trim() || undefined);
    setWorking(false);
    if (!res.ok) {
      toast.error(res.error || "No se pudo procesar la solicitud");
      return;
    }
    toast.success(modo === "aprobar" ? "Solicitud aprobada" : "Solicitud rechazada");
    setRevisando(null);
    setNotas("");
    await load();
  }

  const columnasDef: ToolbarColumna[] = [
    { campo: "empleado", label: "Empleado", bloqueada: true },
    { campo: "tipo", label: "Tipo" },
    { campo: "fechas", label: "Fechas" },
    { campo: "motivo", label: "Motivo" },
    { campo: "enviada", label: "Enviada" },
    { campo: "estado", label: "Estado" },
  ];

  const columnDefs: Record<string, { th: ReactNode; td: (s: SolicitudPersonal) => ReactNode }> = {
    empleado: {
      th: <TableHead key="empleado">Empleado</TableHead>,
      td: (s) => <TableCell key="empleado" className="font-medium">{s.empleadoNombre}</TableCell>,
    },
    tipo: {
      th: <TableHead key="tipo">Tipo</TableHead>,
      td: (s) => (
        <TableCell key="tipo">
          <div className="flex flex-col">
            <span className="text-xs uppercase text-muted-foreground">
              {s.tipo === "ausencia" ? "Ausencia" : "Trabajo"}
            </span>
            <span>{SUBTIPO_LABEL[s.subtipo]}</span>
          </div>
        </TableCell>
      ),
    },
    fechas: {
      th: <TableHead key="fechas">Fechas</TableHead>,
      td: (s) => (
        <TableCell key="fechas" className="text-sm">
          {formatFecha(s.fechaInicio)}
          {s.fechaFin && s.fechaFin !== s.fechaInicio && (
            <> – {formatFecha(s.fechaFin)}</>
          )}
          {s.horas != null && (
            <span className="text-muted-foreground"> · {s.horas}h</span>
          )}
        </TableCell>
      ),
    },
    motivo: {
      th: <TableHead key="motivo">Motivo</TableHead>,
      td: (s) => (
        <TableCell key="motivo" className="max-w-[260px]">
          <span className="text-sm text-muted-foreground line-clamp-2">
            {s.motivo || "—"}
          </span>
        </TableCell>
      ),
    },
    enviada: {
      th: <TableHead key="enviada">Enviada</TableHead>,
      td: (s) => (
        <TableCell key="enviada" className="text-xs text-muted-foreground">
          {formatFechaHora(s.createdAt)}
        </TableCell>
      ),
    },
    estado: {
      th: <TableHead key="estado">Estado</TableHead>,
      td: (s) => (
        <TableCell key="estado">
          <Badge variant="outline" className={ESTADO_COLOR[s.estado]}>
            {ESTADO_LABEL[s.estado]}
          </Badge>
        </TableCell>
      ),
    },
  };

  const columnasRender = ordenarColumnas(columnasDef, columnasOrden).filter(
    (c) => c.bloqueada || colVisible(columnasVisibles, c.campo),
  );

  return (
    <div className="p-6 space-y-6">
      {/* Tabs + buscador */}
      <Tabs value={tab} onValueChange={(v) => setTab(v as "pendientes" | "todas")}>
        <TabsList>
          <TabsTrigger value="pendientes">Pendientes</TabsTrigger>
          <TabsTrigger value="todas">Historial</TabsTrigger>
        </TabsList>

        <TabsContent value={tab} className="mt-4 space-y-4">
          <SubmoduleToolbar
            busqueda={busqueda}
            onBusquedaChange={setBusqueda}
            placeholderBusqueda="Buscar"
            ocultarNuevo
            filtros={filtros}
            onFiltrosChange={setFiltros}
            orden={orden}
            onOrdenChange={setOrden}
            columnas={columnasDef}
            columnasVisibles={columnasVisibles}
            onColumnasVisiblesChange={setColumnasVisibles}
            columnasOrden={columnasOrden}
            onColumnasOrdenChange={setColumnasOrden}
            extraDerecha={
              <Button
                size="icon"
                variant={showConfig ? "default" : "outline"}
                className="h-9 w-9"
                onClick={() => setShowConfig((v) => !v)}
                title="Configuración"
                aria-label="Configuración"
              >
                <Settings className="h-4 w-4" strokeWidth={1.75} />
              </Button>
            }
          />
          <Card>
            {loading ? (
              <div className="flex items-center justify-center h-40 text-muted-foreground">
                <Loader2 className="h-5 w-5 animate-spin" />
              </div>
            ) : filtrados.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-40 text-muted-foreground text-sm">
                <Inbox className="h-6 w-6 mb-1" />
                {tab === "pendientes"
                  ? "No hay solicitudes pendientes."
                  : "No hay solicitudes que mostrar."}
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    {columnasRender.map((c) => columnDefs[c.campo]?.th)}
                    <TableHead className="text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtrados.map((s) => (
                    <TableRow key={s.id}>
                      {columnasRender.map((c) => columnDefs[c.campo]?.td(s))}
                      <TableCell className="text-right">
                        {s.estado === "pendiente" ? (
                          puedoValidarIds.has(s.id) ? (
                            <div className="flex justify-end gap-1">
                              <Button
                                size="sm"
                                variant="outline"
                                className="text-rose-600 hover:bg-rose-50"
                                onClick={() => abrirRevision(s, "rechazar")}
                              >
                                <XCircle className="h-4 w-4 mr-1" />
                                Rechazar
                              </Button>
                              <Button
                                size="sm"
                                className="bg-emerald-600 hover:bg-emerald-700"
                                onClick={() => abrirRevision(s, "aprobar")}
                              >
                                <CheckCircle2 className="h-4 w-4 mr-1" />
                                Aprobar
                              </Button>
                            </div>
                          ) : (
                            <div className="flex items-center justify-end gap-1.5 text-xs text-muted-foreground">
                              <Lock className="h-3.5 w-3.5" />
                              <span>Solo su validador</span>
                            </div>
                          )
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </Card>
        </TabsContent>
      </Tabs>

      {/* Diálogo de aprobación / rechazo */}
      <Dialog
        open={!!revisando}
        onOpenChange={(v) => {
          if (!v) {
            setRevisando(null);
            setNotas("");
          }
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {modo === "aprobar" ? "Aprobar solicitud" : "Rechazar solicitud"}
            </DialogTitle>
            <DialogDescription>
              {revisando && (
                <>
                  <span className="font-medium text-foreground">{revisando.empleadoNombre}</span>{" "}
                  · {SUBTIPO_LABEL[revisando.subtipo]}
                  <br />
                  {formatFecha(revisando.fechaInicio)}
                  {revisando.fechaFin &&
                    revisando.fechaFin !== revisando.fechaInicio &&
                    ` – ${formatFecha(revisando.fechaFin)}`}
                  {revisando.horas != null && ` · ${revisando.horas}h`}
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="py-2 space-y-2">
            <label className="text-sm font-medium">
              Notas{" "}
              <span className="text-muted-foreground font-normal">(opcional)</span>
            </label>
            <Textarea
              value={notas}
              onChange={(e) => setNotas(e.target.value)}
              rows={3}
              placeholder={
                modo === "aprobar"
                  ? "Comentario para el empleado…"
                  : "Motivo del rechazo (recomendado)…"
              }
            />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setRevisando(null);
                setNotas("");
              }}
            >
              Cancelar
            </Button>
            <Button
              onClick={confirmar}
              disabled={working}
              className={
                modo === "aprobar"
                  ? "bg-emerald-600 hover:bg-emerald-700"
                  : "bg-rose-600 hover:bg-rose-700"
              }
            >
              {working && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {modo === "aprobar" ? "Aprobar" : "Rechazar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
