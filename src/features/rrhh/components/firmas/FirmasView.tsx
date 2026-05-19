"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { listEmpleados } from "@/features/rrhh/actions/empleados-actions";
import {
  listFirmas,
  crearFirma,
  reenviarFirma,
  cancelarFirma,
  getDescargaFirmadoUrl,
  getAuditTrail,
} from "@/features/rrhh/actions/firmas-actions";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import {
  FileSignature,
  Clock,
  XCircle,
  Inbox,
  Eye,
  Download,
  ShieldCheck,
  Upload,
  AlertTriangle,
  RefreshCcw,
  Loader2,
  Ban,
} from "lucide-react";
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
  TIPOS_DOCUMENTO,
  MODALIDADES_FIRMA,
  VALIDECES_LEGAL,
  TIPO_LABEL,
  MODALIDAD_LABEL,
  VALIDEZ_LABEL,
  ESTADO_LABEL,
  ESTADO_COLOR,
  type DocumentoFirma,
  type TipoDocumento,
  type ModalidadFirma,
  type ValidezLegal,
  type EstadoFirma,
} from "@/features/rrhh/data/firmas";

const MAX_PDF_BYTES = 10 * 1024 * 1024;

type EmpleadoOpcion = { id: string; nombre: string; departamento: string };

type EventoUI = {
  id: string;
  tipo: string;
  ocurridoEn: string;
  ip: string | null;
  hash: string;
};

function formatFechaHora(s: string | null): string {
  if (!s) return "—";
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

export function FirmasView() {
  const [items, setItems] = useState<DocumentoFirma[]>([]);
  const [cargandoItems, setCargandoItems] = useState(true);
  const [empleadosOpts, setEmpleadosOpts] = useState<EmpleadoOpcion[]>([]);
  const [cargandoEmpleados, setCargandoEmpleados] = useState(false);
  const [busqueda, setBusqueda] = useState("");
  const [filtros, setFiltros] = useState<ToolbarFiltroActivo[]>([]);
  const [orden, setOrden] = useState<ToolbarOrdenActivo | null>({
    campo: "enviadoEn",
    direccion: "desc",
  });
  const [columnasVisibles, setColumnasVisibles] = useState<ToolbarColumnaVisible>({});
  const [columnasOrden, setColumnasOrden] = useState<string[] | undefined>(undefined);

  const [verDoc, setVerDoc] = useState<DocumentoFirma | null>(null);
  const [auditoria, setAuditoria] = useState<EventoUI[] | null>(null);
  const [auditoriaOk, setAuditoriaOk] = useState<boolean | null>(null);

  const [nuevoOpen, setNuevoOpen] = useState(false);
  const [enviando, setEnviando] = useState(false);

  const [titulo, setTitulo] = useState("");
  const [tipo, setTipo] = useState<TipoDocumento>("contrato");
  const [modalidad, setModalidad] = useState<ModalidadFirma>("click_to_sign");
  const [validez, setValidez] = useState<ValidezLegal>("eidas_simple");
  const [empleadoId, setEmpleadoId] = useState<string>("");
  const [diasExpiracion, setDiasExpiracion] = useState<number>(7);
  const [observaciones, setObservaciones] = useState("");
  const [archivo, setArchivo] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [accionPorFila, setAccionPorFila] = useState<Record<string, "ver" | "descargar" | "reenviar" | "cancelar" | null>>({});

  const cargarItems = useCallback(async () => {
    setCargandoItems(true);
    const res = await listFirmas();
    setCargandoItems(false);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    const adaptados: DocumentoFirma[] = res.data.map((d) => ({
      id: d.id,
      titulo: d.titulo,
      tipo: d.tipo as TipoDocumento,
      modalidad: d.modalidad,
      validez: d.validez as ValidezLegal,
      estado: d.estado as EstadoFirma,
      empleadoId: d.empleadoId,
      empleadoNombre: d.empleadoNombre,
      departamento: d.departamento,
      enviadoPor: d.enviadoPor,
      enviadoEn: d.enviadoEn,
      firmadoEn: d.firmadoEn,
      expiraEn: d.expiraEn,
      ipFirma: d.ipFirma,
      hash: d.sha256Acta ?? d.sha256Original,
      archivoUrl: "#",
    }));
    setItems(adaptados);
  }, []);

  useEffect(() => {
    void cargarItems();
  }, [cargarItems]);

  const stats = useMemo(() => {
    const total = items.length;
    const pendientes = items.filter((d) => d.estado === "pendiente").length;
    const firmadosHoy = items.filter((d) => {
      if (!d.firmadoEn) return false;
      const f = new Date(d.firmadoEn);
      const hoy = new Date();
      return (
        f.getDate() === hoy.getDate() &&
        f.getMonth() === hoy.getMonth() &&
        f.getFullYear() === hoy.getFullYear()
      );
    }).length;
    const expirados = items.filter((d) => d.estado === "expirado").length;
    const rechazados = items.filter((d) => d.estado === "rechazado").length;
    return { total, pendientes, firmadosHoy, expirados, rechazados };
  }, [items]);

  const acceso = (d: DocumentoFirma, campo: string): unknown => {
    if (campo === "tipo") return TIPO_LABEL[d.tipo];
    if (campo === "modalidad") return MODALIDAD_LABEL[d.modalidad];
    if (campo === "validez") return VALIDEZ_LABEL[d.validez];
    if (campo === "estado") return ESTADO_LABEL[d.estado];
    if (campo === "empleado") return d.empleadoNombre;
    if (campo === "departamento") return d.departamento;
    if (campo === "enviadoEn") return d.enviadoEn;
    if (campo === "firmadoEn") return d.firmadoEn ?? "";
    return (d as unknown as Record<string, unknown>)[campo];
  };

  const filtrados = useMemo(() => {
    let lista = items;
    if (busqueda.trim()) {
      const q = busqueda.toLowerCase();
      lista = lista.filter(
        (d) =>
          d.titulo.toLowerCase().includes(q) ||
          d.empleadoNombre.toLowerCase().includes(q) ||
          d.departamento.toLowerCase().includes(q) ||
          TIPO_LABEL[d.tipo].toLowerCase().includes(q),
      );
    }
    lista = aplicarFiltrosToolbar(lista, filtros, acceso);
    lista = aplicarOrdenToolbar(lista, orden, acceso);
    return lista;
  }, [items, busqueda, filtros, orden]);

  const cargarEmpleados = useCallback(async () => {
    setCargandoEmpleados(true);
    try {
      const res = await listEmpleados();
      if (!res.ok) {
        toast.error("No se pudo cargar la lista de empleados");
        return;
      }
      const opciones: EmpleadoOpcion[] = (res.data as Array<Record<string, unknown>>)
        .filter((e) => (e.estado as string) === "Activo")
        .map((e) => {
          const nombre = `${(e.nombre as string) ?? ""} ${(e.apellidos as string) ?? ""}`.trim();
          const dep = e.departamentos as { nombre?: string } | null;
          return { id: e.id as string, nombre, departamento: dep?.nombre ?? "—" };
        });
      setEmpleadosOpts(opciones);
    } finally {
      setCargandoEmpleados(false);
    }
  }, []);

  function abrirNuevo() {
    setTitulo("");
    setTipo("contrato");
    setModalidad("click_to_sign");
    setValidez("eidas_simple");
    setEmpleadoId("");
    setDiasExpiracion(7);
    setObservaciones("");
    setArchivo(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
    setNuevoOpen(true);
    void cargarEmpleados();
  }

  function onFilePicked(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0] ?? null;
    if (!f) {
      setArchivo(null);
      return;
    }
    if (f.size > MAX_PDF_BYTES) {
      toast.error("El PDF supera 10 MB");
      e.target.value = "";
      return;
    }
    if (f.type && f.type !== "application/pdf") {
      toast.error("Solo se aceptan archivos PDF");
      e.target.value = "";
      return;
    }
    setArchivo(f);
  }

  async function enviarParaFirma() {
    if (!titulo.trim()) return toast.error("Pon un título al documento");
    if (!empleadoId) return toast.error("Selecciona el empleado que debe firmar");
    if (!archivo) return toast.error("Adjunta el PDF que se va a firmar");

    setEnviando(true);
    const fd = new FormData();
    fd.set("file", archivo);
    fd.set("titulo", titulo.trim());
    fd.set("tipo", tipo);
    fd.set("modalidad", modalidad);
    fd.set("validez", validez);
    fd.set("empleadoId", empleadoId);
    fd.set("plazoDias", String(diasExpiracion));
    if (observaciones.trim()) fd.set("observaciones", observaciones.trim());

    const res = await crearFirma(fd);
    setEnviando(false);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    setNuevoOpen(false);
    if (!res.emailEnviado) {
      toast.warning("Documento creado, pero el email no se pudo enviar. Configura SMTP o Resend.");
    } else {
      toast.success("Documento enviado para firma");
    }
    await cargarItems();
  }

  async function descargar(docId: string) {
    setAccionPorFila((s) => ({ ...s, [docId]: "descargar" }));
    const res = await getDescargaFirmadoUrl(docId);
    setAccionPorFila((s) => ({ ...s, [docId]: null }));
    if (!res.ok) return toast.error(res.error);
    window.open(res.url, "_blank", "noopener,noreferrer");
  }

  async function reenviar(docId: string) {
    setAccionPorFila((s) => ({ ...s, [docId]: "reenviar" }));
    const res = await reenviarFirma(docId);
    setAccionPorFila((s) => ({ ...s, [docId]: null }));
    if (!res.ok) return toast.error(res.error);
    toast.success(res.emailEnviado ? "Reenviado al empleado" : "Reenviado (sin email)");
    await cargarItems();
  }

  async function cancelar(docId: string) {
    if (!window.confirm("¿Cancelar y marcar como expirado?")) return;
    setAccionPorFila((s) => ({ ...s, [docId]: "cancelar" }));
    const res = await cancelarFirma(docId);
    setAccionPorFila((s) => ({ ...s, [docId]: null }));
    if (!res.ok) return toast.error(res.error);
    toast.success("Documento cancelado");
    await cargarItems();
  }

  async function verDetalle(doc: DocumentoFirma) {
    setVerDoc(doc);
    setAuditoria(null);
    setAuditoriaOk(null);
    const res = await getAuditTrail(doc.id);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    setAuditoria(
      res.eventos.map((e) => ({
        id: e.id,
        tipo: e.tipo,
        ocurridoEn: e.ocurridoEn,
        ip: e.ip,
        hash: e.hash,
      })),
    );
    setAuditoriaOk(res.verificacion.ok);
  }

  const columnasDef: ToolbarColumna[] = [
    { campo: "documento", label: "Documento" },
    { campo: "empleado", label: "Empleado" },
    { campo: "tipo", label: "Tipo" },
    { campo: "modalidad", label: "Modalidad" },
    { campo: "validez", label: "Validez" },
    { campo: "enviado", label: "Enviado" },
    { campo: "firmado", label: "Firmado" },
    { campo: "estado", label: "Estado" },
  ];

  const columnDefs: Record<string, { th: ReactNode; td: (d: DocumentoFirma) => ReactNode }> = {
    documento: {
      th: <TableHead key="documento">Documento</TableHead>,
      td: (d) => (
        <TableCell key="documento" className="font-medium max-w-[260px]">
          <div className="line-clamp-1">{d.titulo}</div>
          <div className="text-xs text-muted-foreground">Enviado por {d.enviadoPor}</div>
        </TableCell>
      ),
    },
    empleado: {
      th: <TableHead key="empleado">Empleado</TableHead>,
      td: (d) => (
        <TableCell key="empleado">
          <div className="font-medium text-sm">{d.empleadoNombre}</div>
          <div className="text-xs text-muted-foreground">{d.departamento}</div>
        </TableCell>
      ),
    },
    tipo: {
      th: <TableHead key="tipo">Tipo</TableHead>,
      td: (d) => <TableCell key="tipo" className="text-sm">{TIPO_LABEL[d.tipo]}</TableCell>,
    },
    modalidad: {
      th: <TableHead key="modalidad">Modalidad</TableHead>,
      td: (d) => <TableCell key="modalidad" className="text-sm">{MODALIDAD_LABEL[d.modalidad]}</TableCell>,
    },
    validez: {
      th: <TableHead key="validez">Validez</TableHead>,
      td: (d) => (
        <TableCell key="validez">
          <Badge variant="outline" className="gap-1">
            <ShieldCheck className="h-3 w-3" />
            {VALIDEZ_LABEL[d.validez]}
          </Badge>
        </TableCell>
      ),
    },
    enviado: {
      th: <TableHead key="enviado">Enviado</TableHead>,
      td: (d) => (
        <TableCell key="enviado" className="text-xs text-muted-foreground">
          {formatFechaHora(d.enviadoEn)}
        </TableCell>
      ),
    },
    firmado: {
      th: <TableHead key="firmado">Firmado</TableHead>,
      td: (d) => (
        <TableCell key="firmado" className="text-xs text-muted-foreground">
          {formatFechaHora(d.firmadoEn)}
        </TableCell>
      ),
    },
    estado: {
      th: <TableHead key="estado">Estado</TableHead>,
      td: (d) => (
        <TableCell key="estado">
          <Badge variant="outline" className={ESTADO_COLOR[d.estado]}>
            {ESTADO_LABEL[d.estado]}
          </Badge>
        </TableCell>
      ),
    },
  };

  const columnasRender = ordenarColumnas(columnasDef, columnasOrden).filter(
    (c) => c.bloqueada || colVisible(columnasVisibles, c.campo),
  );

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto space-y-5">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KPI titulo="Total" valor={stats.total} Icono={FileSignature} />
        <KPI titulo="Pendientes" valor={stats.pendientes} Icono={Clock} color="text-amber-600" />
        <KPI titulo="Expirados" valor={stats.expirados} Icono={AlertTriangle} color="text-zinc-600" />
        <KPI titulo="Rechazados" valor={stats.rechazados} Icono={XCircle} color="text-rose-600" />
      </div>

      <SubmoduleToolbar
        busqueda={busqueda}
        onBusquedaChange={setBusqueda}
        placeholderBusqueda="Buscar"
        onNuevo={abrirNuevo}
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
        {cargandoItems ? (
          <div className="flex items-center justify-center h-48 text-muted-foreground text-sm gap-2">
            <Loader2 className="h-4 w-4 animate-spin" />
            Cargando documentos…
          </div>
        ) : filtrados.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 text-muted-foreground text-sm">
            <Inbox className="h-6 w-6 mb-1" />
            No hay documentos para firmar todavía. Pulsa <strong>+ Nuevo</strong> para enviar uno.
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
              {filtrados.map((d) => {
                const accion = accionPorFila[d.id] ?? null;
                return (
                  <TableRow key={d.id}>
                    {columnasRender.map((c) => columnDefs[c.campo]?.td(d))}
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => verDetalle(d)}
                          title="Ver detalle y audit trail"
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        {d.estado === "firmado" && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => descargar(d.id)}
                            disabled={accion === "descargar"}
                            title="Descargar PDF firmado"
                          >
                            {accion === "descargar" ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Download className="h-4 w-4" />
                            )}
                          </Button>
                        )}
                        {d.estado === "pendiente" && (
                          <>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => reenviar(d.id)}
                              disabled={accion === "reenviar"}
                              title="Reenviar invitación"
                            >
                              {accion === "reenviar" ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <RefreshCcw className="h-4 w-4" />
                              )}
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => cancelar(d.id)}
                              disabled={accion === "cancelar"}
                              title="Cancelar (marcar expirado)"
                            >
                              {accion === "cancelar" ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <Ban className="h-4 w-4" />
                              )}
                            </Button>
                          </>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </Card>

      <Dialog open={nuevoOpen} onOpenChange={setNuevoOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Enviar nuevo documento para firma</DialogTitle>
            <DialogDescription>
              El empleado recibirá un email con un enlace único y un código de verificación.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="titulo">Título del documento</Label>
              <Input
                id="titulo"
                placeholder="Ej. Anexo de jornada — mayo 2026"
                value={titulo}
                onChange={(e) => setTitulo(e.target.value)}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Tipo</Label>
                <Select value={tipo} onValueChange={(v) => setTipo(v as TipoDocumento)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TIPOS_DOCUMENTO.map((t) => (
                      <SelectItem key={t} value={t}>
                        {TIPO_LABEL[t]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label>Empleado</Label>
                <Select value={empleadoId} onValueChange={setEmpleadoId}>
                  <SelectTrigger>
                    <SelectValue
                      placeholder={cargandoEmpleados ? "Cargando…" : "Seleccionar..."}
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {empleadosOpts.length === 0 && !cargandoEmpleados ? (
                      <div className="px-2 py-1.5 text-sm text-muted-foreground">
                        No hay empleados activos
                      </div>
                    ) : (
                      empleadosOpts.map((e) => (
                        <SelectItem key={e.id} value={e.id}>
                          {e.nombre}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label>Modalidad de firma</Label>
                <Select value={modalidad} onValueChange={(v) => setModalidad(v as ModalidadFirma)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {MODALIDADES_FIRMA.map((m) => (
                      <SelectItem key={m} value={m}>
                        {MODALIDAD_LABEL[m]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label>Validez legal</Label>
                <Select value={validez} onValueChange={(v) => setValidez(v as ValidezLegal)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {VALIDECES_LEGAL.map((v) => (
                      <SelectItem key={v} value={v}>
                        {VALIDEZ_LABEL[v]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5 col-span-2">
                <Label>Plazo de firma (días)</Label>
                <Input
                  type="number"
                  min={1}
                  max={60}
                  value={diasExpiracion}
                  onChange={(e) =>
                    setDiasExpiracion(Math.max(1, Number(e.target.value) || 7))
                  }
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Observaciones (opcional)</Label>
              <Textarea
                value={observaciones}
                onChange={(e) => setObservaciones(e.target.value)}
                rows={2}
                placeholder="Mensaje que verá el empleado…"
              />
            </div>

            <div>
              <Label>PDF a firmar (máx. 10 MB)</Label>
              <label className="mt-1.5 flex items-center gap-2 rounded-md border border-dashed border-border bg-muted/40 px-3 py-3 text-sm cursor-pointer hover:bg-muted/70">
                <Upload className="h-4 w-4" />
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="application/pdf"
                  onChange={onFilePicked}
                  className="hidden"
                />
                {archivo ? (
                  <span className="text-foreground">
                    {archivo.name}{" "}
                    <span className="text-muted-foreground">
                      ({(archivo.size / 1024).toFixed(0)} KB)
                    </span>
                  </span>
                ) : (
                  <span className="text-muted-foreground">Pulsa para elegir un PDF</span>
                )}
              </label>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setNuevoOpen(false)} disabled={enviando}>
              Cancelar
            </Button>
            <Button variant="primary" onClick={enviarParaFirma} disabled={enviando}>
              {enviando ? "Enviando…" : "Enviar para firmar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!verDoc} onOpenChange={(v) => !v && setVerDoc(null)}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>{verDoc?.titulo}</DialogTitle>
            <DialogDescription>
              Detalle y audit trail de la firma electrónica.
            </DialogDescription>
          </DialogHeader>

          {verDoc && (
            <div className="space-y-4 text-sm">
              <div className="grid grid-cols-2 gap-2">
                <Info label="Empleado" value={verDoc.empleadoNombre} />
                <Info label="Departamento" value={verDoc.departamento} />
                <Info label="Tipo" value={TIPO_LABEL[verDoc.tipo]} />
                <Info label="Modalidad" value={MODALIDAD_LABEL[verDoc.modalidad]} />
                <Info label="Validez" value={VALIDEZ_LABEL[verDoc.validez]} />
                <Info
                  label="Estado"
                  value={
                    <Badge variant="outline" className={ESTADO_COLOR[verDoc.estado]}>
                      {ESTADO_LABEL[verDoc.estado]}
                    </Badge>
                  }
                />
                <Info label="Enviado por" value={verDoc.enviadoPor} />
                <Info label="Enviado el" value={formatFechaHora(verDoc.enviadoEn)} />
                <Info label="Expira" value={formatFechaHora(verDoc.expiraEn)} />
                <Info label="Firmado el" value={formatFechaHora(verDoc.firmadoEn)} />
                <Info label="IP de firma" value={verDoc.ipFirma ?? "—"} />
                <Info label="Hash" value={verDoc.hash ? `${verDoc.hash.slice(0, 16)}…` : "—"} />
              </div>

              <div className="rounded-md border bg-muted/40 px-3 py-2">
                <div className="flex items-center justify-between mb-2">
                  <div className="text-xs uppercase tracking-wider text-muted-foreground">
                    Audit trail
                  </div>
                  {auditoriaOk !== null && (
                    <Badge
                      variant="outline"
                      className={
                        auditoriaOk
                          ? "border-emerald-300 bg-emerald-50 text-emerald-700"
                          : "border-rose-300 bg-rose-50 text-rose-700"
                      }
                    >
                      {auditoriaOk ? "Cadena íntegra" : "Cadena rota"}
                    </Badge>
                  )}
                </div>
                {auditoria === null ? (
                  <div className="text-xs text-muted-foreground flex items-center gap-2">
                    <Loader2 className="h-3 w-3 animate-spin" /> Cargando…
                  </div>
                ) : auditoria.length === 0 ? (
                  <div className="text-xs text-muted-foreground">Sin eventos registrados.</div>
                ) : (
                  <ol className="space-y-1.5 text-xs">
                    {auditoria.map((e) => (
                      <li key={e.id} className="font-mono">
                        <span className="text-muted-foreground">
                          {formatFechaHora(e.ocurridoEn)}
                        </span>{" "}
                        <span className="font-semibold text-foreground">{e.tipo}</span>{" "}
                        {e.ip && <span className="text-muted-foreground">· IP {e.ip}</span>}{" "}
                        <span className="text-muted-foreground">· {e.hash.slice(0, 12)}…</span>
                      </li>
                    ))}
                  </ol>
                )}
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setVerDoc(null)}>
              Cerrar
            </Button>
            {verDoc?.estado === "firmado" && (
              <Button variant="primary" onClick={() => verDoc && descargar(verDoc.id)}>
                <Download className="h-4 w-4 mr-1" />
                Descargar PDF firmado
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function KPI({
  titulo,
  valor,
  Icono,
  color,
}: {
  titulo: string;
  valor: number;
  Icono: typeof FileSignature;
  color?: string;
}) {
  return (
    <Card className="p-4">
      <div className="flex items-center justify-between">
        <div className="text-xs uppercase text-muted-foreground tracking-wider">{titulo}</div>
        <Icono className={`h-4 w-4 ${color ?? "text-muted-foreground"}`} />
      </div>
      <div className={`text-2xl font-bold mt-1 ${color ?? ""}`}>{valor}</div>
    </Card>
  );
}

function Info({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <div className="text-xs uppercase text-muted-foreground tracking-wider">{label}</div>
      <div className="mt-0.5">{value}</div>
    </div>
  );
}
