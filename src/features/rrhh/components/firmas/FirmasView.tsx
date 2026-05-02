"use client";

import { useMemo, useState } from "react";
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
  CheckCircle2,
  Clock,
  XCircle,
  Inbox,
  Eye,
  Download,
  ShieldCheck,
  Upload,
  AlertTriangle,
} from "lucide-react";
import {
  SubmoduleToolbar,
  aplicarFiltrosToolbar,
  aplicarOrdenToolbar,
  type ToolbarFiltroActivo,
  type ToolbarOrdenActivo,
} from "@/shared/components/SubmoduleToolbar";
import { toast } from "sonner";
import {
  FIRMAS_MOCK,
  TIPOS_DOCUMENTO,
  MODALIDADES_FIRMA,
  VALIDECES_LEGAL,
  TIPO_LABEL,
  MODALIDAD_LABEL,
  VALIDEZ_LABEL,
  ESTADO_LABEL,
  ESTADO_COLOR,
  EMPLEADOS_PARA_FIRMA,
  type DocumentoFirma,
  type TipoDocumento,
  type ModalidadFirma,
  type ValidezLegal,
  type EstadoFirma,
} from "@/features/rrhh/data/firmas";

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

function nuevoId() {
  return `frm-${Math.random().toString(36).slice(2, 8)}`;
}

export function FirmasView() {
  const [items, setItems] = useState<DocumentoFirma[]>(FIRMAS_MOCK);
  const [busqueda, setBusqueda] = useState("");
  const [filtros, setFiltros] = useState<ToolbarFiltroActivo[]>([]);
  const [orden, setOrden] = useState<ToolbarOrdenActivo | null>({
    campo: "enviadoEn",
    direccion: "desc",
  });

  const [verDoc, setVerDoc] = useState<DocumentoFirma | null>(null);
  const [nuevoOpen, setNuevoOpen] = useState(false);
  const [enviando, setEnviando] = useState(false);

  const [titulo, setTitulo] = useState("");
  const [tipo, setTipo] = useState<TipoDocumento>("contrato");
  const [modalidad, setModalidad] = useState<ModalidadFirma>("click_to_sign");
  const [validez, setValidez] = useState<ValidezLegal>("eidas_simple");
  const [empleadoId, setEmpleadoId] = useState<string>("");
  const [diasExpiracion, setDiasExpiracion] = useState<number>(7);
  const [observaciones, setObservaciones] = useState("");

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

  function abrirNuevo() {
    setTitulo("");
    setTipo("contrato");
    setModalidad("click_to_sign");
    setValidez("eidas_simple");
    setEmpleadoId("");
    setDiasExpiracion(7);
    setObservaciones("");
    setNuevoOpen(true);
  }

  async function enviarParaFirma() {
    if (!titulo.trim()) {
      toast.error("Pon un título al documento");
      return;
    }
    if (!empleadoId) {
      toast.error("Selecciona el empleado que debe firmar");
      return;
    }

    const empleado = EMPLEADOS_PARA_FIRMA.find((e) => e.id === empleadoId);
    if (!empleado) return;

    setEnviando(true);
    await new Promise((r) => setTimeout(r, 600));

    const ahora = new Date();
    const expiraEn = new Date(ahora.getTime() + diasExpiracion * 86400000);

    const nuevo: DocumentoFirma = {
      id: nuevoId(),
      titulo: titulo.trim(),
      tipo,
      modalidad,
      validez,
      estado: "pendiente",
      empleadoId: empleado.id,
      empleadoNombre: empleado.nombre,
      departamento: empleado.departamento,
      enviadoPor: "Tú",
      enviadoEn: ahora.toISOString(),
      firmadoEn: null,
      expiraEn: expiraEn.toISOString(),
      ipFirma: null,
      hash: null,
      archivoUrl: "#",
      observaciones: observaciones.trim() || undefined,
    };
    setItems((prev) => [nuevo, ...prev]);
    setEnviando(false);
    setNuevoOpen(false);
    toast.success(`Documento enviado a ${empleado.nombre}`);
  }

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto space-y-5">
      {/* Cabecera */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <FileSignature className="h-6 w-6 text-primary" />
            Firmas electrónicas
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Envía documentos a la plantilla y obtén firmas con validez legal
            (eIDAS). Registro completo de cada firma con timestamp, IP y hash de
            integridad.
          </p>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div className="text-xs uppercase text-muted-foreground tracking-wider">
              Total
            </div>
            <FileSignature className="h-4 w-4 text-muted-foreground" />
          </div>
          <div className="text-2xl font-bold mt-1">{stats.total}</div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div className="text-xs uppercase text-muted-foreground tracking-wider">
              Pendientes
            </div>
            <Clock className="h-4 w-4 text-amber-600" />
          </div>
          <div className="text-2xl font-bold mt-1 text-amber-600">
            {stats.pendientes}
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div className="text-xs uppercase text-muted-foreground tracking-wider">
              Firmados hoy
            </div>
            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
          </div>
          <div className="text-2xl font-bold mt-1 text-emerald-600">
            {stats.firmadosHoy}
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div className="text-xs uppercase text-muted-foreground tracking-wider">
              Expirados
            </div>
            <AlertTriangle className="h-4 w-4 text-zinc-500" />
          </div>
          <div className="text-2xl font-bold mt-1 text-zinc-600">
            {stats.expirados}
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div className="text-xs uppercase text-muted-foreground tracking-wider">
              Rechazados
            </div>
            <XCircle className="h-4 w-4 text-rose-600" />
          </div>
          <div className="text-2xl font-bold mt-1 text-rose-600">
            {stats.rechazados}
          </div>
        </Card>
      </div>

      {/* Toolbar */}
      <SubmoduleToolbar
        busqueda={busqueda}
        onBusquedaChange={setBusqueda}
        placeholderBusqueda="Buscar por título, empleado, departamento, tipo..."
        onNuevo={abrirNuevo}
        textoNuevo="Nuevo documento"
        campos={[
          {
            campo: "tipo",
            label: "Tipo de documento",
            tipo: "lista",
            opciones: TIPOS_DOCUMENTO.map((t) => TIPO_LABEL[t]),
          },
          {
            campo: "modalidad",
            label: "Modalidad de firma",
            tipo: "lista",
            opciones: MODALIDADES_FIRMA.map((m) => MODALIDAD_LABEL[m]),
          },
          {
            campo: "validez",
            label: "Validez legal",
            tipo: "lista",
            opciones: VALIDECES_LEGAL.map((v) => VALIDEZ_LABEL[v]),
          },
          {
            campo: "estado",
            label: "Estado",
            tipo: "lista",
            opciones: (Object.keys(ESTADO_LABEL) as EstadoFirma[]).map(
              (e) => ESTADO_LABEL[e],
            ),
          },
          {
            campo: "departamento",
            label: "Departamento",
            tipo: "lista",
            opciones: [...new Set(items.map((d) => d.departamento))],
          },
          { campo: "enviadoEn", label: "Fecha envío", tipo: "fecha" },
          { campo: "firmadoEn", label: "Fecha firma", tipo: "fecha" },
        ]}
        filtros={filtros}
        onFiltrosChange={setFiltros}
        ordenOpciones={[
          { campo: "enviadoEn", label: "Fecha envío" },
          { campo: "firmadoEn", label: "Fecha firma" },
          { campo: "empleado", label: "Empleado" },
          { campo: "estado", label: "Estado" },
          { campo: "tipo", label: "Tipo" },
        ]}
        orden={orden}
        onOrdenChange={setOrden}
      />

      {/* Tabla */}
      <Card>
        {filtrados.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 text-muted-foreground text-sm">
            <Inbox className="h-6 w-6 mb-1" />
            No hay documentos que coincidan con los filtros aplicados.
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Documento</TableHead>
                <TableHead>Empleado</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Modalidad</TableHead>
                <TableHead>Validez</TableHead>
                <TableHead>Enviado</TableHead>
                <TableHead>Firmado</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtrados.map((d) => (
                <TableRow key={d.id}>
                  <TableCell className="font-medium max-w-[260px]">
                    <div className="line-clamp-1">{d.titulo}</div>
                    <div className="text-xs text-muted-foreground">
                      Enviado por {d.enviadoPor}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="font-medium text-sm">{d.empleadoNombre}</div>
                    <div className="text-xs text-muted-foreground">
                      {d.departamento}
                    </div>
                  </TableCell>
                  <TableCell className="text-sm">{TIPO_LABEL[d.tipo]}</TableCell>
                  <TableCell className="text-sm">
                    {MODALIDAD_LABEL[d.modalidad]}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="gap-1">
                      <ShieldCheck className="h-3 w-3" />
                      {VALIDEZ_LABEL[d.validez]}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {formatFechaHora(d.enviadoEn)}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {formatFechaHora(d.firmadoEn)}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className={ESTADO_COLOR[d.estado]}>
                      {ESTADO_LABEL[d.estado]}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setVerDoc(d)}
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() =>
                          toast.message(
                            "Descarga simulada — documento + acta de firma",
                          )
                        }
                        disabled={d.estado !== "firmado"}
                      >
                        <Download className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>

      {/* Diálogo Nuevo documento */}
      <Dialog open={nuevoOpen} onOpenChange={setNuevoOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Enviar nuevo documento para firma</DialogTitle>
            <DialogDescription>
              El empleado recibirá un aviso y podrá firmar desde su panel con la
              modalidad elegida.
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
                    <SelectValue placeholder="Seleccionar..." />
                  </SelectTrigger>
                  <SelectContent>
                    {EMPLEADOS_PARA_FIRMA.map((e) => (
                      <SelectItem key={e.id} value={e.id}>
                        {e.nombre}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label>Modalidad de firma</Label>
                <Select
                  value={modalidad}
                  onValueChange={(v) => setModalidad(v as ModalidadFirma)}
                >
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
                <Select
                  value={validez}
                  onValueChange={(v) => setValidez(v as ValidezLegal)}
                >
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

            <div className="flex items-center gap-2 rounded-md border border-dashed border-border bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
              <Upload className="h-4 w-4" />
              Adjuntar PDF (simulado)
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setNuevoOpen(false)}>
              Cancelar
            </Button>
            <Button
              variant="primary"
              onClick={enviarParaFirma}
              disabled={enviando}
            >
              {enviando ? "Enviando…" : "Enviar para firmar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Diálogo ver detalle */}
      <Dialog open={!!verDoc} onOpenChange={(v) => !v && setVerDoc(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{verDoc?.titulo}</DialogTitle>
            <DialogDescription>
              Detalle y trazabilidad de la firma electrónica.
            </DialogDescription>
          </DialogHeader>

          {verDoc && (
            <div className="space-y-3 text-sm">
              <div className="grid grid-cols-2 gap-2">
                <Info label="Empleado" value={verDoc.empleadoNombre} />
                <Info label="Departamento" value={verDoc.departamento} />
                <Info label="Tipo" value={TIPO_LABEL[verDoc.tipo]} />
                <Info
                  label="Modalidad"
                  value={MODALIDAD_LABEL[verDoc.modalidad]}
                />
                <Info label="Validez" value={VALIDEZ_LABEL[verDoc.validez]} />
                <Info
                  label="Estado"
                  value={
                    <Badge
                      variant="outline"
                      className={ESTADO_COLOR[verDoc.estado]}
                    >
                      {ESTADO_LABEL[verDoc.estado]}
                    </Badge>
                  }
                />
                <Info label="Enviado por" value={verDoc.enviadoPor} />
                <Info
                  label="Enviado el"
                  value={formatFechaHora(verDoc.enviadoEn)}
                />
                <Info
                  label="Expira"
                  value={formatFechaHora(verDoc.expiraEn)}
                />
                <Info
                  label="Firmado el"
                  value={formatFechaHora(verDoc.firmadoEn)}
                />
                <Info label="IP de firma" value={verDoc.ipFirma ?? "—"} />
                <Info label="Hash integridad" value={verDoc.hash ?? "—"} />
              </div>
              {verDoc.observaciones && (
                <div className="rounded-md border bg-muted/40 px-3 py-2 text-muted-foreground">
                  <span className="font-medium text-foreground">
                    Observaciones:
                  </span>{" "}
                  {verDoc.observaciones}
                </div>
              )}
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setVerDoc(null)}>
              Cerrar
            </Button>
            {verDoc?.estado === "firmado" && (
              <Button
                variant="primary"
                onClick={() =>
                  toast.message(
                    "Descarga simulada — documento + acta de firma",
                  )
                }
              >
                <Download className="h-4 w-4 mr-1" />
                Descargar acta
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Info({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div>
      <div className="text-xs uppercase text-muted-foreground tracking-wider">
        {label}
      </div>
      <div className="mt-0.5">{value}</div>
    </div>
  );
}
