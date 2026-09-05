"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useTabQuery } from "@/shared/hooks/use-tab-query";
import { useEmpresa } from "@/features/empresa/contexts/empresa-context";
import { formatFechaHoraEnZona } from "@/features/empresa/lib/zona-horaria";
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
import { CheckCircle2, XCircle, Loader2, Inbox, Lock } from "lucide-react";
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
import {
  listDenunciasComoSolicitudes,
  resolverDenunciaDesdeSolicitudes,
} from "@/features/mi-panel/actions/denuncias-actions";
import type { SolicitudPersonal, SolicitudTipo } from "@/features/mi-panel/types";
import {
  ESTADO_COLOR,
  ESTADO_LABEL,
  SUBTIPO_LABEL,
} from "@/features/mi-panel/types";

/** Familia de la solicitud, tal como se enseña en la tabla. */
function tipoLabel(tipo: SolicitudTipo): string {
  if (tipo === "ausencia") return "Ausencia";
  if (tipo === "queja") return "Queja";
  if (tipo === "entrega") return "Entrega";
  return "Trabajo";
}

/** "HH:MM:SS" de la base de datos → "HH:MM", que es como se pidió. */
function hhmm(v: string | null | undefined): string {
  if (!v) return "";
  const m = /^(\d{1,2}):(\d{2})/.exec(v.trim());
  return m ? `${m[1].padStart(2, "0")}:${m[2]}` : v;
}

function formatFecha(s: string | null): string {
  if (!s) return "—";
  try {
    const [y, m, d] = s.split("-");
    return `${d}/${m}/${y}`;
  } catch {
    return s;
  }
}

type Modo = "aprobar" | "rechazar";

type SolicitudConFlag = SolicitudPersonal & { puedoValidar?: boolean };

export function SolicitudesView() {
  const { empresaActual } = useEmpresa();
  const formatFechaHora = (s: string): string =>
    formatFechaHoraEnZona(s, empresaActual.zonaHoraria) || s;
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

  // Guarda la empresa con la que se lanzó la carga: si el usuario cambia de
  // empresa mientras vuelven los datos, la respuesta vieja se descarta.
  const empresaCargaRef = useRef(empresaActual.id);

  async function load() {
    const empresaId = empresaActual.id;
    empresaCargaRef.current = empresaId;
    setLoading(true);
    // Las quejas viven en su propia tabla por confidencialidad, pero para quien
    // las gestiona son un tipo más de solicitud: se listan mezcladas.
    const [res, quejas] = await Promise.all([
      listarSolicitudesEmpresa(tab),
      listDenunciasComoSolicitudes(tab === "pendientes"),
    ]);
    const solicitudes = res.ok ? res.data : [];
    const denuncias = quejas.ok ? quejas.data : [];
    const todo = [...solicitudes, ...denuncias].sort((a, b) =>
      b.createdAt.localeCompare(a.createdAt),
    );
    if (empresaCargaRef.current !== empresaId) return;
    setItems(todo);
    setLoading(false);
  }

  // Depende TAMBIÉN de la empresa activa: sin eso, al cambiar de empresa se
  // seguían viendo (y se podían aprobar) las solicitudes de la anterior.
  useEffect(() => {
    setItems([]);
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, empresaActual.id]);

  const acceso = (s: SolicitudPersonal, campo: string): unknown => {
    if (campo === "tipo") return tipoLabel(s.tipo);
    if (campo === "subtipo") return SUBTIPO_LABEL[s.subtipo];
    if (campo === "estado") return ESTADO_LABEL[s.estado];
    if (campo === "empleado") return s.empleadoNombre;
    if (campo === "fechaInicio") return s.fechaInicio;
    if (campo === "createdAt") return s.createdAt;
    if (campo === "revisadoPor") return s.revisadoPor ?? "";
    if (campo === "solicita")
      return s.horaInicio && s.horaFin ? `${hhmm(s.horaInicio)}–${hhmm(s.horaFin)}` : "";
    if (campo === "previsto") {
      const p = s.horarioPrevistoDia;
      if (!p) return "";
      return p.trabaja ? p.texto : "Libraba";
    }
    // Se filtra y ordena por el texto que se ve, no por el booleano: así en el
    // filtro salen "Sí"/"No" y no true/false.
    if (campo === "coincide") {
      const c = s.horarioPrevistoDia?.coincide ?? null;
      return c === null ? "" : c ? "Sí" : "No";
    }
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
    const esQueja = revisando.tipo === "queja";
    const res = esQueja
      ? await resolverDenunciaDesdeSolicitudes(
          revisando.id,
          modo === "aprobar",
          notas.trim() || undefined,
        )
      : await (modo === "aprobar" ? aprobarSolicitud : rechazarSolicitud)(
          revisando.id,
          notas.trim() || undefined,
        );
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
    { campo: "solicita", label: "Solicita" },
    { campo: "previsto", label: "Su horario" },
    { campo: "coincide", label: "Coincide" },
    { campo: "motivo", label: "Motivo" },
    { campo: "enviada", label: "Enviada" },
    { campo: "estado", label: "Estado" },
    { campo: "revisadoPor", label: "Validada por" },
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
              {tipoLabel(s.tipo)}
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
          {/* Una petición de material no tiene rango: su fecha es el día en que
              se pidió, y se etiqueta para que no se lea como un periodo. */}
          {s.tipo === "entrega" ? (
            <span className="text-muted-foreground">
              Pedida el {formatFecha(s.fechaInicio)}
            </span>
          ) : (
            <>
              {formatFecha(s.fechaInicio)}
              {s.fechaFin && s.fechaFin !== s.fechaInicio && (
                <> – {formatFecha(s.fechaFin)}</>
              )}
              {s.horas != null && (
                <span className="text-muted-foreground"> · {s.horas}h</span>
              )}
            </>
          )}
        </TableCell>
      ),
    },
    // Tramo que pide el trabajador. Solo las solicitudes de trabajo lo llevan.
    solicita: {
      th: <TableHead key="solicita">Solicita</TableHead>,
      td: (s) => (
        <TableCell key="solicita" className="text-sm tabular-nums whitespace-nowrap">
          {s.horaInicio && s.horaFin ? (
            `${hhmm(s.horaInicio)}–${hhmm(s.horaFin)}`
          ) : (
            <span className="text-muted-foreground">—</span>
          )}
        </TableCell>
      ),
    },
    // Lo que ese día tenía asignado en el cuadrante, para comparar de un vistazo.
    previsto: {
      th: <TableHead key="previsto">Su horario</TableHead>,
      td: (s) => {
        const p = s.horarioPrevistoDia;
        return (
          <TableCell key="previsto" className="text-sm tabular-nums whitespace-nowrap">
            {!p ? (
              <span className="text-muted-foreground">—</span>
            ) : !p.trabaja ? (
              <span className="text-muted-foreground">Libraba</span>
            ) : (
              p.texto
            )}
          </TableCell>
        );
      },
    },
    // Verde = pide exactamente su turno. Roja = no cuadra y hay que mirarlo.
    // Vacía = no hay horario contra el que comparar (horas extras, jornada
    // flexible o días sin cuadrante): ahí no se afirma nada.
    coincide: {
      th: <TableHead key="coincide" className="text-center">Coincide</TableHead>,
      td: (s) => {
        const c = s.horarioPrevistoDia?.coincide ?? null;
        return (
          <TableCell key="coincide" className="text-center">
            {c === true ? (
              <CheckCircle2
                className="h-5 w-5 text-emerald-600 inline-block"
                aria-label="Coincide con su horario"
              />
            ) : c === false ? (
              <XCircle
                className="h-5 w-5 text-rose-600 inline-block"
                aria-label="No coincide con su horario"
              />
            ) : (
              <span className="sr-only">Sin horario con el que comparar</span>
            )}
          </TableCell>
        );
      },
    },
    motivo: {
      th: <TableHead key="motivo">Motivo</TableHead>,
      td: (s) => (
        <TableCell key="motivo" className="max-w-[260px]">
          {/* En una solicitud de material lo primero es QUÉ pide: sin eso, RRHH
              no puede decidir si la aprueba. */}
          {s.tipo === "entrega" && s.entregaTipoNombre && (
            <span className="block text-sm font-medium text-foreground">
              {s.entregaTipoNombre}
              {s.entregaTalla && ` · talla ${s.entregaTalla}`}
            </span>
          )}
          <span className="text-sm text-muted-foreground line-clamp-2">
            {s.motivo || (s.tipo === "entrega" ? "" : "—")}
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
    // Quién la resolvió: el permiso para validar lo da el departamento, pero
    // aprueba una persona y su nombre queda como firma de la decisión.
    revisadoPor: {
      th: <TableHead key="revisadoPor">Validada por</TableHead>,
      td: (s) => (
        <TableCell key="revisadoPor" className="whitespace-nowrap">
          {s.revisadoPor ? (
            <span className="text-sm text-foreground">{s.revisadoPor}</span>
          ) : (
            <span className="text-sm text-muted-foreground">—</span>
          )}
          {s.revisadoPor && s.revisadoAt && (
            <span className="block text-xs text-muted-foreground">
              {formatFechaHora(s.revisadoAt)}
            </span>
          )}
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
      <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)}>
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
                  {revisando.horaInicio && revisando.horaFin && (
                    <>
                      <br />
                      Solicita {hhmm(revisando.horaInicio)}–{hhmm(revisando.horaFin)}
                      {revisando.horarioPrevistoDia && (
                        <>
                          {" · su horario: "}
                          {revisando.horarioPrevistoDia.trabaja
                            ? revisando.horarioPrevistoDia.texto
                            : "libraba"}
                        </>
                      )}
                    </>
                  )}
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
