"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Plus, MessageCircle, Pencil, Trash2, Send, AlertCircle, Settings } from "lucide-react";
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
  crearCampanaWhatsAppVacia,
  ESTADOS_CAMPANA,
  SEGMENTOS_CLIENTE,
  type CampanaWhatsApp,
} from "@/features/marketing/data/campanas";
import { enviarWhatsAppAction, verificarIntegracionesAction } from "@/features/marketing/actions/campanas-actions";
import { toast } from "sonner";
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

const IDIOMAS = [
  { value: "es", label: "Español" },
  { value: "en", label: "English" },
  { value: "ca", label: "Català" },
];

export function CampanasWhatsAppView() {
  const { empresaActual } = useEmpresa();
  const { whatsapps, guardar, eliminar, modoLocal } = useCampanas(empresaActual.id);
  const [modalOpen, setModalOpen] = useState(false);
  const [edit, setEdit] = useState<CampanaWhatsApp | null>(null);
  const [enviando, setEnviando] = useState<string | null>(null);
  const [waOk, setWaOk] = useState<boolean | null>(null);
  const [busqueda, setBusqueda] = useState("");
  const [filtros, setFiltros] = useState<ToolbarFiltroActivo[]>([]);
  const [orden, setOrden] = useState<ToolbarOrdenActivo | null>(null);
  const [columnasVisibles, setColumnasVisibles] = useState<ToolbarColumnaVisible>({});
  const [columnasOrden, setColumnasOrden] = useState<string[] | undefined>(undefined);
  const [showConfig, setShowConfig] = useState(false);

  useEffect(() => {
    verificarIntegracionesAction().then((r) => setWaOk(r.whatsapp));
  }, []);

  const acceso = (c: CampanaWhatsApp, campo: string): unknown => {
    if (campo === "estado") return ESTADOS_CAMPANA.find((e) => e.value === c.estado)?.label ?? c.estado;
    if (campo === "segmento") return SEGMENTOS_CLIENTE.find((s) => s.value === c.segmento)?.label ?? c.segmento;
    if (campo === "nombre") return c.nombre;
    if (campo === "enviados") return c.estadisticas.enviados;
    if (campo === "leidos") return c.estadisticas.leidos;
    return (c as unknown as Record<string, unknown>)[campo];
  };

  const filtrados = useMemo(() => {
    let lista = whatsapps.filter((c) => {
      if (!busqueda) return true;
      const q = busqueda.toLowerCase();
      return (
        c.nombre.toLowerCase().includes(q) ||
        c.cuerpo.toLowerCase().includes(q) ||
        (c.plantilla ?? "").toLowerCase().includes(q)
      );
    });
    lista = aplicarFiltrosToolbar(lista, filtros, acceso);
    lista = aplicarOrdenToolbar(lista, orden, acceso);
    return lista;
  }, [whatsapps, busqueda, filtros, orden]);

  function abrirNuevo() {
    setEdit(crearCampanaWhatsAppVacia(empresaActual.id));
    setModalOpen(true);
  }

  function abrirEditar(c: CampanaWhatsApp) {
    setEdit({ ...c });
    setModalOpen(true);
  }

  function onGuardar() {
    if (!edit) return;
    if (!edit.nombre.trim() || !edit.cuerpo.trim()) {
      toast.error("Nombre y mensaje son obligatorios");
      return;
    }
    guardar(edit);
    toast.success("Campaña de WhatsApp guardada");
    setModalOpen(false);
  }

  async function onEnviar(c: CampanaWhatsApp) {
    if (!waOk) {
      toast.error("WhatsApp Cloud API no está configurada. Añade WHATSAPP_ACCESS_TOKEN y WHATSAPP_PHONE_NUMBER_ID.");
      return;
    }
    setEnviando(c.id);
    const result = await enviarWhatsAppAction(c);
    setEnviando(null);
    if (result.success) {
      await guardar({
        ...c,
        estado: "finalizada",
        fechaEnvio: new Date().toISOString(),
        estadisticas: {
          ...c.estadisticas,
          enviados: result.enviados ?? 0,
          fallidos: result.fallidos ?? 0,
        },
      });
      toast.success(`Enviados: ${result.enviados} · Fallidos: ${result.fallidos ?? 0}`);
    } else {
      await guardar({ ...c, estado: "fallida" });
      toast.error(result.error ?? "Error al enviar");
    }
  }

  const columnasDef: ToolbarColumna[] = [
    { campo: "campana", label: "Campaña" },
    { campo: "plantilla", label: "Plantilla" },
    { campo: "segmento", label: "Segmento" },
    { campo: "estado", label: "Estado" },
    { campo: "enviados", label: "Enviados" },
    { campo: "leidos", label: "Leídos" },
  ];

  const columnDefs: Record<string, { th: ReactNode; td: (c: CampanaWhatsApp) => ReactNode }> = {
    campana: {
      th: <th key="campana" className="text-left px-4 py-2.5 font-semibold">Campaña</th>,
      td: (c) => <td key="campana" className="px-4 py-2 font-medium">{c.nombre}</td>,
    },
    plantilla: {
      th: <th key="plantilla" className="text-left px-4 py-2.5 font-semibold">Plantilla</th>,
      td: (c) => <td key="plantilla" className="px-4 py-2 text-muted-foreground font-mono text-xs">{c.plantilla || "—"}</td>,
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
          <Badge variant="outline">{ESTADOS_CAMPANA.find((e) => e.value === c.estado)?.label}</Badge>
        </td>
      ),
    },
    enviados: {
      th: <th key="enviados" className="text-right px-4 py-2.5 font-semibold">Enviados</th>,
      td: (c) => <td key="enviados" className="px-4 py-2 text-right tabular-nums">{c.estadisticas.enviados}</td>,
    },
    leidos: {
      th: <th key="leidos" className="text-right px-4 py-2.5 font-semibold">Leídos</th>,
      td: (c) => <td key="leidos" className="px-4 py-2 text-right tabular-nums">{c.estadisticas.leidos}</td>,
    },
  };

  const columnasRender = ordenarColumnas(columnasDef, columnasOrden).filter(
    (c) => c.bloqueada || colVisible(columnasVisibles, c.campo),
  );

  return (
    <div className="p-4 md:p-6 space-y-4">
      <div className="flex items-center gap-3">
        <MessageCircle className="h-6 w-6 text-muted-foreground" />
        <div>
          <h1 className="text-xl font-bold tracking-tight">Campañas de WhatsApp</h1>
          <p className="text-sm text-muted-foreground">Envía mensajes masivos usando plantillas aprobadas por WhatsApp Business</p>
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

      {(modoLocal || waOk === false) && (
        <div className="rounded-lg border border-amber-300 bg-amber-50 dark:bg-amber-950/30 p-3 flex items-start gap-2">
          <AlertCircle className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
          <div className="text-xs space-y-0.5">
            {modoLocal && (
              <p className="font-semibold text-amber-900 dark:text-amber-200">
                Almacenamiento local — aplica la migración <code className="font-mono text-[11px]">044_marketing_campanas.sql</code>.
              </p>
            )}
            {waOk === false && (
              <p className="text-amber-800 dark:text-amber-300/80">
                WhatsApp Cloud API no conectada. Añade <code className="font-mono text-[11px]">WHATSAPP_ACCESS_TOKEN</code> y <code className="font-mono text-[11px]">WHATSAPP_PHONE_NUMBER_ID</code>.
              </p>
            )}
          </div>
        </div>
      )}

      {whatsapps.length === 0 ? (
        <div className="rounded-xl border border-dashed bg-card p-10 text-center">
          <MessageCircle className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
          <p className="text-sm font-medium">No hay campañas de WhatsApp todavía</p>
          <p className="text-xs text-muted-foreground mb-4">Las campañas requieren una plantilla previamente aprobada por Meta</p>
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
            <DialogTitle>Nueva campaña de WhatsApp</DialogTitle>
            <DialogDescription>
              Usa una plantilla previamente aprobada por Meta. El cuerpo debe coincidir con el texto aprobado.
            </DialogDescription>
          </DialogHeader>
          {edit && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Nombre interno</Label>
                  <Input value={edit.nombre} onChange={(e) => setEdit({ ...edit, nombre: e.target.value })} placeholder="Recordatorio reserva" />
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
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Nombre de plantilla (Meta)</Label>
                  <Input value={edit.plantilla} onChange={(e) => setEdit({ ...edit, plantilla: e.target.value })} placeholder="reserva_recordatorio" />
                </div>
                <div className="space-y-1.5">
                  <Label>Idioma</Label>
                  <Select value={edit.idioma} onValueChange={(v) => setEdit({ ...edit, idioma: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {IDIOMAS.map((i) => (
                        <SelectItem key={i.value} value={i.value}>{i.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>Cuerpo del mensaje</Label>
                <Textarea
                  rows={5}
                  value={edit.cuerpo}
                  onChange={(e) => setEdit({ ...edit, cuerpo: e.target.value })}
                  placeholder="Hola {{1}}, te recordamos tu reserva para el {{2}} a las {{3}}."
                />
                <p className="text-[11px] text-muted-foreground">
                  Usa {"{{1}}"}, {"{{2}}"}... como variables. WhatsApp debe haber aprobado la plantilla antes.
                </p>
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
