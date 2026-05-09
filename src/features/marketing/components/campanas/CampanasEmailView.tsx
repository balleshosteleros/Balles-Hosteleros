"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Plus, Mail, Pencil, Trash2, Send, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useEmpresa } from "@/features/empresa/contexts/empresa-context";
import { useCampanas } from "@/features/marketing/hooks/useCampanas";
import {
  crearCampanaEmailVacia,
  ESTADOS_CAMPANA,
  SEGMENTOS_CLIENTE,
  type CampanaEmail,
} from "@/features/marketing/data/campanas";
import { enviarEmailAction, verificarIntegracionesAction } from "@/features/marketing/actions/campanas-actions";
import { toast } from "sonner";
import { AlertCircle } from "lucide-react";
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

function estadoColor(estado: CampanaEmail["estado"]) {
  return ESTADOS_CAMPANA.find((e) => e.value === estado)?.color ?? "gray";
}

export function CampanasEmailView() {
  const { empresaActual } = useEmpresa();
  const { emails, guardar, eliminar, modoLocal } = useCampanas(empresaActual.id);
  const [modalOpen, setModalOpen] = useState(false);
  const [edit, setEdit] = useState<CampanaEmail | null>(null);
  const [enviando, setEnviando] = useState<string | null>(null);
  const [resendOk, setResendOk] = useState<boolean | null>(null);
  const [busqueda, setBusqueda] = useState("");
  const [filtros, setFiltros] = useState<ToolbarFiltroActivo[]>([]);
  const [orden, setOrden] = useState<ToolbarOrdenActivo | null>(null);
  const [columnasVisibles, setColumnasVisibles] = useState<ToolbarColumnaVisible>({});
  const [columnasOrden, setColumnasOrden] = useState<string[] | undefined>(undefined);
  const [showConfig, setShowConfig] = useState(false);

  useEffect(() => {
    verificarIntegracionesAction().then((r) => setResendOk(r.resend));
  }, []);

  const acceso = (c: CampanaEmail, campo: string): unknown => {
    if (campo === "estado") return ESTADOS_CAMPANA.find((e) => e.value === c.estado)?.label ?? c.estado;
    if (campo === "segmento") return SEGMENTOS_CLIENTE.find((s) => s.value === c.segmento)?.label ?? c.segmento;
    if (campo === "nombre") return c.nombre;
    if (campo === "asunto") return c.asunto;
    if (campo === "enviados") return c.estadisticas.enviados;
    if (campo === "abiertos") return c.estadisticas.abiertos;
    return (c as unknown as Record<string, unknown>)[campo];
  };

  const filtrados = useMemo(() => {
    let lista = emails.filter((c) => {
      if (!busqueda) return true;
      const q = busqueda.toLowerCase();
      return (
        c.nombre.toLowerCase().includes(q) ||
        c.asunto.toLowerCase().includes(q)
      );
    });
    lista = aplicarFiltrosToolbar(lista, filtros, acceso);
    lista = aplicarOrdenToolbar(lista, orden, acceso);
    return lista;
  }, [emails, busqueda, filtros, orden]);

  function abrirNuevo() {
    setEdit(crearCampanaEmailVacia(empresaActual.id));
    setModalOpen(true);
  }

  function abrirEditar(c: CampanaEmail) {
    setEdit({ ...c });
    setModalOpen(true);
  }

  function onGuardar() {
    if (!edit) return;
    if (!edit.nombre.trim() || !edit.asunto.trim()) {
      toast.error("Nombre y asunto son obligatorios");
      return;
    }
    guardar(edit);
    toast.success("Campaña de email guardada");
    setModalOpen(false);
  }

  async function onEnviar(c: CampanaEmail) {
    if (!resendOk) {
      toast.error("Resend no está configurado. Añade RESEND_API_KEY en las variables de entorno.");
      return;
    }
    setEnviando(c.id);
    const result = await enviarEmailAction(c);
    setEnviando(null);
    if (result.success) {
      await guardar({
        ...c,
        estado: "finalizada",
        fechaEnvio: new Date().toISOString(),
        estadisticas: { ...c.estadisticas, enviados: result.enviados ?? 0 },
      });
      toast.success(`Campaña enviada a ${result.enviados} destinatarios`);
    } else {
      await guardar({ ...c, estado: "fallida" });
      toast.error(result.error ?? "Error al enviar");
    }
  }

  const columnasDef: ToolbarColumna[] = [
    { campo: "campana", label: "Campaña" },
    { campo: "asunto", label: "Asunto" },
    { campo: "segmento", label: "Segmento" },
    { campo: "estado", label: "Estado" },
    { campo: "enviados", label: "Enviados" },
    { campo: "abiertos", label: "Abiertos" },
  ];

  const columnDefs: Record<string, { th: ReactNode; td: (c: CampanaEmail) => ReactNode }> = {
    campana: {
      th: <th key="campana" className="text-left px-4 py-2.5 font-semibold">Campaña</th>,
      td: (c) => <td key="campana" className="px-4 py-2 font-medium">{c.nombre}</td>,
    },
    asunto: {
      th: <th key="asunto" className="text-left px-4 py-2.5 font-semibold">Asunto</th>,
      td: (c) => <td key="asunto" className="px-4 py-2 text-muted-foreground">{c.asunto}</td>,
    },
    segmento: {
      th: <th key="segmento" className="text-left px-4 py-2.5 font-semibold">Segmento</th>,
      td: (c) => (
        <td key="segmento" className="px-4 py-2 text-xs">
          {SEGMENTOS_CLIENTE.find((s) => s.value === c.segmento)?.label ?? c.segmento}
        </td>
      ),
    },
    estado: {
      th: <th key="estado" className="text-left px-4 py-2.5 font-semibold">Estado</th>,
      td: (c) => (
        <td key="estado" className="px-4 py-2">
          <Badge variant="outline" className={`text-${estadoColor(c.estado)}-600`}>
            {ESTADOS_CAMPANA.find((e) => e.value === c.estado)?.label}
          </Badge>
        </td>
      ),
    },
    enviados: {
      th: <th key="enviados" className="text-right px-4 py-2.5 font-semibold">Enviados</th>,
      td: (c) => <td key="enviados" className="px-4 py-2 text-right tabular-nums">{c.estadisticas.enviados}</td>,
    },
    abiertos: {
      th: <th key="abiertos" className="text-right px-4 py-2.5 font-semibold">Abiertos</th>,
      td: (c) => <td key="abiertos" className="px-4 py-2 text-right tabular-nums">{c.estadisticas.abiertos}</td>,
    },
  };

  const columnasRender = ordenarColumnas(columnasDef, columnasOrden).filter(
    (c) => c.bloqueada || colVisible(columnasVisibles, c.campo),
  );

  return (
    <div className="p-4 md:p-6 space-y-4">
      <div className="flex items-center gap-3">
        <Mail className="h-6 w-6 text-muted-foreground" />
        <div>
          <h1 className="text-xl font-bold tracking-tight">Campañas de Email</h1>
          <p className="text-sm text-muted-foreground">Envía newsletters, promos y recordatorios a tu base de clientes</p>
        </div>
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

      {(modoLocal || resendOk === false) && (
        <div className="rounded-lg border border-amber-300 bg-amber-50 dark:bg-amber-950/30 p-3 flex items-start gap-2">
          <AlertCircle className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
          <div className="text-xs space-y-0.5">
            {modoLocal && (
              <p className="font-semibold text-amber-900 dark:text-amber-200">
                Tabla <code className="font-mono text-[11px]">campanas_marketing</code> no encontrada — usando almacenamiento local. Aplica la migración <code className="font-mono text-[11px]">044_marketing_campanas.sql</code>.
              </p>
            )}
            {resendOk === false && (
              <p className="text-amber-800 dark:text-amber-300/80">
                Resend no está conectado. Añade <code className="font-mono text-[11px]">RESEND_API_KEY</code> a <code className="font-mono text-[11px]">.env.local</code> para habilitar el envío de emails.
              </p>
            )}
          </div>
        </div>
      )}

      {emails.length === 0 ? (
        <div className="rounded-xl border border-dashed bg-card p-10 text-center">
          <Mail className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
          <p className="text-sm font-medium">No hay campañas de email todavía</p>
          <p className="text-xs text-muted-foreground mb-4">Crea tu primera newsletter en menos de 1 minuto</p>
          <Button onClick={abrirNuevo} size="sm" className="gap-2">
            <Plus className="h-4 w-4" /> Crear campaña
          </Button>
        </div>
      ) : (
        <div className="rounded-xl border bg-card overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                {columnasRender.map((c) => columnDefs[c.campo]?.th)}
                <th className="px-4 py-2.5"></th>
              </tr>
            </thead>
            <tbody>
              {filtrados.map((c) => (
                <tr key={c.id} className="border-t hover:bg-muted/30">
                  {columnasRender.map((col) => columnDefs[col.campo]?.td(c))}
                  <td className="px-4 py-2">
                    <div className="flex items-center justify-end gap-1">
                      {c.estado === "borrador" && (
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => onEnviar(c)} title="Enviar" disabled={enviando === c.id}>
                          <Send className={`h-4 w-4 ${enviando === c.id ? "animate-pulse" : ""}`} />
                        </Button>
                      )}
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => abrirEditar(c)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => eliminar(c.id)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Nueva campaña de email</DialogTitle>
            <DialogDescription>Define el contenido y el público objetivo</DialogDescription>
          </DialogHeader>
          {edit && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Nombre interno</Label>
                  <Input value={edit.nombre} onChange={(e) => setEdit({ ...edit, nombre: e.target.value })} placeholder="Promo San Valentín" />
                </div>
                <div className="space-y-1.5">
                  <Label>Segmento</Label>
                  <Select value={edit.segmento} onValueChange={(v) => setEdit({ ...edit, segmento: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {SEGMENTOS_CLIENTE.map((s) => (
                        <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>Asunto</Label>
                <Input value={edit.asunto} onChange={(e) => setEdit({ ...edit, asunto: e.target.value })} placeholder="Reserva tu mesa especial para el 14 de febrero" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Remitente (nombre)</Label>
                  <Input value={edit.remitenteNombre} onChange={(e) => setEdit({ ...edit, remitenteNombre: e.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <Label>Remitente (email)</Label>
                  <Input type="email" value={edit.remitenteEmail} onChange={(e) => setEdit({ ...edit, remitenteEmail: e.target.value })} />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>Contenido</Label>
                <Textarea
                  rows={8}
                  value={edit.cuerpoHtml}
                  onChange={(e) => setEdit({ ...edit, cuerpoHtml: e.target.value })}
                  placeholder="Escribe aquí el mensaje. Puedes usar HTML."
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setModalOpen(false)}>Cancelar</Button>
            <Button onClick={onGuardar}>Guardar borrador</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
